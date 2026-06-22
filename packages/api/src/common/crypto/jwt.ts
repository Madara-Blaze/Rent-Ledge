import { createHmac, timingSafeEqual } from 'node:crypto';

/** Minimal HS256 JWT (sign/verify) using Node core HMAC — no external library. */

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSec: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt<T extends JwtPayload = JwtPayload>(token: string, secret: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Malformed token');
  const [encHeader, encBody, sig] = parts;
  const data = `${encHeader}.${encBody}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new JwtError('Invalid signature');

  let payload: T;
  try {
    payload = JSON.parse(Buffer.from(encBody, 'base64url').toString('utf8')) as T;
  } catch {
    throw new JwtError('Malformed token payload');
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError('Token expired');
  }
  return payload;
}
