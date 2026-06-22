import { Injectable } from '@nestjs/common';
import { StampDutyProvider, StampDutyRequest, StampDutyResult } from './stamp-duty.adapter';

/**
 * Indicative India stamp duty (~0.25% of annual rent). This is a placeholder for
 * the real, state-specific schedule and MUST be verified per state before use.
 */
@Injectable()
export class IndiaStampDutyProvider implements StampDutyProvider {
  compute(req: StampDutyRequest): StampDutyResult {
    const amountMinor = (req.annualRentMinor * 25n) / 10_000n; // 0.25%
    return {
      amountMinor,
      basis: '0.25% of annual rent (indicative — verify the applicable state schedule)',
    };
  }
}
