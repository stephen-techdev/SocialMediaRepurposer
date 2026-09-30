/**
 * HMAC-signed session cookie, used by both the Vite middleware and the Vercel
 * functions so a cookie issued on one is accepted by the other.
 *
 * `secret` is APP_SECRET. When it is empty the guard is disabled entirely
 * rather than failing closed - otherwise a missing secret would break local
 * development with no way to fix it.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE_NAME } from './aiCore.js';

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

/** Verify a cookie value in constant time. Returns false on any mismatch. */
export function isValidSession(token: string | null, secret: string): boolean {
  if (!token || !secret || !token.includes('.')) return false;
  const [nonce, signature] = token.split('.');
  const expected = sign(nonce, secret);
  const a = Buffer.from(signature ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Build the Set-Cookie header value for a fresh session. */
export function issueSession(secret: string): string {
  const nonce = `${Date.now().toString(36)}-${createHmac('sha256', secret)
    .update(String(Math.random()))
    .digest('hex')
    .slice(0, 16)}`;
  return `${COOKIE_NAME}=${nonce}.${sign(nonce, secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
}

/** Pull a named cookie out of a raw Cookie header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export { COOKIE_NAME };
