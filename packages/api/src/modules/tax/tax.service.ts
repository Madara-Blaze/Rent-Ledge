import { Injectable } from '@nestjs/common';
import { moneyToDto } from '../../common/money.util';
import { Money } from '../../domain/money/money';
import { determineTds } from '../../domain/rules/tds';
import { PolicyService } from '../policy/policy.service';
import { TenancyRepository } from '../tenancy/tenancy.repository';
import { TdsPreviewDto } from './tax.dto';

@Injectable()
export class TaxService {
  constructor(
    private readonly tenancyRepo: TenancyRepository,
    private readonly policy: PolicyService,
  ) {}

  /** Dry-run the TDS determination for a tenancy (no writes). */
  async previewTds(tenancyId: string, annualRentMinor?: string, asOfStr?: string): Promise<TdsPreviewDto> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(tenancyId);
    const ctx = await this.tenancyRepo.getTaxContext(tenancyId);
    const asOf = asOfStr ? new Date(`${asOfStr}T00:00:00Z`) : new Date();
    const policy = await this.policy.resolve(tenancy.jurisdiction, asOf);

    const monthly = Money.of(tenancy.rentMinor, tenancy.currency);
    const annual = annualRentMinor ? Money.of(annualRentMinor, tenancy.currency) : monthly.multiplyInt(12);

    const r = determineTds({
      payerClass: ctx.payerClass,
      monthlyRent: monthly,
      annualRent: annual,
      landlordPanValid: ctx.landlordPanValid,
      policy,
      asOf,
    });

    return {
      applicable: r.applicable,
      reason: r.reason,
      section: r.section,
      legacySection: r.legacySection,
      rateBps: r.rateBps,
      panSurchargeApplied: r.panSurchargeApplied,
      base: r.base ? moneyToDto(r.base) : undefined,
      amount: r.amount ? moneyToDto(r.amount) : undefined,
      returnForm: r.returnForm,
      certificateForm: r.certificateForm,
      filingDueDays: r.filingDueDays,
      deductionTiming: r.deductionTiming,
    };
  }
}
