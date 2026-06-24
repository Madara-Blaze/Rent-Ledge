import { describe, expect, it } from 'vitest';
import { amountInWordsINR, buildRentReceiptPdf } from './receipt';

describe('amountInWordsINR (Indian numbering)', () => {
  it('formats whole rupees', () => {
    expect(amountInWordsINR('5500000')).toBe('Fifty Five Thousand Rupees Only');
    expect(amountInWordsINR('100000')).toBe('One Thousand Rupees Only');
    expect(amountInWordsINR('0')).toBe('Zero Rupees Only');
  });

  it('handles lakhs and crores', () => {
    expect(amountInWordsINR('1250000000')).toBe('One Crore Twenty Five Lakh Rupees Only'); // 1,25,00,000
    expect(amountInWordsINR('15000000')).toBe('One Lakh Fifty Thousand Rupees Only'); // 1,50,000
  });

  it('includes paise when present', () => {
    expect(amountInWordsINR('5500050')).toBe('Fifty Five Thousand Rupees and Fifty Paise Only');
  });
});

describe('buildRentReceiptPdf', () => {
  it('produces a structurally valid single-page PDF', () => {
    const pdf = buildRentReceiptPdf({
      receiptNo: 'RCPT-ABCD1234',
      date: '2026-06-24',
      landlordName: 'Asha Rao',
      landlordPan: 'ABCDE1234F',
      tenantName: 'Vikram Singh',
      propertyName: 'Lakeview Apartments',
      propertyAddress: '12 MG Road, Bengaluru',
      amountMinor: '5500000',
      method: 'UPI',
      periodLabel: '2026-06-01 to 2026-06-30',
      reference: 'TXN-99',
    });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type/Catalog');
    expect(text).toContain('startxref');
  });

  it('escapes parentheses in text so the content stream stays valid', () => {
    const pdf = buildRentReceiptPdf({
      receiptNo: 'RCPT-1',
      date: '2026-06-24',
      landlordName: 'Owner (Primary)',
      tenantName: 'Tenant',
      propertyName: 'Unit (A)',
      amountMinor: '100000',
      method: 'CASH',
    });
    const text = pdf.toString('latin1');
    expect(text).toContain('Owner \\(Primary\\)');
  });
});
