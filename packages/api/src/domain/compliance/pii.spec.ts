import { describe, expect, it } from 'vitest';
import { maskEmail, maskPan, maskPhone } from './pii';

describe('PII masking', () => {
  it('masks emails but keeps the domain and first chars', () => {
    const m = maskEmail('john.doe@example.com');
    expect(m?.startsWith('jo')).toBe(true);
    expect(m?.endsWith('@example.com')).toBe(true);
    expect(m).not.toContain('hn.doe');
  });

  it('masks phones keeping the last 2 digits', () => {
    const m = maskPhone('+91 99999 99912'); // 12 digits
    expect(m).toBe('**********12');
    expect(m?.endsWith('12')).toBe(true);
    expect(m?.replace(/\*/g, '').length).toBe(2);
  });

  it('masks PAN keeping the last 4', () => {
    expect(maskPan('ABCDE1234F')).toBe('XXXXXX234F');
  });

  it('handles null/empty', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskPan('')).toBeNull();
  });
});
