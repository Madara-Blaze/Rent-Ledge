import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  PageHeader,
  StatusBadge,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch, downloadJson } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/format';

interface Consent {
  id: string;
  purpose: string;
  granted: boolean;
  granted_at: string | null;
  withdrawn_at: string | null;
}
interface DataRequest {
  id: string;
  type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const SUGGESTED_PURPOSES = ['rent_reminders', 'marketing_communications', 'whatsapp_notifications', 'data_analytics'];

export function PrivacyPage() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [exporting, setExporting] = useState(false);
  const consent = useRun();
  const erasure = useRun();

  const load = useCallback(async () => {
    setConsents(await apiFetch<Consent[]>('/me/consents').catch(() => []));
    setRequests(await apiFetch<DataRequest[]>('/me/requests').catch(() => []));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setConsent(p: string, granted: boolean) {
    const ok = await consent.run(() => apiFetch('/me/consents', { method: 'POST', body: JSON.stringify({ purpose: p, granted }) }));
    if (ok) {
      setPurpose('');
      await load();
    }
  }

  async function requestErasure() {
    const ok = await erasure.run(() => apiFetch('/me/erasure-request', { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) }));
    if (ok) {
      setReason('');
      await load();
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      await downloadJson('/me/data-export', 'rentledger-my-data.json');
    } finally {
      setExporting(false);
    }
  }

  // De-duplicate consents to the latest record per purpose.
  const latest = new Map<string, Consent>();
  for (const c of consents) if (!latest.has(c.purpose)) latest.set(c.purpose, c);

  return (
    <div>
      <PageHeader
        title="Privacy (DPDP)"
        description="Your rights under the Digital Personal Data Protection Act, 2023 — consent, access and erasure."
        actions={
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportData()}>
            <Download className="size-4" /> {exporting ? 'Preparing…' : 'Export my data'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Consents" description="Purpose-bound consent you can grant or withdraw at any time.">
          {latest.size === 0 ? (
            <Empty>No consent records yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {[...latest.values()].map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white">{titleCase(c.purpose)}</p>
                    <p className="text-xs text-white/40">
                      {c.granted ? `Granted ${formatDate(c.granted_at)}` : `Withdrawn ${formatDate(c.withdrawn_at)}`}
                    </p>
                  </div>
                  {c.granted ? (
                    <Button variant="ghost" size="sm" disabled={consent.busy} onClick={() => void setConsent(c.purpose, false)}>
                      Withdraw
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={consent.busy} onClick={() => void setConsent(c.purpose, true)}>
                      Grant
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-white/10 pt-4">
            <Field label="Add / update a purpose" value={purpose} onChange={setPurpose} placeholder="e.g. rent_reminders" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_PURPOSES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPurpose(p)}
                  className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/50 hover:text-white"
                >
                  {titleCase(p)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" disabled={consent.busy || !purpose} onClick={() => void setConsent(purpose, true)}>
                Grant
              </Button>
              <Button variant="outline" size="sm" disabled={consent.busy || !purpose} onClick={() => void setConsent(purpose, false)}>
                Withdraw
              </Button>
            </div>
            <ErrorText>{consent.error}</ErrorText>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Right to erasure" description="Request deletion of your data, subject to legal-retention limits.">
            <Textarea label="Reason (optional)" value={reason} onChange={setReason} rows={2} />
            <Button variant="outline" size="sm" className="mt-3" disabled={erasure.busy} onClick={() => void requestErasure()}>
              {erasure.busy ? 'Submitting…' : 'Request erasure'}
            </Button>
            <ErrorText>{erasure.error}</ErrorText>
          </Card>

          <Card title="My requests">
            <DataTable
              columns={[
                { header: 'Type', render: (r: DataRequest) => <Badge tone="blue">{titleCase(r.type)}</Badge> },
                { header: 'Status', render: (r: DataRequest) => <StatusBadge status={r.status} /> },
                { header: 'Requested', align: 'right', render: (r: DataRequest) => formatDate(r.created_at) },
              ]}
              rows={requests}
              keyOf={(r) => r.id}
              empty="No data-subject requests yet."
            />
          </Card>
        </div>
      </div>

      <Banner tone="neutral">
        <span className="mt-6 block">
          Erasure is a controlled, audited process that respects statutory retention windows (e.g. tax records). We'll confirm
          what can be deleted and when.
        </span>
      </Banner>
    </div>
  );
}
