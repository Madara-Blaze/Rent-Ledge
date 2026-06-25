/**
 * GST on commercial rent (India). All amounts are integer minor units (paise).
 *
 * Place-of-supply rule: if the supplier's state (first 2 digits of their GSTIN)
 * matches the place of supply (property's state code), the tax is split into
 * CGST + SGST; otherwise it is a single IGST. Each component is rounded half-up
 * to the nearest paisa independently, the standard GST rounding convention.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODE_RE = /^[0-9]{2}$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_RE.test(gstin.trim().toUpperCase());
}

/** First two digits of a GSTIN are the state code. */
export function stateCodeOfGstin(gstin: string): string {
  return gstin.trim().slice(0, 2);
}

export function isInterState(supplierGstin: string, placeOfSupplyStateCode: string): boolean {
  return stateCodeOfGstin(supplierGstin) !== placeOfSupplyStateCode.trim();
}

export interface GstBreakdown {
  taxableMinor: string;
  cgstMinor: string;
  sgstMinor: string;
  igstMinor: string;
  totalTaxMinor: string;
  grossMinor: string;
  rateBps: number;
  interState: boolean;
}

/** Round num/den half-up; den is expected even (10000) so den/2 is exact. */
function roundDiv(num: bigint, den: bigint): bigint {
  return (num + den / 2n) / den;
}

export function computeGst(params: {
  taxableMinor: string | bigint;
  rateBps: number;
  interState: boolean;
}): GstBreakdown {
  const taxable = BigInt(params.taxableMinor);
  if (taxable < 0n) throw new Error('Taxable value must be non-negative');
  if (!Number.isInteger(params.rateBps) || params.rateBps < 0) throw new Error('Invalid GST rate');

  const bps = BigInt(params.rateBps);
  let cgst = 0n;
  let sgst = 0n;
  let igst = 0n;

  if (params.interState) {
    igst = roundDiv(taxable * bps, 10_000n);
  } else {
    cgst = roundDiv(taxable * (bps / 2n), 10_000n);
    sgst = cgst; // symmetric split
  }

  const totalTax = cgst + sgst + igst;
  return {
    taxableMinor: taxable.toString(),
    cgstMinor: cgst.toString(),
    sgstMinor: sgst.toString(),
    igstMinor: igst.toString(),
    totalTaxMinor: totalTax.toString(),
    grossMinor: (taxable + totalTax).toString(),
    rateBps: params.rateBps,
    interState: params.interState,
  };
}

export { STATE_CODE_RE };
