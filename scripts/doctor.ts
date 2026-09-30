/**
 * Configuration check. Run with: npm run doctor
 *
 * Tells you exactly what is missing and whether the AI engine will be online.
 * Prints only whether a key exists - never the key itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env');

const c = {
  ok: (s: string) => `\x1b[32mOK\x1b[0m    ${s}`,
  warn: (s: string) => `\x1b[33mWARN\x1b[0m  ${s}`,
  bad: (s: string) => `\x1b[31mFAIL\x1b[0m  ${s}`,
  info: (s: string) => `\x1b[36mINFO\x1b[0m  ${s}`,
};

console.log('\nSocial Media Repurposer - configuration check\n');

if (!existsSync(envPath)) {
  console.log(c.bad('.env not found'));
  console.log(c.info('Create it:  cp .env.example .env\n'));
} else {
  console.log(c.ok('.env exists'));
}

const env: Record<string, string> = existsSync(envPath) ? {} : { AI_API_KEY: '' };
for (const line of existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}

const provider = (env.AI_PROVIDER || 'openai').toLowerCase();
const key = env.AI_API_KEY || '';
const model = env.AI_MODEL || '(default)';

console.log(c.info(`AI provider: ${provider}`));
console.log(c.info(`AI model:    ${model}`));

if (provider === 'ollama') {
  const url = env.AI_BASE_URL || 'http://127.0.0.1:11434';
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const body = (await res.json()) as { models?: Array<{ name: string }> };
      const has = body.models?.some((m) => m.name.split(':')[0] === model.split(':')[0]);
      console.log(c.ok(`Ollama reachable at ${url}`));
      console.log(has ? c.ok(`Model "${model}" is pulled`) : c.warn(`Model "${model}" not pulled - run: ollama pull ${model}`));
    } else {
      console.log(c.warn(`Ollama responded ${res.status} - check that "ollama serve" is running`));
    }
  } catch {
    console.log(c.bad(`Cannot reach Ollama at ${url}`));
    console.log(c.info('Start it with:  ollama serve'));
  }
} else if (!key) {
  console.log(c.warn('AI_API_KEY is empty -> the app will run the OFFLINE generator'));
  console.log('');
  console.log(c.info(`Add your ${provider} key to .env:`));
  console.log(c.info(`    AI_API_KEY=sk-...`));
  console.log(c.info('Then restart the dev server (Ctrl+C, npm run dev).'));
  console.log('');
  console.log(c.info('OpenAI keys: https://platform.openai.com/api-keys'));
} else {
  console.log(c.ok(`AI_API_KEY present (${key.length} chars, value not shown)`));
  console.log(c.ok('AI generation should be live once the dev server restarts'));
}

// Sign-in and cloud sync have been removed, so there is no backend to probe.
// History, favourites, analytics and preferences are localStorage only.
console.log(c.ok('Storage: localStorage only (no account, no server-side copy)'));

if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY) {
  console.log(
    c.warn('VITE_SUPABASE_* are still set in .env but are no longer read. Safe to delete them.'),
  );
}

const secret = env.APP_SECRET || '';
if (secret && secret.length >= 32) {
  console.log(c.ok(`APP_SECRET present (${secret.length} chars) - session guard active`));
} else {
  console.log(c.warn('APP_SECRET missing or short - generate one with:'));
  console.log(c.info('    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'));
}

console.log('');
// No process.exit(): on Windows, forcing an exit while undici's fetch socket is
// still open aborts the libuv loop ("Assertion failed: handle->flags"). Let the
// process end naturally once the socket is released.
if (!key && provider !== 'ollama') {
  console.log(c.info('The app still works - it just uses the offline generator.\n'));
}
