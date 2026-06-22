import { JurisdictionPolicy } from '../policy/jurisdiction-policy';

/**
 * Stamp-duty / registration awareness, driven by jurisdiction policy.
 * In India a lease term over 11 months triggers compulsory registration under
 * the Registration Act; MTA-adopting states also require filing with the Rent
 * Authority within a statutory window. All thresholds come from policy data.
 */
export interface RegistrationAssessment {
  registrationRequired: boolean;
  reason: string;
  defaultTermMonths: number;
  rentAuthorityRequired: boolean;
  rentAuthorityFilingDays?: number;
}

export function assessRegistration(termMonths: number, policy: JurisdictionPolicy): RegistrationAssessment {
  const threshold = policy.registration.registrationRequiredAboveMonths;
  const registrationRequired = termMonths > threshold;
  const filingDays = policy.registration.rentAuthorityFilingDays;

  return {
    registrationRequired,
    reason: registrationRequired
      ? `Term of ${termMonths} months exceeds ${threshold} → registration required under the Registration Act`
      : `Term of ${termMonths} months is within ${threshold} → registration not required`,
    defaultTermMonths: policy.registration.defaultTermMonths,
    rentAuthorityRequired: (filingDays ?? 0) > 0,
    rentAuthorityFilingDays: filingDays,
  };
}
