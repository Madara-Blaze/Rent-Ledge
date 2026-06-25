/**
 * Minimal, dependency-free PDF writer for single-page text documents (e.g. rent
 * receipts). Lays out absolutely-positioned text lines using the built-in
 * Helvetica fonts. Good enough for receipts; not a general-purpose PDF library.
 *
 * Coordinates are PDF points from the bottom-left of an A4 page (595 x 842).
 */
export interface PdfTextLine {
  text: string;
  /** Distance from the left edge, in points. Default 56 (~2cm). */
  x?: number;
  /** Distance from the bottom edge, in points. */
  y: number;
  /** Font size in points. Default 11. */
  size?: number;
  /** Render in Helvetica-Bold instead of Helvetica. */
  bold?: boolean;
}

const escape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function buildTextPdf(lines: PdfTextLine[]): Buffer {
  const content = lines
    .map((l) => `BT /${l.bold ? 'F2' : 'F1'} ${l.size ?? 11} Tf ${l.x ?? 56} ${l.y} Td (${escape(l.text)}) Tj ET`)
    .join('\n');

  const objects = [
    `<</Type/Catalog/Pages 2 0 R>>`,
    `<</Type/Pages/Kids[3 0 R]/Count 1>>`,
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>`,
    `<</Length ${Buffer.byteLength(content, 'latin1')}>>\nstream\n${content}\nendstream`,
    `<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`,
    `<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${off.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}
