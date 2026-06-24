import { buildTextPdf, type PdfTextLine } from '../../common/pdf/text-pdf';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? `${ONES[h]} Hundred${r ? ' ' : ''}` : ''}${r ? twoDigits(r) : ''}`;
}
function rupeesInWords(n: bigint): string {
  if (n === 0n) return 'Zero';
  let rest = n;
  const crore = rest / 10000000n;
  rest %= 10000000n;
  const lakh = Number(rest / 100000n);
  rest %= 100000n;
  const thousand = Number(rest / 1000n);
  rest %= 1000n;
  const parts: string[] = [];
  if (crore) parts.push(`${rupeesInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (Number(rest)) parts.push(threeDigits(Number(rest)));
  return parts.join(' ').trim();
}

/** Amount in words, Indian numbering (e.g. "Fifty Five Thousand Rupees Only"). */
export function amountInWordsINR(amountMinor: string | bigint): string {
  const minor = BigInt(amountMinor);
  const rupees = rupeesInWords(minor / 100n);
  const paise = Number(minor % 100n);
  return paise ? `${rupees} Rupees and ${twoDigits(paise)} Paise Only` : `${rupees} Rupees Only`;
}

function inr(amountMinor: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    Number(amountMinor) / 100,
  );
}

export interface ReceiptData {
  receiptNo: string;
  date: string;
  landlordName: string;
  landlordPan?: string | null;
  tenantName: string;
  propertyName: string;
  propertyAddress?: string | null;
  amountMinor: string;
  method: string;
  periodLabel?: string | null;
  reference?: string | null;
}

/** Compose an HRA-friendly rent receipt as a one-page PDF. */
export function buildRentReceiptPdf(d: ReceiptData): Buffer {
  const lines: PdfTextLine[] = [];
  let y = 800;
  const row = (label: string, value: string) => {
    lines.push({ text: label, x: 56, y, size: 11, bold: true });
    lines.push({ text: value, x: 200, y, size: 11 });
    y -= 22;
  };

  lines.push({ text: 'RENT RECEIPT', x: 56, y, size: 20, bold: true });
  y -= 18;
  lines.push({ text: 'For House Rent Allowance (HRA) claim', x: 56, y, size: 10 });
  y -= 34;

  row('Receipt No.', d.receiptNo);
  row('Date', d.date);
  y -= 8;
  row('Received from', d.tenantName);
  row('Landlord', d.landlordName);
  if (d.landlordPan) row('Landlord PAN', d.landlordPan);
  row('Property', d.propertyName);
  if (d.propertyAddress) row('Address', d.propertyAddress);
  if (d.periodLabel) row('For the period', d.periodLabel);
  row('Payment mode', d.method);
  if (d.reference) row('Reference', d.reference);
  y -= 8;
  row('Amount', inr(d.amountMinor));

  y -= 10;
  lines.push({ text: 'Amount in words:', x: 56, y, size: 11, bold: true });
  y -= 18;
  lines.push({ text: amountInWordsINR(d.amountMinor), x: 56, y, size: 11 });

  y -= 60;
  lines.push({ text: 'This is a system-generated receipt from RentLedger.', x: 56, y, size: 9 });
  y -= 40;
  lines.push({ text: '_____________________________', x: 360, y, size: 11 });
  y -= 16;
  lines.push({ text: 'Authorised signatory', x: 360, y, size: 10 });

  return buildTextPdf(lines);
}
