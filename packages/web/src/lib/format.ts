/** Format integer minor units (paise) as a readable INR amount. */
export function formatINR(amountMinor: string | number | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return '—';
  const major = (typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor) / 100;
  if (Number.isNaN(major)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(major);
}

/** Format minor units with two decimal places (paise-accurate display). */
export function formatINRExact(amountMinor: string | number | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return '—';
  const major = (typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor) / 100;
  if (Number.isNaN(major)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Convert a rupee amount typed by a human into integer minor units (paise),
 * using string math so we never lose precision to floating point.
 * Accepts "55000", "55,000", "55000.5", "55000.50". Returns null if invalid.
 */
export function rupeesToMinor(input: string): string | null {
  const cleaned = input.replace(/[,\s₹]/g, '').trim();
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const paise = (frac + '00').slice(0, 2);
  const minor = BigInt(whole) * 100n + BigInt(paise || '0');
  return minor.toString();
}

/** Format an ISO date / timestamp for display in en-IN. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(d);
}

/** Format an ISO timestamp with date + time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short id for display, e.g. "a1b2c3d4". */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.slice(0, 8);
}
