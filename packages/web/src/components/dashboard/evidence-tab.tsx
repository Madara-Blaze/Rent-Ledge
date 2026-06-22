import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Field } from './primitives';

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
}

export function EvidenceTab({ landlordId, tenancyId }: { landlordId: string | null; tenancyId: string | null }) {
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (lid: string) => {
    setEntries(await apiFetch<EvidenceEntry[]>(`/workspaces/${lid}/evidence`).catch(() => []));
    setVerification(await apiFetch<Verification>(`/workspaces/${lid}/evidence/verify`).catch(() => null));
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  async function run(fn: () => Promise<unknown>) {
    if (!landlordId) return;
    setBusy(true);
    try {
      await fn();
      await load(landlordId);
    } finally {
      setBusy(false);
    }
  }

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  return (
    <div className="space-y-6">
      <Card title="Chain integrity">
        {verification ? (
          <div className={`flex items-center gap-3 ${verification.valid ? 'text-emerald-400' : 'text-[#ff6b6b]'}`}>
            {verification.valid ? <ShieldCheck className="size-6" /> : <ShieldAlert className="size-6" />}
            <div>
              <p className="text-sm font-medium">
                {verification.valid ? 'Tamper-evident chain is intact' : 'Chain integrity check failed'}
              </p>
              <p className="text-xs text-white/40">
                {verification.count} entries{verification.reason ? ` · ${verification.reason}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <Empty>No evidence recorded yet.</Empty>
        )}
      </Card>

      <Card title="Record evidence">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="Summary" value={summary} onChange={setSummary} placeholder="e.g. Move-in photos uploaded" />
          </div>
          <Button
            variant="primary"
            disabled={busy || !summary}
            onClick={() =>
              run(async () => {
                await apiFetch(`/workspaces/${landlordId}/evidence`, {
                  method: 'POST',
                  body: JSON.stringify({ entryType: 'NOTE', summary, tenancyId: tenancyId ?? undefined }),
                });
                setSummary('');
              })
            }
          >
            Append
          </Button>
        </div>
      </Card>

      <Card title="Evidence log">
        {entries.length === 0 ? (
          <Empty>No entries.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-white/90">
                    <span className="text-white/40">#{e.seq}</span> {e.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {titleCase(e.entryType)} · {e.entryHash.slice(0, 16)}…
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
