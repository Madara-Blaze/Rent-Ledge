import { buildTextPdf, type PdfTextLine } from '../../common/pdf/text-pdf';
import { amountInWordsINR } from '../payments/receipt';

function inr(amountMinor: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    Number(amountMinor) / 100,
  );
}

export interface TaxInvoiceData {
  number: string;
  date: string;
  periodLabel: string | null;
  supplierName: string;
  supplierGstin: string;
  recipientName: string;
  recipientGstin: string | null;
  propertyName: string;
  placeOfSupply: string;
  hsnSac: string;
  taxableMinor: string;
  cgstMinor: string;
  sgstMinor: string;
  igstMinor: string;
  totalTaxMinor: string;
  grossMinor: string;
  rateBps: number;
  interState: boolean;
}

/** Compose a GST-compliant tax invoice as a one-page PDF. */
export function buildTaxInvoicePdf(d: TaxInvoiceData): Buffer {
  const lines: PdfTextLine[] = [];
  let y = 800;
  const ratePct = (d.rateBps / 100).toFixed(d.rateBps % 100 === 0 ? 0 : 2);
  const row = (label: string, value: string, opts?: { bold?: boolean }) => {
    lines.push({ text: label, x: 56, y, size: 11, bold: true });
    lines.push({ text: value, x: 230, y, size: 11, bold: opts?.bold });
    y -= 21;
  };

  lines.push({ text: 'TAX INVOICE', x: 56, y, size: 20, bold: true });
  y -= 16;
  lines.push({ text: '(GST on rental of immovable property)', x: 56, y, size: 10 });
  y -= 32;

  row('Invoice No.', d.number);
  row('Date', d.date);
  if (d.periodLabel) row('Period', d.periodLabel);
  y -= 6;
  row('Supplier', d.supplierName);
  row('Supplier GSTIN', d.supplierGstin);
  row('Recipient', d.recipientName);
  if (d.recipientGstin) row('Recipient GSTIN', d.recipientGstin);
  row('Property', d.propertyName);
  row('Place of supply', d.placeOfSupply);
  row('SAC', d.hsnSac);
  y -= 6;
  row('Taxable value', inr(d.taxableMinor));
  if (d.interState) {
    row(`IGST @ ${ratePct}%`, inr(d.igstMinor));
  } else {
    const halfPct = (d.rateBps / 200).toFixed(d.rateBps % 200 === 0 ? 0 : 2);
    row(`CGST @ ${halfPct}%`, inr(d.cgstMinor));
    row(`SGST @ ${halfPct}%`, inr(d.sgstMinor));
  }
  row('Total tax', inr(d.totalTaxMinor));
  row('Invoice total', inr(d.grossMinor), { bold: true });

  y -= 10;
  lines.push({ text: 'Amount in words:', x: 56, y, size: 11, bold: true });
  y -= 18;
  lines.push({ text: amountInWordsINR(d.grossMinor), x: 56, y, size: 11 });

  y -= 56;
  lines.push({ text: 'This is a system-generated tax invoice from RentLedger.', x: 56, y, size: 9 });
  y -= 40;
  lines.push({ text: '_____________________________', x: 360, y, size: 11 });
  y -= 16;
  lines.push({ text: 'Authorised signatory', x: 360, y, size: 10 });

  return buildTextPdf(lines);
}
