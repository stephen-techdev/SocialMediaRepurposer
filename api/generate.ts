/**
 * Vercel serverless function: POST /api/generate
 *
 * The production counterpart of the Vite middleware. All the real logic lives
 * in server/aiHandler.ts; this file only adapts Vercel's req/res to it.
 *
 * SECURITY - read before exposing this publicly:
 *   The key is server-side only, which is the point of this function. But the
 *   APP_SECRET cookie guard is a CSRF-shaped control, NOT authentication.
 *   Anyone who can load the app can obtain a valid cookie and then spend your
 *   quota. Before real traffic, put actual auth in front of this route and
 *   require a session (or restrict to signed-in users). The rate limit is also
 *   per-instance, so a serverless fleet multiplies the effective ceiling.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// `.js` extensions are required: Vercel compiles these to native ESM, and Node's
// ESM resolver does not do extensionless lookups. Vite resolves these too.
import { createGenerateHandler, type Transport } from '../server/aiHandler.js';
import { COOKIE_NAME, isValidSession, readCookie } from '../server/aiSession.js';

const generate = createGenerateHandler({
  env: process.env,
  // On Vercel the function only exists if deployed, so it is always enabled.
  // Set AI_PROXY_ENABLED=false in the dashboard to force offline mode.
  enabled: String(process.env.AI_PROXY_ENABLED ?? 'true') !== 'false',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appSecret = process.env.APP_SECRET?.trim();

  if (appSecret && !isValidSession(readCookie(req.headers.cookie, COOKIE_NAME), appSecret)) {
    return res.status(403).json({
      error: 'Invalid or missing session. Open the app in your browser first (GET /api/health).',
    });
  }

  // Vercel already parsed the body for JSON content-type; fall back to the raw
  // string for anything else so the shared handler sees valid JSON either way.
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

  const transport: Transport = {
    method: req.method ?? 'GET',
    headers: { get: (n) => (req.headers[n.toLowerCase()] as string | undefined) },
    rawBody,
    // Vercel sets x-forwarded-for; fall back to x-real-ip.
    clientKey: String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'local').split(',')[0].trim(),
  };

  const result = await generate(transport);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(result.status).json(result.body);
}
