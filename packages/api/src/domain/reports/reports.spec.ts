import { describe, expect, it } from 'vitest';
import { csvSections, toCsv } from './csv';
import { indianFinancialYear } from './fiscal-year';

describe('CSV serialisation', () => {
  it('quotes cells containing commas, quotes and newlines', () => {
    const csv = toCsv(['name', 'note'], [['A, Inc', 'he said "hi"'], ['B', 'line1\nline2']]);
    expect(csv).toBe('name,note\r\n"A, Inc","he said ""hi"""\r\nB,"line1\nline2"');
  });

  it('renders empty for null/undefined', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,');
  });

  it('joins titled sections', () => {
    const out = csvSections([
      { title: 'Income', csv: 'a,b\r\n1,2' },
      { title: 'TDS', csv: 'c\r\n3' },
    ]);
    expect(out).toContain('# Income');
    expect(out).toContain('# TDS');
  });
});

describe('Indian financial year', () => {
  it('derives FY from a date in Q4 (Feb) → previous April', () => {
    const fy = indianFinancialYear(new Date('2026-02-15T00:00:00Z'));
    expect(fy.label).toBe('2025-26');
    expect(fy.from).toBe('2025-04-01');
    expect(fy.toExclusive).toBe('2026-04-01');
  });

  it('derives FY from a date in April → same year start', () => {
    expect(indianFinancialYear(new Date('2025-04-01T00:00:00Z')).label).toBe('2025-26');
  });

  it('accepts a start year and a label', () => {
    expect(indianFinancialYear(2025).from).toBe('2025-04-01');
    expect(indianFinancialYear('2025-26').toExclusive).toBe('2026-04-01');
  });
});
