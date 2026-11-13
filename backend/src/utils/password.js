import crypto from 'node:crypto';

const KEY_LEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, KEY_LEN);
  return `${salt}:${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const derived = crypto.scryptSync(String(password), salt, KEY_LEN);
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

