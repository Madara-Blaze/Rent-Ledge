import { createHash, randomBytes, randomInt } from 'node:crypto';

/** Opaque random token (refresh tokens, invite tokens). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex — used to store only the hash of opaque tokens/OTPs at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Numeric one-time password, cryptographically random. */
export function numericOtp(digits = 6): string {
  const n = randomInt(0, 10 ** digits);
  return n.toString().padStart(digits, '0');
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(pan: string): string {
  return pan.trim().toUpperCase();
}

export function isValidPan(pan: string): boolean {
  return PAN_RE.test(normalizePan(pan));
}

export function panLast4(pan: string): string {
  return normalizePan(pan).slice(-4);
}
