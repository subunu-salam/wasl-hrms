// One-time setup / reset codes HR gives an employee so they can choose their own password.
import { randomInt, createHash, timingSafeEqual } from 'node:crypto';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_DAYS = 7;
export const MAX_ATTEMPTS = 5;
export function newCode() {
  const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
export const normalise = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashCode = (c) => createHash('sha256').update(`wasl-setup:${normalise(c)}`).digest('hex');
export function codeMatches(code, hash) {
  if (!hash) return false;
  const a = Buffer.from(hashCode(code), 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
export const passwordProblem = (pw) => (String(pw).length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Use letters and at least one number.' : null);
