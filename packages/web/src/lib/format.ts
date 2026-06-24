/** Format integer minor units (paise) as a readable INR amount. */
export function formatINR(amountMinor: string | number | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  const major = (typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(major);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert a rupee amount typed by a user into integer minor units (paise),
 * using string math so we never lose precision to floating point.
 * Accepts "55000", "55000.5", "55,000.50". Throws on malformed input.
 * Money is sacred: callers should send the returned string straight to the API.
 */
export function rupeesToMinor(input: string): string {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [whole, frac = ''] = cleaned.split('.');
  const paise = (frac + '00').slice(0, 2);
  const minor = `${whole}${paise}`.replace(/^0+(?=\d)/, '');
  return minor === '' ? '0' : minor;
}
