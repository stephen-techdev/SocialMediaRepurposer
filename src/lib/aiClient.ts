/**
 * Browser -> local API bridge.
 *
 * The provider key lives only in the server process (see server/aiProxy.ts).
 * This module never sees a secret: it just POSTs a prompt to /api/generate.
 */
import { AI_TOOL_SYSTEM_PROMPT, SYSTEM_PROMPT } from './prompts';

export interface AiStatus {
  aiEnabled: boolean;
  provider: string | null;
  model: string | null;
}

let cachedStatus: AiStatus | null = null;

export async function getAiStatus(force = false): Promise<AiStatus> {
  if (cachedStatus && !force) return cachedStatus;
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('health check failed');
    cachedStatus = (await res.json()) as AiStatus;
  } catch {
    // No proxy running (e.g. static build served by a dumb file server).
    cachedStatus = { aiEnabled: false, provider: null, model: null };
  }
  return cachedStatus;
}

export class AiUnavailableError extends Error {}

export async function runPrompt(
  prompt: string,
  options: { system?: string; json?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const { system = SYSTEM_PROMPT, json = true, timeoutMs = 90000 } = options;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, system, json }),
      signal: ctrl.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 503) throw new AiUnavailableError(data.error ?? 'AI provider is not configured.');
      throw new Error(data.error ?? `Generation failed (${res.status}).`);
    }

    return String(data.text ?? '');
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The request timed out. Try fewer platforms or a smaller model.');
    }
    throw err instanceof Error ? err : new Error('Generation failed.');
  } finally {
    clearTimeout(timer);
  }
}

export { AI_TOOL_SYSTEM_PROMPT, SYSTEM_PROMPT };
