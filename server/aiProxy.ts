/**
 * Dev/preview server-side AI proxy.
 *
 * Why this exists: the AI provider key must NEVER be shipped to the browser.
 * Vite only forwards `VITE_`-prefixed vars into the client bundle, so every
 * secret here is read from `.env` into `process.env` on the server only.
 * The browser talks to `/api/generate`, which relays to the provider.
 *
 * Supported providers (any OpenAI-compatible endpoint also works via "custom"):
 *   openai | openrouter | groq | together | ollama | custom  -> OpenAI chat/completions
 *   gemini                                                      -> Google Generative Language
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { loadEnv, type Connect, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';

type Provider =
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'together'
  | 'ollama'
  | 'custom'
  | 'gemini';

interface AIConfig {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

const DEFAULTS: Record<Provider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1' },
  custom: { baseUrl: '', model: '' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
};

export function readAIConfig(env: Record<string, string | undefined>): AIConfig | null {
  const provider = (env.AI_PROVIDER ?? 'openai').toLowerCase() as Provider;
  const apiKey = env.AI_API_KEY?.trim();
  const baseUrl = env.AI_BASE_URL?.trim() || DEFAULTS[provider]?.baseUrl || '';
  const model = env.AI_MODEL?.trim() || DEFAULTS[provider]?.model || '';

  // Ollama is local and keyless -> still "enabled".
  if (!model || (!apiKey && provider !== 'ollama')) return null;

  return {
    provider,
    apiKey: apiKey ?? '',
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    temperature: Number(env.AI_TEMPERATURE ?? 0.8) || 0.8,
    maxTokens: Number(env.AI_MAX_TOKENS ?? 4000) || 4000,
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 60000) || 60000,
  };
}

/* ----------------------------- tiny rate limiter ---------------------------- */

const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_HITS = Number(process.env.AI_RATE_LIMIT ?? 30) || 30;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

/* --------------------------------- provider call ---------------------------- */

/**
 * Provider responses are third-party and untrusted, so they are walked
 * defensively rather than asserted into a fixed shape.
 */
interface ProviderResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
}

function readCompletion(data: ProviderResponse, provider: Provider): string {
  if (provider === 'gemini') {
    const parts = data.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
  }

  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

async function callProvider(cfg: AIConfig, system: string, user: string, jsonMode: boolean) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: unknown;

    if (cfg.provider === 'gemini') {
      url = `${cfg.baseUrl}/models/${encodeURIComponent(cfg.model)}:generateContent`;
      headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['x-goog-api-key'] = cfg.apiKey;
      body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: cfg.temperature,
          maxOutputTokens: cfg.maxTokens,
          responseMimeType: jsonMode ? 'application/json' : 'text/plain',
        },
      };
    } else {
      url = `${cfg.baseUrl}/chat/completions`;
      headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];
      body = {
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 600);
      throw new Error(`Provider ${cfg.provider} responded ${res.status}: ${detail || res.statusText}`);
    }

    const data = (await res.json()) as ProviderResponse;
    const text = readCompletion(data, cfg.provider);

    if (!text) throw new Error('Provider returned an empty completion.');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Models love wrapping JSON in ``` fences. Strip them and find the outer object. */
export function extractJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const candidates: string[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(trimmed);

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

/* --------------------------------- middleware ------------------------------- */

const MAX_BODY_BYTES = 200_000;

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

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

/* --------------------------- session cookie guard -------------------------- */
/*
 * APP_SECRET never leaves the server. It signs an HttpOnly cookie that the
 * browser cannot read or forge, and /api/generate refuses to spend the paid
 * API key unless that cookie is present and valid.
 *
 * Without this, any website you visit could POST to http://localhost:5173 and
 * burn your API quota. This is a local-dev guard only - in production put real
 * auth in front of the route.
 */
const COOKIE_NAME = 'smr_sid';

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function readCookie(req: Connect.IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function ensureSessionCookie(req: Connect.IncomingMessage, res: ServerResponse, secret: string): boolean {
  const token = readCookie(req, COOKIE_NAME);
  if (token && token.includes('.')) {
    const [nonce, signature] = token.split('.');
    const expected = sign(nonce, secret);
    const a = Buffer.from(signature ?? '');
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }

  const nonce = `${Date.now().toString(36)}-${createHmac('sha256', secret).update(String(Math.random())).digest('hex').slice(0, 16)}`;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${nonce}.${sign(nonce, secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
  );
  return false;
}

function createMiddleware(
  getConfig: () => AIConfig | null,
  enabled: boolean,
  appSecret: string,
  proxyEnabled: boolean,
): Connect.NextHandleFunction {
  return async function aiProxy(req, res, next) {
    const url = (req.url ?? '').split('?')[0];

    if (url === '/api/health') {
      const cfg = getConfig();
      if (appSecret) ensureSessionCookie(req, res, appSecret);
      return sendJson(res, 200, {
        ok: true,
        aiEnabled: Boolean(cfg),
        provider: cfg?.provider ?? null,
        model: cfg?.model ?? null,
      });
    }

    if (url !== '/api/generate') return next();

    if (!enabled || !proxyEnabled) {
      return sendJson(res, 403, {
        error: 'AI proxy is disabled. Start the dev server or set AI_PROXY_ENABLED=true.',
      });
    }

    if (appSecret && !ensureSessionCookie(req, res, appSecret)) {
      return sendJson(res, 403, {
        error: 'Invalid or missing session. Open the app in your browser first (GET /api/health).',
      });
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Use POST.' });
    }

    // Validate the request before touching config, so a malformed request gets
    // a 400 instead of being masked by a 503.
    let payload: { system?: string; prompt?: string; json?: boolean };
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: 'Body must be valid JSON.' });
    }

    const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
    if (!prompt) return sendJson(res, 400, { error: 'Missing "prompt".' });

    const cfg = getConfig();
    if (!cfg) {
      return sendJson(res, 503, {
        error:
          'No AI provider configured. Add AI_API_KEY (and AI_MODEL / AI_BASE_URL) to .env, then restart the dev server.',
      });
    }

    const ip = String(req.socket.remoteAddress ?? 'local');
    if (rateLimited(ip)) {
      return sendJson(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
    }

    try {
      const text = await callProvider(
        cfg,
        payload.system?.trim() || 'You are a precise assistant.',
        prompt,
        payload.json !== false,
      );

      return sendJson(res, 200, { text });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return sendJson(res, 502, { error: message });
    }
  };
}

export interface AIProxyOptions {
  /** Force-enable outside of dev/preview (e.g. when hosting the built app behind your own server). */
  enable?: boolean;
}

export function aiProxy(options: AIProxyOptions = {}): Plugin {
  /** `command` is 'serve' for dev and preview, 'build' for a static build. */
  const isServerCommand = (command: string) => command === 'serve';

  // Held in a closure rather than stashed on `config`, so the dev and preview
  // hooks can read it without an untyped cast.
  let middleware: Connect.NextHandleFunction | null = null;

  // Takes the shared `middlewares` stack rather than the server object, so the
  // same registration works for `configureServer` (ViteDevServer) and
  // `configurePreviewServer` (PreviewServer) - the two have different types.
  const register = (s: ViteDevServer | PreviewServer) => {
    s.middlewares.use((req, res, next) => middleware?.(req, res, next));
    // No return: a returned function is treated by Vite as a "post" hook, and
    // `middlewares.use()` returns the connect app itself (a callable), which
    // Vite then invokes as (req, res, next) -> crash on reading req.url.
  };

  return {
    name: 'smr-ai-proxy',
    // `apply` is evaluated before .env is loaded into config.env, so only
    // `command` is reliable here; AI_PROXY_ENABLED is checked in the middleware.
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

      if (cfg) {
        // Logged to the terminal only - never to the client bundle.
        console.log(`[ai-proxy] ${cfg.provider} / ${cfg.model} (key kept server-side)`);
      } else {
        console.log('[ai-proxy] no AI provider configured - the app will use the built-in offline generator.');
      }
      console.log(`[ai-proxy] session guard ${appSecret ? 'ON' : 'OFF (set APP_SECRET in .env)'}`);

      if (String(env.AI_PROXY_ENABLED ?? 'true') === 'false') {
        console.log('[ai-proxy] AI_PROXY_ENABLED=false - /api/generate will refuse requests.');
      }

      middleware = createMiddleware(
        () => cfg,
        enabled,
        appSecret,
        String(env.AI_PROXY_ENABLED ?? 'true') !== 'false',
      );
    },

    configureServer: register,

    configurePreviewServer: register,
  };
}
