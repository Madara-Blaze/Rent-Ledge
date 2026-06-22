/**
 * Stamp-duty port. State stamp-duty schedules vary widely; a live provider (or an
 * e-stamp integration) plugs in here. The mock returns an indicative figure.
 */
export const STAMP_DUTY_PROVIDER = Symbol('STAMP_DUTY_PROVIDER');

export interface StampDutyRequest {
  jurisdiction: string;
  annualRentMinor: bigint;
  depositMinor: bigint;
  termMonths: number;
}

export interface StampDutyResult {
  amountMinor: bigint;
  basis: string;
}

export interface StampDutyProvider {
  compute(req: StampDutyRequest): StampDutyResult;
}
