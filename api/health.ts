/**
 * Vercel serverless function: GET /api/health
 *
 * Reports whether AI generation is available and issues the session cookie
 * that /api/generate requires. Mirrors the Vite middleware's /api/health.
 *
 * Never returns the key - only the provider name and model.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { health } from '../server/aiHandler';
import { issueSession } from '../server/aiSession';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET.' });
  }

  const result = health(process.env);
  const appSecret = process.env.APP_SECRET?.trim();

  if (appSecret) res.setHeader('Set-Cookie', issueSession(appSecret));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(result.status).json(result.body);
}
