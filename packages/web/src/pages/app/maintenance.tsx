import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  Modal,
  MoneyField,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDateTime, formatINR, rupeesToMinor, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Vendor {
  id: string;
  name: string;
  contact: string | null;
  category: string | null;
  rating: number | null;
}
interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  costBearer: string;
}
interface TicketEvent {
  id: string;
  type: string;
  note: string | null;
  createdAt: string;
}
interface TicketDetail extends Ticket {
  description: string | null;
  costMinor: string;
  assignedVendorId: string | null;
  events: TicketEvent[];
}

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const BEARERS = ['LANDLORD', 'TENANT', 'SPLIT'];

export function MaintenancePage() {
  const { landlordId, canManage, selectedTenancyId, selectedTenancy } = useWorkspace();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [showVendor, setShowVendor] = useState(false);

  // create ticket
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  const createTicket = useRun();
  // create vendor
  const [vName, setVName] = useState('');
  const [vContact, setVContact] = useState('');
  const [vCategory, setVCategory] = useState('');
  const createVendor = useRun();

  const load = useCallback(async () => {
    if (!landlordId) return;
    setTickets(await apiFetch<Ticket[]>(`/workspaces/${landlordId}/maintenance/tickets`).catch(() => []));
    setVendors(await apiFetch<Vendor[]>(`/workspaces/${landlordId}/vendors`).catch(() => []));
  }, [landlordId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function raiseTicket() {
    if (!selectedTenancyId) return;
    const ok = await createTicket.run(() =>
      apiFetch(`/tenancies/${selectedTenancyId}/maintenance/tickets`, {
        method: 'POST',
        body: JSON.stringify({ title, priority, description: description || undefined }),
      }),
    );
    if (ok) {
      setTitle('');
      setDescription('');
      await load();
    }
  }

  async function addVendor() {
    if (!landlordId) return;
    const ok = await createVendor.run(() =>
      apiFetch(`/workspaces/${landlordId}/vendors`, {
        method: 'POST',
        body: JSON.stringify({ name: vName, contact: vContact || undefined, category: vCategory || undefined }),
      }),
    );
    if (ok) {
      setShowVendor(false);
      setVName('');
      setVContact('');
      setVCategory('');
      await load();
    }
  }

  async function openDetail(id: string) {
    setDetail(await apiFetch<TicketDetail>(`/maintenance/tickets/${id}`).catch(() => null));
  }

  // Tenant-only view: create-only (no workspace ticket list access).
  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Maintenance" description="Raise a maintenance request for your tenancy." />
        <Card title="Raise a ticket">
          {selectedTenancyId ? (
            <>
              <div className="space-y-3">
                <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Leaking tap in kitchen" />
                <Select label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))} />
                <Textarea label="Description" value={description} onChange={setDescription} rows={3} />
                <Button variant="primary" size="sm" disabled={createTicket.busy || !title} onClick={() => void raiseTicket()}>
                  {createTicket.busy ? 'Submitting…' : 'Submit ticket'}
                </Button>
                <ErrorText>{createTicket.error}</ErrorText>
              </div>
              <p className="mt-3 text-xs text-white/30">Your landlord manages and resolves tickets from their workspace.</p>
            </>
          ) : (
            <Empty>Select a tenancy first.</Empty>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Tickets and vendor directory. Tenant-borne costs charge back to the ledger automatically on resolution."
        actions={
          canManage ? (
            <Button variant="outline" size="sm" onClick={() => setShowVendor(true)}>
              <Plus className="size-4" /> Vendor
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Raise a ticket">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Leaking tap in kitchen" />
              <Select label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))} />
            </div>
            <p className="mt-2 text-xs text-white/35">
              Attaches to {selectedTenancy ? selectedTenancy.propertyName : 'the selected tenancy'}.
            </p>
            <Button variant="primary" size="sm" className="mt-3" disabled={createTicket.busy || !title || !selectedTenancyId} onClick={() => void raiseTicket()}>
              {createTicket.busy ? 'Creating…' : 'Create ticket'}
            </Button>
            <ErrorText>{createTicket.error}</ErrorText>
          </Card>

          <Card title="Tickets">
            <DataTable
              columns={[
                { header: 'Title', render: (t: Ticket) => <span className="text-white">{t.title}</span> },
                { header: 'Priority', render: (t: Ticket) => <Badge tone={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'red' : 'neutral'}>{titleCase(t.priority)}</Badge> },
                { header: 'Status', render: (t: Ticket) => <StatusBadge status={t.status} /> },
                {
                  header: '',
                  align: 'right',
                  render: (t: Ticket) => (
                    <Button variant="outline" size="sm" onClick={() => void openDetail(t.id)}>
                      Open
                    </Button>
                  ),
                },
              ]}
              rows={tickets}
              keyOf={(t) => t.id}
              empty="No maintenance tickets."
            />
          </Card>
        </div>

        <Card title="Vendor directory">
          {vendors.length === 0 ? (
            <Empty>No vendors yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {vendors.map((v) => (
                <li key={v.id} className="rounded-lg border border-white/10 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{v.name}</span>
                    {v.rating != null && <Pill>★ {v.rating}</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">
                    {[v.category && titleCase(v.category), v.contact].filter(Boolean).join(' · ') || '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {detail && (
        <TicketDetailModal
          detail={detail}
          vendors={vendors}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onUpdated={async () => {
            await openDetail(detail.id);
            await load();
          }}
        />
      )}

      <Modal
        open={showVendor}
        onClose={() => setShowVendor(false)}
        title="Add vendor"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowVendor(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={createVendor.busy || !vName} onClick={() => void addVendor()}>
              {createVendor.busy ? 'Adding…' : 'Add vendor'}
            </Button>
          </>
        }
      >
        <Field label="Name" value={vName} onChange={setVName} placeholder="e.g. CoolAir HVAC" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact" value={vContact} onChange={setVContact} placeholder="Phone / email" />
          <Field label="Category" value={vCategory} onChange={setVCategory} placeholder="e.g. Plumbing" />
        </div>
        <ErrorText>{createVendor.error}</ErrorText>
      </Modal>
    </div>
  );
}

function TicketDetailModal({
  detail,
  vendors,
  canManage,
  onClose,
  onUpdated,
}: {
  detail: TicketDetail;
  vendors: Vendor[];
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [status, setStatus] = useState(detail.status);
  const [priority, setPriority] = useState(detail.priority);
  const [vendorId, setVendorId] = useState(detail.assignedVendorId ?? '');
  const [cost, setCost] = useState('');
  const [bearer, setBearer] = useState(detail.costBearer);
  const [note, setNote] = useState('');
  const { busy, error, run } = useRun();

  async function save() {
    const costMinor = cost ? rupeesToMinor(cost) ?? undefined : undefined;
    const ok = await run(() =>
      apiFetch(`/maintenance/tickets/${detail.id}`, {
        method: 'POST',
        body: JSON.stringify({
          status: status !== detail.status ? status : undefined,
          priority: priority !== detail.priority ? priority : undefined,
          assignedVendorId: vendorId || undefined,
          costMinor,
          costBearer: bearer !== detail.costBearer ? bearer : undefined,
          note: note || undefined,
        }),
      }),
    );
    if (ok) {
      setCost('');
      setNote('');
      await onUpdated();
    }
  }

  const willChargeback = status === 'RESOLVED' && bearer === 'TENANT' && (cost ? Number(cost) > 0 : Number(detail.costMinor) > 0);

  return (
    <Modal open onClose={onClose} title={detail.title} description={detail.description ?? undefined}>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={detail.status} />
        <Badge tone="neutral">{titleCase(detail.priority)}</Badge>
        {detail.category && <Pill>{titleCase(detail.category)}</Pill>}
        <Pill>Cost {formatINR(detail.costMinor)}</Pill>
        <Pill>Bearer {titleCase(detail.costBearer)}</Pill>
      </div>

      {canManage && (
        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/40">Update</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
            <Select label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))} />
            <Select
              label="Assign vendor"
              value={vendorId}
              onChange={setVendorId}
              options={[{ value: '', label: 'Unassigned' }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
            />
            <Select label="Cost bearer" value={bearer} onChange={setBearer} options={BEARERS.map((b) => ({ value: b, label: titleCase(b) }))} />
            <MoneyField label="Cost" value={cost} onChange={setCost} />
            <Field label="Note" value={note} onChange={setNote} placeholder="Timeline note" />
          </div>
          {willChargeback && (
            <div className="mt-3">
              <Banner tone="amber">Resolving with a tenant-borne cost will charge it back to the tenant ledger.</Banner>
            </div>
          )}
          <Button variant="primary" size="sm" className="mt-3" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save update'}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Timeline</p>
        {detail.events.length === 0 ? (
          <Empty>No events.</Empty>
        ) : (
          <ul className="space-y-2">
            {detail.events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                <div>
                  <p className="text-sm text-white/80">{titleCase(e.type)}</p>
                  {e.note && <p className="text-xs text-white/40">{e.note}</p>}
                </div>
                <span className="shrink-0 text-xs text-white/30">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
