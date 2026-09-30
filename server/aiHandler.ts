/**
 * The `/api/generate` request handler, expressed against a tiny transport
 * interface so the exact same logic runs on Vite and on Vercel.
 *
 * Validation order is deliberate: body first, then config, then rate limit.
 * A malformed request gets a 400 rather than being masked by a 503.
 */

import {
  callProvider,
  createRateLimiter,
  readAIConfig,
  type AIConfig,
} from './aiCore';

/** Minimal shape both Node's http and Vercel's helpers can satisfy. */
export interface Transport {
  method: string;
  headers: { get(name: string): string | undefined };
  /** Fully-read body. Both hosts buffer before calling us. */
  rawBody: string;
  clientKey: string;
}

export interface Result {
  status: number;
  body: unknown;
  /** Set when a fresh session cookie must be issued. */
  setCookie?: string;
}

export interface GenerateOptions {
  env: Record<string, string | undefined>;
  /** When false, the route refuses everything (offline mode). */
  enabled: boolean;
}

const NO_CONFIG_MESSAGE =
  'No AI provider configured. Add AI_API_KEY (and AI_MODEL / AI_BASE_URL) to .env, then restart the dev server.';

export function createGenerateHandler(options: GenerateOptions) {
  const cfg: AIConfig | null = readAIConfig(options.env);
  const maxHits = Number(options.env.AI_RATE_LIMIT ?? 30) || 30;
  const rateLimited = createRateLimiter(maxHits);

  return async function handleGenerate(req: Transport): Promise<Result> {
    if (!options.enabled) {
      return {
        status: 403,
        body: { error: 'AI proxy is disabled. Set AI_PROXY_ENABLED=true to enable it.' },
      };
    }

    if (req.method !== 'POST') return { status: 405, body: { error: 'Use POST.' } };

    if (req.rawBody.length > 200_000) {
      return { status: 413, body: { error: 'Request body too large.' } };
    }

    let payload: { system?: string; prompt?: string; json?: boolean };
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      return { status: 400, body: { error: 'Body must be valid JSON.' } };
    }

    const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
    if (!prompt) return { status: 400, body: { error: 'Missing "prompt".' } };

    if (!cfg) return { status: 503, body: { error: NO_CONFIG_MESSAGE } };

    if (rateLimited(req.clientKey)) {
      return { status: 429, body: { error: 'Too many requests. Wait a minute and try again.' } };
    }

    try {
      const text = await callProvider(
        cfg,
        payload.system?.trim() || 'You are a precise assistant.',
        prompt,
        payload.json !== false,
      );
      return { status: 200, body: { text } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { status: 502, body: { error: message } };
    }
  };
}

export interface HealthResult {
  status: number;
  body: { ok: boolean; aiEnabled: boolean; provider: string | null; model: string | null };
  setCookie?: string;
}

/** `/api/health` doubles as the session-cookie issuer for the app's first load. */
export function health(env: Record<string, string | undefined>): HealthResult {
  const cfg = readAIConfig(env);
  return {
    status: 200,
    body: {
      ok: true,
      aiEnabled: Boolean(cfg),
      provider: cfg?.provider ?? null,
      model: cfg?.model ?? null,
    },
  };
}
