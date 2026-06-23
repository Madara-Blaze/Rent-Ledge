import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
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
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Notice {
  id: string;
  type: string;
  subject: string;
  body: string;
  effectiveDate: string | null;
  minNoticeDays: number;
  status: string;
  createdAt: string;
}
interface DeliveryReceipt {
  id: string;
  channel: string;
  status: string;
  providerRef: string | null;
}
interface NoticeDetail extends Notice {
  deliveryReceipts: DeliveryReceipt[];
}

const NOTICE_TYPES = ['RENT_REMINDER', 'PAYMENT_DEFAULT', 'RENT_INCREASE', 'RENEWAL_OFFER', 'TERMINATION', 'DEPOSIT_DEDUCTION', 'EVICTION'];
const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];

export function NoticesPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Notices"
        description="Typed legal notices with jurisdiction-aware notice periods, written to the evidence vault on send."
      />
      <TenancyGate>{({ tenancyId }) => <NoticesBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function NoticesBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [type, setType] = useState('RENT_REMINDER');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [sendFor, setSendFor] = useState<Notice | null>(null);
  const [channel, setChannel] = useState('EMAIL');

  const create = useRun();
  const send = useRun();

  const load = useCallback(async (id: string) => {
    setItems(await apiFetch<Notice[]>(`/tenancies/${id}/notices`).catch(() => []));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  async function createNotice() {
    const ok = await create.run(async () => {
      await apiFetch('/notices', {
        method: 'POST',
        body: JSON.stringify({ tenancyId, type, subject, body: bodyText || subject, effectiveDate: effectiveDate || undefined }),
      });
    });
    if (ok) {
      setSubject('');
      setBodyText('');
      setEffectiveDate('');
      await load(tenancyId);
    }
  }

  async function doSend() {
    if (!sendFor) return;
    const ok = await send.run(async () => {
      await apiFetch(`/notices/${sendFor.id}/send`, { method: 'POST', body: JSON.stringify({ channel }) });
    });
    if (ok) {
      setSendFor(null);
      await load(tenancyId);
    }
  }

  async function openDetail(id: string) {
    setDetail(await apiFetch<NoticeDetail>(`/notices/${id}`).catch(() => null));
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card title="Draft a notice">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Type" value={type} onChange={setType} options={NOTICE_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
            <Field label="Effective date (optional)" type="date" value={effectiveDate} onChange={setEffectiveDate} />
            <div className="sm:col-span-2">
              <Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Rent due reminder for July" />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Body" value={bodyText} onChange={setBodyText} rows={3} placeholder="Notice contents (defaults to the subject)" />
            </div>
          </div>
          <ErrorText>{create.error}</ErrorText>
          <Button variant="primary" size="sm" className="mt-4" disabled={create.busy || !subject} onClick={() => void createNotice()}>
            {create.busy ? 'Saving…' : 'Create draft'}
          </Button>
        </Card>
      )}

      <Card title="Notices">
        <DataTable
          columns={[
            { header: 'Subject', render: (n: Notice) => <span className="text-white">{n.subject}</span> },
            { header: 'Type', render: (n: Notice) => <Badge tone="blue">{titleCase(n.type)}</Badge> },
            { header: 'Notice period', render: (n: Notice) => (n.minNoticeDays > 0 ? `${n.minNoticeDays} days` : '—') },
            { header: 'Status', render: (n: Notice) => <StatusBadge status={n.status} /> },
            {
              header: '',
              align: 'right',
              render: (n: Notice) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void openDetail(n.id)}>
                    Detail
                  </Button>
                  {canManage && n.status === 'DRAFT' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChannel('EMAIL');
                        setSendFor(n);
                      }}
                    >
                      Send
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          rows={items}
          keyOf={(n) => n.id}
          empty="No notices yet."
        />
      </Card>

      {/* Send confirm */}
      <Modal
        open={sendFor !== null}
        onClose={() => setSendFor(null)}
        title="Send notice"
        description="The statutory notice window is enforced. The notice is written to the evidence vault and dispatched."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSendFor(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={send.busy} onClick={() => void doSend()}>
              {send.busy ? 'Sending…' : 'Confirm send'}
            </Button>
          </>
        }
      >
        {sendFor && (
          <>
            <p className="text-sm text-white/60">
              <span className="text-white">{titleCase(sendFor.type)}</span> — “{sendFor.subject}”
              {sendFor.minNoticeDays > 0 && ` · minimum ${sendFor.minNoticeDays} days notice`}
            </p>
            <Select label="Channel" value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c, label: titleCase(c) }))} />
            <ErrorText>{send.error}</ErrorText>
          </>
        )}
      </Modal>

      {/* Detail */}
      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.subject ?? 'Notice'} description={detail ? titleCase(detail.type) : ''}>
        {detail && (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detail.status} />
              {detail.effectiveDate && <Pill>Effective {formatDate(detail.effectiveDate)}</Pill>}
              {detail.minNoticeDays > 0 && <Pill>{detail.minNoticeDays}d notice</Pill>}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{detail.body}</p>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Delivery receipts</p>
              {detail.deliveryReceipts.length === 0 ? (
                <Empty>Not dispatched yet.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {detail.deliveryReceipts.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                      <span className="text-white/70">{titleCase(r.channel)}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-white/30">Created {formatDateTime(detail.createdAt)}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
