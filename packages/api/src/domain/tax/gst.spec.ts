import { describe, expect, it } from 'vitest';
import { computeGst, isInterState, isValidGstin, stateCodeOfGstin } from './gst';

describe('GST computation', () => {
  it('splits intra-state supply into equal CGST + SGST', () => {
    const g = computeGst({ taxableMinor: '5500000', rateBps: 1800, interState: false }); // ₹55,000 @ 18%
    expect(g.cgstMinor).toBe('495000'); // ₹4,950 (9%)
    expect(g.sgstMinor).toBe('495000');
    expect(g.igstMinor).toBe('0');
    expect(g.totalTaxMinor).toBe('990000'); // ₹9,900
    expect(g.grossMinor).toBe('6490000'); // ₹64,900
  });

  it('charges a single IGST for inter-state supply', () => {
    const g = computeGst({ taxableMinor: '5500000', rateBps: 1800, interState: true });
    expect(g.cgstMinor).toBe('0');
    expect(g.sgstMinor).toBe('0');
    expect(g.igstMinor).toBe('990000');
    expect(g.grossMinor).toBe('6490000');
  });

  it('rounds each component half-up to the nearest paisa', () => {
    // taxable ₹1,001.11 = 100111 paise @ 18%: igst = round(100111*1800/10000)=round(18019.98)=18020
    const g = computeGst({ taxableMinor: '100111', rateBps: 1800, interState: true });
    expect(g.igstMinor).toBe('18020');
    // intra: half = 900 bps → round(100111*900/10000)=round(9009.99)=9010 each
    const intra = computeGst({ taxableMinor: '100111', rateBps: 1800, interState: false });
    expect(intra.cgstMinor).toBe('9010');
    expect(intra.sgstMinor).toBe('9010');
  });

  it('handles zero taxable value', () => {
    const g = computeGst({ taxableMinor: '0', rateBps: 1800, interState: false });
    expect(g.totalTaxMinor).toBe('0');
    expect(g.grossMinor).toBe('0');
  });

  it('rejects negative taxable values', () => {
    expect(() => computeGst({ taxableMinor: '-1', rateBps: 1800, interState: true })).toThrow();
  });
});

describe('GSTIN helpers', () => {
  it('validates GSTIN format', () => {
    expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true);
    expect(isValidGstin('29abcde1234f1z5')).toBe(true); // case-insensitive
    expect(isValidGstin('ABCDE1234F1Z5')).toBe(false); // too short
    expect(isValidGstin('299BCDE1234F1Z5')).toBe(false); // bad PAN block
  });

  it('derives state code and inter-state status', () => {
    expect(stateCodeOfGstin('29ABCDE1234F1Z5')).toBe('29');
    expect(isInterState('29ABCDE1234F1Z5', '29')).toBe(false); // Karnataka → Karnataka
    expect(isInterState('29ABCDE1234F1Z5', '27')).toBe(true); // Karnataka → Maharashtra
  });
});
