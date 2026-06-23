import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  ErrorText,
  Field,
  Modal,
  PageHeader,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface PolicyRow {
  id: string;
  jurisdiction: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  reviewed_by_counsel: boolean;
  created_at: string;
}

const SAMPLE_BODY = `{
  "tds": { "rateBps": 200, "thresholdMonthlyMinor": "5000000" },
  "deposit": { "maxMonths": 2 },
  "noticePeriods": { "terminationDays": 30 },
  "registration": { "defaultTermMonths": 11, "registrationThresholdMonths": 11 }
}`;

export function AdminPoliciesPage() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [show, setShow] = useState(false);

  const [jurisdiction, setJurisdiction] = useState('IN-MH');
  const [version, setVersion] = useState('1');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [body, setBody] = useState(SAMPLE_BODY);
  const create = useRun();

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<PolicyRow[]>('/admin/policies'));
      setForbidden(false);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setForbidden(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPolicy() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      create.setError('Body must be valid JSON.');
      return;
    }
    const ok = await create.run(() =>
      apiFetch('/admin/policies', {
        method: 'POST',
        body: JSON.stringify({
          jurisdiction,
          version: Number(version),
          effectiveFrom,
          effectiveTo: effectiveTo || undefined,
          reviewedByCounsel: reviewed,
          body: parsed,
        }),
      }),
    );
    if (ok) {
      setShow(false);
      await load();
    }
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Jurisdiction policies" />
        <Banner tone="red">Platform administrator access is required to manage jurisdiction policies.</Banner>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Jurisdiction policies"
        description="Versioned, effective-dated statutory data: TDS rates, deposit caps, notice periods and registration triggers."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShow(true)}>
            New policy version
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={[
            { header: 'Jurisdiction', render: (p: PolicyRow) => <span className="font-mono text-white">{p.jurisdiction}</span> },
            { header: 'Version', render: (p: PolicyRow) => `v${p.version}` },
            { header: 'Effective', render: (p: PolicyRow) => `${formatDate(p.effective_from)}${p.effective_to ? ` → ${formatDate(p.effective_to)}` : ''}` },
            {
              header: 'Counsel review',
              render: (p: PolicyRow) => (p.reviewed_by_counsel ? <Badge tone="green">Reviewed</Badge> : <Badge tone="amber">Not reviewed</Badge>),
            },
          ]}
          rows={rows}
          keyOf={(p) => p.id}
          empty="No policies configured."
        />
      </Card>

      <Banner tone="amber">
        <span className="mt-6 block">
          Shipped India defaults are flagged not-yet-counsel-reviewed. Rates and thresholds require certification by qualified
          counsel for the applicable jurisdiction before real-world use.
        </span>
      </Banner>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="New policy version"
        description="Add a versioned, effective-dated jurisdiction policy."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={create.busy || !effectiveFrom} onClick={() => void createPolicy()}>
              {create.busy ? 'Saving…' : 'Create policy'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jurisdiction" value={jurisdiction} onChange={setJurisdiction} placeholder="IN-MH" />
          <Field label="Version" type="number" value={version} onChange={setVersion} />
          <Field label="Effective from" type="date" value={effectiveFrom} onChange={setEffectiveFrom} />
          <Field label="Effective to (optional)" type="date" value={effectiveTo} onChange={setEffectiveTo} />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="accent-[#FF0000]" />
          Reviewed by counsel
        </label>
        <Textarea label="Policy body (JSON)" value={body} onChange={setBody} rows={8} />
        <ErrorText>{create.error}</ErrorText>
      </Modal>
    </div>
  );
}
