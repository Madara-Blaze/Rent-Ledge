import { describe, expect, it } from 'vitest';
import { decryptField, encryptField } from './field-encryption';
import { JwtError, signJwt, verifyJwt } from './jwt';
import { hashPassword, verifyPassword } from './password';
import { isValidPan, numericOtp, panLast4, randomToken, sha256 } from './tokens';

// 32-byte key, base64-encoded.
const KEY = Buffer.alloc(32, 7).toString('base64');

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('produces a different hash each time (salted)', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });
});

describe('JWT (HS256)', () => {
  it('round-trips a payload', () => {
    const token = signJwt({ sub: 'user-1', role: 'OWNER' }, 'secret', 3600);
    const payload = verifyJwt(token, 'secret');
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('OWNER');
  });

  it('rejects a tampered token', () => {
    const token = signJwt({ sub: 'user-1' }, 'secret', 3600);
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(() => verifyJwt(tampered, 'secret')).toThrow(JwtError);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signJwt({ sub: 'user-1' }, 'secret', 3600);
    expect(() => verifyJwt(token, 'other-secret')).toThrow(JwtError);
  });

  it('rejects an expired token', () => {
    const token = signJwt({ sub: 'user-1' }, 'secret', -10);
    expect(() => verifyJwt(token, 'secret')).toThrow(/expired/i);
  });
});

describe('field encryption (AES-256-GCM)', () => {
  it('round-trips a PAN', () => {
    const enc = encryptField('ABCDE1234F', KEY);
    expect(enc).not.toContain('ABCDE1234F');
    expect(decryptField(enc, KEY)).toBe('ABCDE1234F');
  });

  it('fails to decrypt with the wrong key', () => {
    const enc = encryptField('secret', KEY);
    const wrong = Buffer.alloc(32, 9).toString('base64');
    expect(() => decryptField(enc, wrong)).toThrow();
  });
});

describe('tokens & PAN', () => {
  it('validates PAN format and extracts last 4', () => {
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('BADPAN')).toBe(false);
    expect(panLast4('abcde1234f')).toBe('234F');
  });

  it('generates a 6-digit OTP and stable hashes', () => {
    const otp = numericOtp(6);
    expect(otp).toMatch(/^\d{6}$/);
    expect(sha256('x')).toBe(sha256('x'));
    expect(randomToken()).not.toBe(randomToken());
  });
});
