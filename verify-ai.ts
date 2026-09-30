/**
 * Verifies the AI path with NO real API call.
 *
 * Starts the proxy against a mock provider so we can prove:
 *   .env key -> server-side config -> /api/health -> provider call -> JSON out
 * If this passes, pasting a real key is the only remaining step.
 *
 * IMPORTANT: this never writes to `.env`. The mock config is injected through
 * the dev server's own environment, which server/aiProxy.ts lets win over the
 * file (`{ ...loaded, ...process.env }`). An earlier version rewrote `.env` in
 * place and restored it on the happy path only - interrupting it destroyed the
 * real API key. Do not reintroduce that.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const FAKE_KEY = 'sk-test-DOES-NOT-EXIST-0000000000000000';

let lastAuthHeader = '';

/** Only the parts of the upstream request we assert on - never a full assert. */
interface CapturedRequest {
  messages?: Array<{ role?: string; content?: unknown }>;
}
let lastBody: CapturedRequest | null = null;

/**
 * Reads back the captured body. A function is used because `lastBody` is
 * assigned inside the mock server's request callback, which control-flow
 * analysis cannot see - it would otherwise narrow the read site to `null`.
 */
function capturedUserMessage(): string {
  return String(lastBody?.messages?.[1]?.content ?? '');
}

const mockServer = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    lastAuthHeader = String(req.headers.authorization ?? '');
    try {
      lastBody = JSON.parse(raw);
    } catch {
      lastBody = null;
    }
    // A realistic completion shape, fenced like a chatty model would.
    const payload = {
      variations: [
        {
          post: '180 km. 3 districts. 72% turnout.\n\nVijay began the Thoothukudi roadshow from Coimbatore on Tuesday and the convoy ran through Erode.\n\nWhich district should it hit next?',
          hashtags: ['#TamilNadu', '#Thoothukudi'],
          cta: 'Send this to one person who should read it',
          hook: '180 km. 3 districts. 72% turnout.',
          why: 'Numeric hook stops the scroll on a small screen.',
        },
      ],
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(payload) + '\n```' } }] }));
  });
});

await new Promise<void>((r) => mockServer.listen(0, '127.0.0.1', r));
const mockPort = (mockServer.address() as { port: number }).port;

/**
 * The real APP_SECRET, so the session-guard checks exercise the same code path
 * the app uses. Read-only: if it is missing we fall back to a throwaway one.
 */
function readAppSecret(): string {
  try {
    const m = /^\s*APP_SECRET\s*=\s*(.+)$/m.exec(readFileSync(resolve(ROOT, '.env'), 'utf8'));
    return m?.[1].trim() || 'verify-only-secret-not-a-real-one-000000000';
  } catch {
    return 'verify-only-secret-not-a-real-one-000000000';
  }
}

const port = 5199;

// Point the proxy at the mock provider purely through the child's environment.
// `env` values win over `.env` in readAIConfig, so no file is modified.
const child = spawn(
  process.execPath,
  [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'],
  {
    cwd: ROOT,
    stdio: 'pipe',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      AI_PROVIDER: 'custom',
      AI_API_KEY: FAKE_KEY,
      AI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`,
      AI_MODEL: 'mock-model',
      APP_SECRET: readAppSecret(),
    },
  },
);

let log = '';
child.stdout.on('data', (d) => (log += d.toString()));
child.stderr.on('data', (d) => (log += d.toString()));

const waitFor = async (fn: () => Promise<boolean>, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

/**
 * Vite is spawned directly (no `shell: true`), so `child.kill()` is enough on
 * every platform. The old version went through `npx` with a shell, which left
 * an orphaned `node` holding the event loop open and the script never exited.
 */
const stopChild = () => {
  if (child.exitCode === null && child.signalCode === null) child.kill();
  mockServer.close();
};

// Vite binds to `localhost`, which on Windows may resolve to ::1 rather than
// 127.0.0.1 - so use `localhost` here too.
const base = `http://localhost:${port}`;

let started = false;
try {
  started = await waitFor(async () => {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
      return r.ok;
    } catch {
      return false;
    }
  }, 80);

  if (!started) throw new Error('Dev server never became ready.\n' + log.slice(-2000));
} catch (err) {
  stopChild();
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const results: Array<[string, boolean, string]> = [];
const h = await fetch(`${base}/api/health`);
const health = (await h.json()) as { aiEnabled?: boolean; model?: string };
results.push(['health reports AI enabled', health.aiEnabled === true, JSON.stringify(health)]);
results.push(['health names the model', health.model === 'mock-model', String(health.model)]);
results.push(['health leaks no key', !JSON.stringify(health).includes(FAKE_KEY), '']);

const cookie = h.headers.get('set-cookie')?.split(';')[0] ?? '';
results.push(['session cookie issued', Boolean(cookie), '']);

const gen = await fetch(`${base}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ prompt: 'Write a Tamil election caption', json: true }),
});
const genBody = (await gen.json()) as { text?: string; error?: string };
results.push(['generate returns 200', gen.status === 200, `status ${gen.status}`]);
results.push([
  'response carries text',
  typeof genBody.text === 'string' && genBody.text.includes('Thoothukudi'),
  genBody.error ?? '',
]);
results.push(['fenced JSON survived', typeof genBody.text === 'string' && genBody.text.includes('```'), '']);
results.push(['server sent the key upstream', lastAuthHeader === `Bearer ${FAKE_KEY}`, lastAuthHeader.slice(0, 24) + '...']);
results.push(['prompt reached the provider', capturedUserMessage().includes('Tamil election'), '']);

stopChild();

console.log('\nAI PATH VERIFICATION (mock provider, no real API call)\n');
for (const [label, passed, note] of results) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${note ? `  (${note})` : ''}`);
}
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${failed === 0 ? 'All checks passed - the AI path works.' : `${failed} check(s) failed`}\n`);
if (failed && log) console.log(log.slice(-2000));

// Tear down before exiting. process.exit() while undici still holds a
// keep-alive socket trips a libuv assertion on Windows, and simply letting the
// loop drain never terminates. Closing the dispatcher releases the sockets; the
// timer is a backstop in case undici is absent or the close hangs.
await (async () => {
  const dispatcher = (globalThis as Record<symbol, { close?: () => Promise<void> } | undefined>)[
    Symbol.for('undici.globalDispatcher.1')
  ];
  await dispatcher?.close?.();
})();

const backstop = setTimeout(() => process.exit(failed === 0 ? 0 : 1), 2000);
backstop.unref();
process.exitCode = failed === 0 ? 0 : 1;
