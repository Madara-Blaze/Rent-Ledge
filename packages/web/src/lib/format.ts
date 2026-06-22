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
