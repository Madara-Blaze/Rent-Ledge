/**
 * Date helpers for billing math. Everything works in UTC at day granularity so
 * proration and notice periods are timezone-stable (the API stores a tenancy's
 * timezone separately for scheduling; the *amounts* must not drift with TZ).
 */

const MS_PER_DAY = 86_400_000;

/** Midnight-UTC Date for the same calendar Y-M-D. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Whole days from start to end, exclusive (same day = 0, next day = 1). */
export function daysBetween(start: Date, end: Date): number {
  return Math.round((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / MS_PER_DAY);
}

/** Inclusive day count of [start, end] (a single day = 1). */
export function daysInclusive(start: Date, end: Date): number {
  return daysBetween(start, end) + 1;
}

/** Number of completed whole months from start to asOf (calendar-aware). */
export function monthsBetween(start: Date, asOf: Date): number {
  let months =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - start.getUTCMonth());
  if (asOf.getUTCDate() < start.getUTCDate()) months -= 1;
  return months;
}

/** Add n calendar months, clamping to the last valid day (e.g. Jan 31 +1 → Feb 28/29). */
export function addMonths(d: Date, n: number): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function lastDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function daysInMonthOf(d: Date): number {
  return lastDayOfMonth(d).getUTCDate();
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
