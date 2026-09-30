/**
 * Host-agnostic core of the AI proxy.
 *
 * Shared by two very different hosts:
 *   - `server/aiProxy.ts`  -> a Vite dev/preview middleware (local development)
 *   - `api/*.ts`           -> Vercel serverless functions (production)
 *
 * Deliberately free of any Vite or Vercel imports so it can be bundled by
 * either. Everything that differs between hosts lives in the thin adapters;
 * provider dispatch, the session guard, rate limiting and JSON extraction
 * exist here exactly once.
 *
 * The API key is only ever read from the environment here. It is never
 * returned, never logged, and never placed in a response body.
 */

export type Provider =
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'together'
  | 'ollama'
  | 'custom'
  | 'gemini';

export interface AIConfig {
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

/* ----------------------------- rate limiter ------------------------------ */

/*
 * Per-process, in-memory. Enough for a single Vercel instance and for local
 * dev. A serverless fleet is many processes, so the effective limit is
 * `AI_RATE_LIMIT` per instance rather than global. For a real quota guarantee
 * put a shared store (Upstash, Vercel KV) in front of this.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;

export function createRateLimiter(maxHits: number) {
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > maxHits;
  };
}

/* -------------------------------- provider call --------------------------- */

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

export async function callProvider(
  cfg: AIConfig,
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<string> {
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

/* --------------------------- session cookie guard ------------------------- */
/*
 * APP_SECRET never leaves the server. It signs an HttpOnly cookie that the
 * browser cannot read or forge, and /api/generate refuses to spend the paid
 * API key unless that cookie is present and valid.
 *
 * Locally this stops other websites from POSTing to
 * http://localhost:5173 and burning your quota. In production it is a weak
 * CSRF-shaped guard, NOT authentication: anyone who can load the app obtains a
 * valid cookie. Put real auth in front of this route before exposing it to
 * untrusted traffic.
 */
export const COOKIE_NAME = 'smr_sid';

const MAX_BODY_BYTES = 200_000;

export { MAX_BODY_BYTES };
