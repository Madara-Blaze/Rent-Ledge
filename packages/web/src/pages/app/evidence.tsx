import { Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Banner,
  Card,
  DataTable,
  ErrorText,
  Field,
  PageHeader,
  Pill,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch, downloadJson } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface EvidenceEntry {
  id: string;
  seq: string;
  entryType: string;
  summary: string;
  entryHash: string;
  createdAt: string;
}
interface Verification {
  valid: boolean;
  count: number;
  reason?: string;
  brokenAtSeq?: number;
}

export function EvidencePage() {
  const { landlordId, canManage } = useWorkspace();
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [summary, setSummary] = useState('');
  const append = useRun();
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setEntries(await apiFetch<EvidenceEntry[]>(`/workspaces/${landlordId}/evidence`).catch(() => []));
    setVerification(await apiFetch<Verification>(`/workspaces/${landlordId}/evidence/verify`).catch(() => null));
  }, [landlordId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Evidence vault" />
        <Banner tone="blue">The evidence vault is scoped to the landlord workspace.</Banner>
      </div>
    );
  }

  async function appendEntry() {
    const ok = await append.run(() =>
      apiFetch(`/workspaces/${landlordId}/evidence`, { method: 'POST', body: JSON.stringify({ entryType: 'NOTE', summary }) }),
    );
    if (ok) {
      setSummary('');
      await load();
    }
  }

  async function exportBundle() {
    setDownloading(true);
    try {
      await downloadJson(`/workspaces/${landlordId}/evidence/bundle`, 'rentledger-evidence-bundle.json');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Evidence vault"
        description="A tamper-evident, hash-chained log. Verify integrity and export a court-ready bundle."
        actions={
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => void exportBundle()}>
            <Download className="size-4" /> {downloading ? 'Preparing…' : 'Export bundle'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Chain integrity">
          {verification ? (
            <div className={`flex items-center gap-3 ${verification.valid ? 'text-emerald-400' : 'text-[#ff8f8f]'}`}>
              {verification.valid ? <ShieldCheck className="size-7" /> : <ShieldAlert className="size-7" />}
              <div>
                <p className="text-sm font-medium">{verification.valid ? 'Chain intact' : 'Integrity check failed'}</p>
                <p className="text-xs text-white/40">
                  {verification.count} entries
                  {verification.reason ? ` · ${verification.reason}` : ''}
                  {verification.brokenAtSeq ? ` · broke at #${verification.brokenAtSeq}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30">No evidence recorded yet.</p>
          )}
        </Card>

        {canManage && (
          <Card title="Append entry" className="lg:col-span-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Summary" value={summary} onChange={setSummary} placeholder="e.g. Move-in photos uploaded" />
              </div>
              <Button variant="primary" size="sm" disabled={append.busy || !summary} onClick={() => void appendEntry()}>
                {append.busy ? 'Appending…' : 'Append'}
              </Button>
            </div>
            <ErrorText>{append.error}</ErrorText>
            <p className="mt-2 text-xs text-white/30">Notices, payments and inspections are written here automatically.</p>
          </Card>
        )}
      </div>

      <Card title="Evidence log" className="mt-6">
        <DataTable
          columns={[
            { header: '#', render: (e: EvidenceEntry) => <span className="text-white/40">{e.seq}</span> },
            { header: 'Type', render: (e: EvidenceEntry) => <Pill>{titleCase(e.entryType)}</Pill> },
            { header: 'Summary', render: (e: EvidenceEntry) => <span className="text-white">{e.summary}</span> },
            { header: 'Hash', render: (e: EvidenceEntry) => <span className="font-mono text-xs text-white/40">{e.entryHash.slice(0, 14)}…</span> },
            { header: 'When', align: 'right', render: (e: EvidenceEntry) => formatDateTime(e.createdAt) },
          ]}
          rows={entries}
          keyOf={(e) => e.id}
          empty="No evidence entries yet."
        />
      </Card>
    </div>
  );
}
