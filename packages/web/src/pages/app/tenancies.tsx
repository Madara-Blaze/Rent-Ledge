import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  KeyValue,
  Modal,
  MoneyField,
  PageHeader,
  Select,
  StatusBadge,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINR, rupeesToMinor, shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface TenancyDetail {
  id: string;
  propertyId: string;
  status: string;
  rentMinor: string;
  depositMinor: string;
  billingDay: number;
  startDate: string;
  jurisdiction: string;
  currency: string;
  noticeDate: string | null;
  endedAt: string | null;
  endReason: string | null;
}
interface Invitation {
  id: string;
  tenancyId: string;
  email: string | null;
  phone: string | null;
  status: string;
  expiresAt: string;
}

const PAYER_CLASSES = ['INDIVIDUAL_HUF', 'COMPANY_FIRM_AUDITED', 'OTHER'];

// Mirrors the backend lifecycle guard so we only offer valid transitions.
const TRANSITIONS: { action: string; from: string[]; owner?: boolean; destructive?: boolean }[] = [
  { action: 'ISSUE_AGREEMENT', from: ['DRAFT'] },
  { action: 'ACTIVATE', from: ['DRAFT', 'AGREEMENT_PENDING'] },
  { action: 'START_NOTICE', from: ['ACTIVE'] },
  { action: 'RENEW', from: ['ACTIVE', 'NOTICE_PERIOD'] },
  { action: 'END', from: ['ACTIVE', 'NOTICE_PERIOD'], destructive: true },
  { action: 'TERMINATE', from: ['ACTIVE', 'NOTICE_PERIOD'], owner: true, destructive: true },
  { action: 'EVICT', from: ['ACTIVE', 'NOTICE_PERIOD'], owner: true, destructive: true },
];

export function TenanciesPage() {
  const { landlordId, canManage, canOwn, properties, tenancies, reloadTenancies, selectedTenancyId, setSelectedTenancyId } =
    useWorkspace();
  const [detail, setDetail] = useState<TenancyDetail | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  // create form
  const [propertyId, setPropertyId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [payerClass, setPayerClass] = useState('INDIVIDUAL_HUF');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const createForm = useRun();

  // transition confirm
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const transition = useRun();
  const invite = useRun();
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');

  const loadDetail = useCallback(async (id: string) => {
    setDetail(await apiFetch<TenancyDetail>(`/tenancies/${id}`).catch(() => null));
  }, []);

  const loadInvitations = useCallback(async () => {
    if (!landlordId) return;
    setInvitations(await apiFetch<Invitation[]>(`/workspaces/${landlordId}/invitations`).catch(() => []));
  }, [landlordId]);

  useEffect(() => {
    if (selectedTenancyId) void loadDetail(selectedTenancyId);
  }, [selectedTenancyId, loadDetail]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Tenancies" />
        <Banner tone="blue">Tenancies are created and managed by the landlord workspace.</Banner>
      </div>
    );
  }

  async function createTenancy() {
    const rentMinor = rupeesToMinor(rent);
    if (!rentMinor) {
      createForm.setError('Enter a valid monthly rent.');
      return;
    }
    const depositMinor = deposit ? rupeesToMinor(deposit) : '0';
    if (deposit && depositMinor === null) {
      createForm.setError('Enter a valid deposit amount.');
      return;
    }
    const ok = await createForm.run(async () => {
      await apiFetch(`/workspaces/${landlordId}/tenancies`, {
        method: 'POST',
        body: JSON.stringify({
          propertyId,
          tenantName,
          tenantEmail: tenantEmail || undefined,
          tenantPhone: tenantPhone || undefined,
          payerClass,
          rentMinor,
          depositMinor: depositMinor ?? '0',
          billingDay: Number(billingDay),
          startDate,
          endDate: endDate || undefined,
        }),
      });
    });
    if (ok) {
      setShowCreate(false);
      setPropertyId('');
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
      setRent('');
      setDeposit('');
      setStartDate('');
      setEndDate('');
      await reloadTenancies();
    }
  }

  async function runTransition() {
    if (!pendingAction || !selectedTenancyId) return;
    const ok = await transition.run(async () => {
      await apiFetch(`/tenancies/${selectedTenancyId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action: pendingAction, reason: reason || undefined }),
      });
    });
    if (ok) {
      setPendingAction(null);
      setReason('');
      await Promise.all([reloadTenancies(), loadDetail(selectedTenancyId)]);
    }
  }

  async function sendInvite() {
    if (!selectedTenancyId) return;
    const ok = await invite.run(async () => {
      const res = await apiFetch<{ token: string }>(`/tenancies/${selectedTenancyId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail || undefined, phone: invitePhone || undefined }),
      });
      setIssuedToken(res.token);
    });
    if (ok) {
      setInviteEmail('');
      setInvitePhone('');
      await loadInvitations();
    }
  }

  const status = detail?.status ?? '';
  const available = TRANSITIONS.filter(
    (t) => t.from.includes(status) && (t.owner ? canOwn : canManage),
  );

  return (
    <div>
      <PageHeader
        title="Tenancies"
        description="The lifecycle of every let — from draft to active to ended — with tenant invitations."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" /> New tenancy
            </Button>
          ) : undefined
        }
      />

      <Card title="All tenancies" className="mb-6">
        <DataTable
          columns={[
            { header: 'Property', render: (t) => t.propertyName },
            { header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            { header: 'Rent', align: 'right', render: (t) => formatINR(t.rentMinor) },
            {
              header: '',
              align: 'right',
              render: (t) => (
                <Button
                  variant={selectedTenancyId === t.id ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTenancyId(t.id)}
                >
                  {selectedTenancyId === t.id ? 'Selected' : 'Manage'}
                </Button>
              ),
            },
          ]}
          rows={tenancies}
          keyOf={(t) => t.id}
          empty="No tenancies yet."
        />
      </Card>

      {detail && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Tenancy details" action={<StatusBadge status={detail.status} />}>
            <KeyValue
              items={[
                ['Property', properties.find((p) => p.id === detail.propertyId)?.name ?? shortId(detail.propertyId)],
                ['Monthly rent', formatINR(detail.rentMinor)],
                ['Security deposit', formatINR(detail.depositMinor)],
                ['Billing day', String(detail.billingDay)],
                ['Start date', formatDate(detail.startDate)],
                ['Jurisdiction', detail.jurisdiction],
                ...(detail.noticeDate ? ([['Notice started', formatDate(detail.noticeDate)]] as [string, string][]) : []),
                ...(detail.endedAt ? ([['Ended', `${formatDate(detail.endedAt)} · ${detail.endReason ?? ''}`]] as [string, string][]) : []),
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/app/t/overview">
                <Button variant="ghost" size="sm">
                  Open finances →
                </Button>
              </Link>
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="Lifecycle">
              {available.length === 0 ? (
                <Empty>No further actions available for this status.</Empty>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {available.map((t) => (
                    <Button
                      key={t.action}
                      variant={t.destructive ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => {
                        setReason('');
                        setPendingAction(t.action);
                      }}
                    >
                      {titleCase(t.action)}
                    </Button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-white/30">
                Status changes are guarded and recorded in the audit log. Ending, terminating or evicting are
                consequential — review with counsel where a dispute is likely.
              </p>
            </Card>

            {canManage && (
              <Card title="Invite tenant">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Email" value={inviteEmail} onChange={setInviteEmail} type="email" placeholder="tenant@example.com" />
                  <Field label="Phone" value={invitePhone} onChange={setInvitePhone} placeholder="+91…" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={invite.busy || (!inviteEmail && !invitePhone)}
                  onClick={() => void sendInvite()}
                >
                  {invite.busy ? 'Inviting…' : 'Create invitation'}
                </Button>
                <ErrorText>{invite.error}</ErrorText>
                {issuedToken && (
                  <div className="mt-3">
                    <Banner tone="amber">
                      Share this single-use token with the tenant (shown once):
                      <code className="mt-1 block break-all font-mono text-xs text-white">{issuedToken}</code>
                    </Banner>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {invitations.length > 0 && (
        <Card title="Invitations" className="mt-6">
          <DataTable
            columns={[
              { header: 'To', render: (i: Invitation) => i.email ?? i.phone ?? '—' },
              { header: 'Tenancy', render: (i: Invitation) => shortId(i.tenancyId) },
              { header: 'Status', render: (i: Invitation) => <StatusBadge status={i.status} /> },
              { header: 'Expires', align: 'right', render: (i: Invitation) => formatDate(i.expiresAt) },
            ]}
            rows={invitations}
            keyOf={(i) => i.id}
          />
        </Card>
      )}

      {/* Create tenancy */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New tenancy"
        description="Creates the tenancy and its primary tenant party in DRAFT."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={createForm.busy || !propertyId || !tenantName || !rent || !startDate}
              onClick={() => void createTenancy()}
            >
              {createForm.busy ? 'Creating…' : 'Create tenancy'}
            </Button>
          </>
        }
      >
        {properties.length === 0 ? (
          <Banner tone="amber">Add a property first — tenancies attach to a property.</Banner>
        ) : (
          <>
            <Select
              label="Property"
              value={propertyId}
              onChange={setPropertyId}
              options={[{ value: '', label: 'Select…' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Field label="Tenant name" value={tenantName} onChange={setTenantName} placeholder="Full name" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tenant email" value={tenantEmail} onChange={setTenantEmail} type="email" />
              <Field label="Tenant phone" value={tenantPhone} onChange={setTenantPhone} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField label="Monthly rent" value={rent} onChange={setRent} />
              <MoneyField label="Security deposit" value={deposit} onChange={setDeposit} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Payer class"
                value={payerClass}
                onChange={setPayerClass}
                options={PAYER_CLASSES.map((c) => ({ value: c, label: titleCase(c) }))}
              />
              <Field label="Billing day" value={billingDay} onChange={setBillingDay} type="number" />
              <Field label="Start date" value={startDate} onChange={setStartDate} type="date" />
              <Field label="Lease end date (optional)" value={endDate} onChange={setEndDate} type="date" />
            </div>
            <ErrorText>{createForm.error}</ErrorText>
          </>
        )}
      </Modal>

      {/* Transition confirm */}
      <Modal
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={`Confirm: ${pendingAction ? titleCase(pendingAction) : ''}`}
        description="This changes the tenancy status and is recorded in the audit log."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={transition.busy} onClick={() => void runTransition()}>
              {transition.busy ? 'Applying…' : `Confirm ${pendingAction ? titleCase(pendingAction) : ''}`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/60">
          Tenancy <span className="font-mono">{shortId(selectedTenancyId)}</span> will move from{' '}
          <span className="text-white">{titleCase(status)}</span>.
        </p>
        {(pendingAction === 'END' || pendingAction === 'TERMINATE' || pendingAction === 'EVICT') && (
          <Field label="Reason" value={reason} onChange={setReason} placeholder="Recorded against the tenancy" />
        )}
        <ErrorText>{transition.error}</ErrorText>
      </Modal>
    </div>
  );
}
