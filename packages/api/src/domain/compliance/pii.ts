/**
 * PII masking helpers (DPDP data-minimisation). Used for logs, support views and
 * data exports so raw identifiers are never casually exposed.
 */
export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const head = user.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}

export function maskPan(pan?: string | null): string | null {
  if (!pan) return null;
  const p = pan.toUpperCase();
  return p.length >= 4 ? `XXXXXX${p.slice(-4)}` : '****';
}
