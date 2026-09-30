/**
 * Dev/preview server-side AI proxy (Vite middleware).
 *
 * Why this exists: the AI provider key must NEVER be shipped to the browser.
 * Vite only forwards `VITE_`-prefixed vars into the client bundle, so every
 * secret here is read from `.env` into `process.env` on the server only.
 * The browser talks to `/api/generate`, which relays to the provider.
 *
 * The actual work lives in aiCore/aiHandler/aiSession, which are shared with
 * the Vercel functions in `api/`. This file is only the Vite adapter: it
 * reads the request off the Node socket and writes the response back.
 */
import { loadEnv, type Connect, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';

import { readAIConfig, MAX_BODY_BYTES } from './aiCore';
import { createGenerateHandler, health, type Transport } from './aiHandler';
import { COOKIE_NAME, isValidSession, issueSession, readCookie } from './aiSession';

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: import('node:http').ServerResponse, status: number, payload: unknown, setCookie?: string) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  res.end(body);
}

export interface AIProxyOptions {
  /** Force-enable outside of dev/preview (e.g. when hosting the built app behind your own server). */
  enable?: boolean;
}

export function aiProxy(options: AIProxyOptions = {}): Plugin {
  /** `command` is 'serve' for dev and preview, 'build' for a static build. */
  const isServerCommand = (command: string) => command === 'serve';

  // Held in a closure rather than stashed on `config`, so the hooks below can
  // read it without an untyped cast.
  let handle: ((req: Connect.IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>) | null =
    null;

  // Takes the shared `middlewares` stack rather than the server object, so the
  // same registration works for `configureServer` (ViteDevServer) and
  // `configurePreviewServer` (PreviewServer) - the two have different types.
  const register = (s: ViteDevServer | PreviewServer) => {
    s.middlewares.use((req, res, next) => handle?.(req, res).then(() => next(), next));
  };

  return {
    name: 'smr-ai-proxy',
    // `apply` is evaluated before .env is loaded into config.env, so only
    // `command` is reliable here; AI_PROXY_ENABLED is checked in the handler.
    apply: (_config, env) => isServerCommand(env.command),

    configResolved(config) {
      const enabled = options.enable ?? isServerCommand(config.command);

      // `config.env` only carries VITE_-prefixed vars, so the secrets would be
      // invisible here. Load .env ourselves with an empty prefix to get them,
      // then let real process.env win.
      const loaded = loadEnv(config.mode, config.root ?? process.cwd(), '');
      const env: Record<string, string> = { ...loaded, ...process.env } as Record<string, string>;

      const cfg = readAIConfig(env);
      const appSecret = env.APP_SECRET?.trim() ?? '';
      const proxyEnabled = String(env.AI_PROXY_ENABLED ?? 'true') !== 'false';

      if (cfg) {
        // Logged to the terminal only - never to the client bundle.
        console.log(`[ai-proxy] ${cfg.provider} / ${cfg.model} (key kept server-side)`);
      } else {
        console.log('[ai-proxy] no AI provider configured - the app will use the built-in offline generator.');
      }
      console.log(`[ai-proxy] session guard ${appSecret ? 'ON' : 'OFF (set APP_SECRET in .env)'}`);
      if (!proxyEnabled) console.log('[ai-proxy] AI_PROXY_ENABLED=false - /api/generate will refuse requests.');

      const generate = createGenerateHandler({ env, enabled: enabled && proxyEnabled });

      handle = async (req, res) => {
        const url = (req.url ?? '').split('?')[0];

        if (url === '/api/health') {
          const result = health(env);
          sendJson(res, result.status, result.body, appSecret ? issueSession(appSecret) : undefined);
          return;
        }

        if (url !== '/api/generate') return;

        // Refuse to spend the API key without a valid session cookie.
        if (appSecret && !isValidSession(readCookie(req.headers.cookie, COOKIE_NAME), appSecret)) {
          sendJson(res, 403, {
            error: 'Invalid or missing session. Open the app in your browser first (GET /api/health).',
          });
          return;
        }

        let rawBody = '';
        try {
          rawBody = await readBody(req);
        } catch {
          sendJson(res, 413, { error: 'Request body too large.' });
          return;
        }

        const transport: Transport = {
          method: req.method ?? 'GET',
          headers: { get: (n) => req.headers[n.toLowerCase()] as string | undefined },
          rawBody,
          clientKey: String(req.socket.remoteAddress ?? 'local'),
        };

        const result = await generate(transport);
        sendJson(res, result.status, result.body);
      };
    },

    configureServer: register,

    configurePreviewServer: register,
  };
}
