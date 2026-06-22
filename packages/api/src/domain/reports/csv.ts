/** RFC-4180-ish CSV serialisation with quoting for commas/quotes/newlines. */
export type CsvCell = string | number | bigint | null | undefined;

function escape(value: CsvCell): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  return lines.join('\r\n');
}

/** Join several titled CSV sections into one document (for the CA pack). */
export function csvSections(sections: { title: string; csv: string }[]): string {
  return sections.map((s) => `# ${s.title}\r\n${s.csv}`).join('\r\n\r\n');
}
