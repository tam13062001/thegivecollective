import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value).digest();
export function passwordMatches(value, expected) {
  return typeof value === 'string' && typeof expected === 'string' &&
    timingSafeEqual(digest(value), digest(expected));
}
function configuration() {
  const secret = process.env.SOCIAL_SHARE_SECRET;
  const password = process.env.SOCIAL_SHARE_PASSWORD;
  if (!secret || secret.length < 32 || !password) throw new Error('Share access is not configured');
  // Changing either setting invalidates existing sessions.
  return createHmac('sha256', secret).update(password).digest();
}
export function createShareToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ scope: 'social-dashboard', exp: Math.floor(now / 1000) + 28800 })).toString('base64url');
  const signature = createHmac('sha256', configuration()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifyShareToken(token, now = Date.now()) {
  const key = configuration();
  if (typeof token !== 'string' || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', key).update(payload).digest('base64url');
  if (!passwordMatches(signature, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return claims.scope === 'social-dashboard' && Number.isInteger(claims.exp) && claims.exp > Math.floor(now / 1000);
  } catch { return false; }
}
