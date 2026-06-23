/**
 * Indian financial year runs 1 April → 31 March. Accepts a starting year (2025),
 * a label ('2025-26'), or a date, and returns an inclusive-from / exclusive-to range.
 */
export interface FiscalYear {
  label: string;
  from: string; // inclusive, YYYY-MM-DD
  toExclusive: string; // exclusive, YYYY-MM-DD
}

export function indianFinancialYear(input: string | number | Date = new Date()): FiscalYear {
  let startYear: number;

  if (typeof input === 'number') {
    startYear = input;
  } else if (input instanceof Date) {
    const month = input.getUTCMonth(); // 0=Jan, 3=Apr
    const year = input.getUTCFullYear();
    startYear = month >= 3 ? year : year - 1;
  } else {
    const m = /^(\d{4})/.exec(input.trim());
    if (!m) throw new Error(`Invalid financial year: ${input}`);
    startYear = Number(m[1]);
  }

  return {
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    from: `${startYear}-04-01`,
    toExclusive: `${startYear + 1}-04-01`,
  };
}
