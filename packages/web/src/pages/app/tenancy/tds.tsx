import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
  Banner,
  Card,
  Field,
  KeyValue,
  MoneyField,
  PageHeader,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatINR, rupeesToMinor, titleCase } from '@/lib/format';

interface Money {
  amountMinor: string;
}
interface TdsPreview {
  applicable: boolean;
  reason: string;
  section?: string;
  legacySection?: string;
  rateBps?: number;
  panSurchargeApplied?: boolean;
  base?: Money;
  amount?: Money;
  returnForm?: string;
  certificateForm?: string;
  filingDueDays?: number;
  deductionTiming?: string;
}

export function TdsPage() {
  return (
    <div>
      <PageHeader
        title="TDS preview"
        description="Tax deducted at source on rent (§194-IB / §194-I), computed from versioned jurisdiction policy."
      />
      <TenancyGate>{({ tenancyId }) => <TdsBody tenancyId={tenancyId} />}</TenancyGate>
    </div>
  );
}

function TdsBody({ tenancyId }: { tenancyId: string }) {
  const [annualRent, setAnnualRent] = useState('');
  const [asOf, setAsOf] = useState('');
  const [tds, setTds] = useState<TdsPreview | null>(null);
  const { busy, error, run } = useRun();

  const load = useCallback(
    async (id: string, annual?: string, date?: string) => {
      await run(async () => {
        const qs = new URLSearchParams({ tenancyId: id });
        if (annual) qs.set('annualRentMinor', annual);
        if (date) qs.set('asOf', date);
        setTds(await apiFetch<TdsPreview>(`/tax/tds/preview?${qs.toString()}`));
      });
    },
    [run],
  );

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  function recompute() {
    const annual = annualRent ? rupeesToMinor(annualRent) ?? undefined : undefined;
    void load(tenancyId, annual, asOf || undefined);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Parameters">
          <div className="space-y-3">
            <MoneyField label="Annual rent (optional)" value={annualRent} onChange={setAnnualRent} hint="Defaults to monthly rent × 12" />
            <Field label="As of date (optional)" type="date" value={asOf} onChange={setAsOf} hint="Drives the section-code mapping" />
            <Button variant="primary" size="sm" className="w-full" disabled={busy} onClick={recompute}>
              {busy ? 'Computing…' : 'Recompute'}
            </Button>
            {error && <p className="text-sm text-[#ff8f8f]">{error}</p>}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card
            title="Result"
            action={tds ? <Badge tone={tds.applicable ? 'green' : 'neutral'}>{tds.applicable ? 'Applicable' : 'Not applicable'}</Badge> : undefined}
          >
            {tds ? (
              <>
                <KeyValue
                  items={[
                    ['Section', tds.section ? `§${tds.section}` : '—'],
                    ...(tds.legacySection ? ([['Legacy section', `§${tds.legacySection}`]] as [string, string][]) : []),
                    ['Rate', tds.rateBps !== undefined ? `${tds.rateBps / 100}%` : '—'],
                    ['TDS base', formatINR(tds.base?.amountMinor)],
                    ['TDS amount', <span className="font-semibold text-white">{formatINR(tds.amount?.amountMinor)}</span>],
                    ['Return form', tds.returnForm ? `Form ${tds.returnForm}` : '—'],
                    ['Certificate', tds.certificateForm ? `Form ${tds.certificateForm}` : '—'],
                    ['Filing window', tds.filingDueDays !== undefined ? `${tds.filingDueDays} days` : '—'],
                    ['Deduction timing', tds.deductionTiming ? titleCase(tds.deductionTiming) : '—'],
                  ]}
                />
                <p className="mt-3 text-sm text-white/50">{tds.reason}</p>
                {tds.panSurchargeApplied && (
                  <div className="mt-3">
                    <Banner tone="red">Higher rate applied — landlord PAN is missing or invalid. Capture a valid PAN to reduce the rate.</Banner>
                  </div>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-white/30">Computing…</p>
            )}
          </Card>
        </div>
      </div>

      <Banner tone="amber">
        Not tax advice. TDS rates, thresholds and section codes come from versioned jurisdiction policy and require review by
        a qualified CA for your situation and date.
      </Banner>
    </div>
  );
}
