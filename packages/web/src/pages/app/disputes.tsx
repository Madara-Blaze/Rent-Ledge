import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  Modal,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch, downloadJson } from '@/lib/api';
import { formatDate, formatDateTime, shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Dispute {
  id: string;
  tenancyId: string | null;
  title: string;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
}
interface EvidenceEntry {
  id: string;
  seq: string;
  entryType: string;
  summary: string;
  createdAt: string;
}

const DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'];

export function DisputesPage() {
  const { landlordId, canManage, selectedTenancyId } = useWorkspace();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [title, setTitle] = useState('');
  const [linkTenancy, setLinkTenancy] = useState(true);
  const [detail, setDetail] = useState<Dispute | null>(null);
  const create = useRun();

  const load = useCallback(async () => {
    if (!landlordId) return;
    setDisputes(await apiFetch<Dispute[]>(`/workspaces/${landlordId}/disputes`).catch(() => []));
  }, [landlordId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Disputes" />
        <Banner tone="blue">Dispute cases are scoped to the landlord workspace.</Banner>
      </div>
    );
  }

  async function createDispute() {
    const ok = await create.run(() =>
      apiFetch(`/workspaces/${landlordId}/disputes`, {
        method: 'POST',
        body: JSON.stringify({ title, tenancyId: linkTenancy && selectedTenancyId ? selectedTenancyId : undefined }),
      }),
    );
    if (ok) {
      setTitle('');
      await load();
    }
  }

  return (
    <div>
      <PageHeader title="Disputes" description="Dispute cases link evidence and resolution. Opening a case writes to the evidence vault." />

      <Banner tone="amber">
        For legal threats, eviction, fraud or anything heading to a Rent Authority / tribunal: summarise the facts, attach
        the evidence bundle, and route to the owner and qualified counsel. RentLedger organises the record — it is not legal advice.
      </Banner>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {canManage && (
          <Card title="Open a dispute">
            <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Deposit deduction contested" />
            {selectedTenancyId && (
              <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={linkTenancy} onChange={(e) => setLinkTenancy(e.target.checked)} className="accent-[#FF0000]" />
                Link to the selected tenancy
              </label>
            )}
            <Button variant="primary" size="sm" className="mt-4 w-full" disabled={create.busy || !title} onClick={() => void createDispute()}>
              {create.busy ? 'Opening…' : 'Open dispute'}
            </Button>
            <ErrorText>{create.error}</ErrorText>
          </Card>
        )}

        <div className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Card title="Dispute cases">
            <DataTable
              columns={[
                { header: 'Title', render: (d: Dispute) => <span className="text-white">{d.title}</span> },
                { header: 'Tenancy', render: (d: Dispute) => (d.tenancyId ? shortId(d.tenancyId) : '—') },
                { header: 'Status', render: (d: Dispute) => <StatusBadge status={d.status} /> },
                { header: 'Opened', render: (d: Dispute) => formatDate(d.createdAt) },
                {
                  header: '',
                  align: 'right',
                  render: (d: Dispute) => (
                    <Button variant="outline" size="sm" onClick={() => setDetail(d)}>
                      Open
                    </Button>
                  ),
                },
              ]}
              rows={disputes}
              keyOf={(d) => d.id}
              empty="No disputes open."
            />
          </Card>
        </div>
      </div>

      {detail && (
        <DisputeDetailModal
          dispute={detail}
          landlordId={landlordId}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onUpdated={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

function DisputeDetailModal({
  dispute,
  landlordId,
  canManage,
  onClose,
  onUpdated,
}: {
  dispute: Dispute;
  landlordId: string;
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [status, setStatus] = useState(dispute.status);
  const [notes, setNotes] = useState(dispute.resolutionNotes ?? '');
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const { busy, error, run } = useRun();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void (async () => {
      setEvidence(await apiFetch<EvidenceEntry[]>(`/workspaces/${landlordId}/evidence?disputeCaseId=${dispute.id}`).catch(() => []));
    })();
  }, [landlordId, dispute.id]);

  async function save() {
    const ok = await run(() =>
      apiFetch(`/workspaces/${landlordId}/disputes/${dispute.id}`, {
        method: 'POST',
        body: JSON.stringify({ status, resolutionNotes: notes || undefined }),
      }),
    );
    if (ok) {
      await onUpdated();
      onClose();
    }
  }

  async function exportBundle() {
    setDownloading(true);
    try {
      await downloadJson(`/workspaces/${landlordId}/evidence/bundle?disputeCaseId=${dispute.id}`, `dispute-${shortId(dispute.id)}-bundle.json`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={dispute.title}
      description={`Opened ${formatDate(dispute.createdAt)}`}
      footer={
        canManage ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {canManage ? (
        <>
          <Select label="Status" value={status} onChange={setStatus} options={DISPUTE_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
          <Textarea label="Resolution notes" value={notes} onChange={setNotes} rows={3} />
          <ErrorText>{error}</ErrorText>
        </>
      ) : (
        <StatusBadge status={dispute.status} />
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-white/40">Linked evidence</p>
          <Button variant="ghost" size="sm" disabled={downloading} onClick={() => void exportBundle()}>
            <Download className="size-4" /> {downloading ? 'Preparing…' : 'Bundle'}
          </Button>
        </div>
        {evidence.length === 0 ? (
          <Empty>No evidence linked to this dispute.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {evidence.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <span className="text-white/80">
                  <span className="text-white/40">#{e.seq}</span> {e.summary}
                </span>
                <div className="flex items-center gap-2">
                  <Pill>{titleCase(e.entryType)}</Pill>
                  <span className="text-xs text-white/30">{formatDateTime(e.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
