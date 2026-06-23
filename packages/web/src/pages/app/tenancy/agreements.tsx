import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  KeyValue,
  Modal,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINR, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface AgreementHeader {
  id: string;
  title: string;
  status: string;
  termMonths: number;
  jurisdiction: string;
  propertyType: string;
  registrationRequired: boolean;
  registrationStatus: string;
  stampDutyMinor: string;
  stampDutyStatus: string;
  rentAuthorityRequired: boolean;
  rentAuthorityStatus: string;
  rentAuthorityDue: string | null;
  rentAuthorityRef: string | null;
  supersedesId: string | null;
  createdAt: string;
}
interface Signer {
  partyRole: string;
  name: string;
  provider: string;
  documentHash: string;
  signedAt: string | null;
  status: string;
}
interface AgreementDetail extends AgreementHeader {
  currentVersion: { version: number; contentHash: string; clauses: { title: string }[]; renderedText: string } | null;
  signers: Signer[];
}

const REGISTRATION_STATUS = ['NOT_REQUIRED', 'PENDING', 'FILED', 'REGISTERED'];
const RENT_AUTHORITY_STATUS = ['NOT_REQUIRED', 'PENDING', 'FILED'];
const SIGNER_ROLES = ['LANDLORD', 'TENANT', 'GUARANTOR', 'WITNESS'];

export function AgreementsPage() {
  const { canManage, canOwn } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Agreements"
        description="Clause-based, versioned rental agreements with e-signature, stamp duty and registration tracking."
      />
      <TenancyGate>{({ tenancyId }) => <AgreementsBody tenancyId={tenancyId} canManage={canManage} canOwn={canOwn} />}</TenancyGate>
    </div>
  );
}

function AgreementsBody({ tenancyId, canManage, canOwn }: { tenancyId: string; canManage: boolean; canOwn: boolean }) {
  const [items, setItems] = useState<AgreementHeader[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [termMonths, setTermMonths] = useState('11');
  const create = useRun();

  const load = useCallback(async (id: string) => {
    setItems(await apiFetch<AgreementHeader[]>(`/tenancies/${id}/agreements`).catch(() => []));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  async function createAgreement() {
    const ok = await create.run(async () => {
      const ag = await apiFetch<AgreementDetail>('/agreements', {
        method: 'POST',
        body: JSON.stringify({ tenancyId, termMonths: Number(termMonths) || undefined }),
      });
      setSelectedId(ag.id);
    });
    if (ok) await load(tenancyId);
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card title="New agreement" description="Renders v1 from the jurisdiction template and sets stamp-duty / registration flags.">
          <div className="flex items-end gap-3">
            <div className="w-40">
              <Field label="Term (months)" type="number" value={termMonths} onChange={setTermMonths} hint="> 11 triggers registration" />
            </div>
            <Button variant="primary" size="sm" disabled={create.busy} onClick={() => void createAgreement()}>
              {create.busy ? 'Creating…' : 'Create from template'}
            </Button>
          </div>
          <ErrorText>{create.error}</ErrorText>
        </Card>
      )}

      <Card title="Agreements">
        <DataTable
          columns={[
            { header: 'Title', render: (a: AgreementHeader) => <span className="text-white">{a.title}</span> },
            { header: 'Status', render: (a: AgreementHeader) => <StatusBadge status={a.status} /> },
            { header: 'Term', render: (a: AgreementHeader) => `${a.termMonths} mo` },
            {
              header: 'Registration',
              render: (a: AgreementHeader) => (a.registrationRequired ? <StatusBadge status={a.registrationStatus} /> : <Pill>Not required</Pill>),
            },
            {
              header: '',
              align: 'right',
              render: (a: AgreementHeader) => (
                <Button variant={selectedId === a.id ? 'primary' : 'outline'} size="sm" onClick={() => setSelectedId(a.id)}>
                  {selectedId === a.id ? 'Open' : 'View'}
                </Button>
              ),
            },
          ]}
          rows={items}
          keyOf={(a) => a.id}
          empty="No agreements yet."
        />
      </Card>

      {selectedId && (
        <AgreementDetailCard
          key={selectedId}
          agreementId={selectedId}
          canManage={canManage}
          canOwn={canOwn}
          onChanged={() => load(tenancyId)}
        />
      )}
    </div>
  );
}

function AgreementDetailCard({
  agreementId,
  canManage,
  canOwn,
  onChanged,
}: {
  agreementId: string;
  canManage: boolean;
  canOwn: boolean;
  onChanged: () => void;
}) {
  const [ag, setAg] = useState<AgreementDetail | null>(null);
  const [showText, setShowText] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [signRole, setSignRole] = useState('LANDLORD');
  const [signName, setSignName] = useState('');
  const [signId, setSignId] = useState('');
  // compliance
  const [stampPaid, setStampPaid] = useState(false);
  const [regStatus, setRegStatus] = useState('');
  const [raStatus, setRaStatus] = useState('');
  const [raRef, setRaRef] = useState('');

  const action = useRun();
  const compliance = useRun();

  const load = useCallback(async () => {
    const d = await apiFetch<AgreementDetail>(`/agreements/${agreementId}`).catch(() => null);
    setAg(d);
    if (d) {
      setRegStatus(d.registrationStatus);
      setRaStatus(d.rentAuthorityStatus);
      setRaRef(d.rentAuthorityRef ?? '');
      setStampPaid(d.stampDutyStatus === 'PAID');
    }
  }, [agreementId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ag) return null;

  const refresh = async () => {
    await load();
    onChanged();
  };

  async function send() {
    const ok = await action.run(() => apiFetch(`/agreements/${agreementId}/send`, { method: 'POST' }));
    if (ok) {
      setSendOpen(false);
      await refresh();
    }
  }

  async function sign() {
    const ok = await action.run(() =>
      apiFetch(`/agreements/${agreementId}/sign`, {
        method: 'POST',
        body: JSON.stringify({ partyRole: signRole, name: signName, identifier: signId || undefined }),
      }),
    );
    if (ok) {
      setSignOpen(false);
      setSignName('');
      setSignId('');
      await refresh();
    }
  }

  async function addendum() {
    const ok = await action.run(() => apiFetch(`/agreements/${agreementId}/addendum`, { method: 'POST', body: JSON.stringify({}) }));
    if (ok) await refresh();
  }

  async function saveCompliance() {
    const ok = await compliance.run(() =>
      apiFetch(`/agreements/${agreementId}/compliance`, {
        method: 'POST',
        body: JSON.stringify({
          stampDutyPaid: stampPaid || undefined,
          registrationStatus: regStatus || undefined,
          rentAuthorityStatus: raStatus || undefined,
          rentAuthorityRef: raRef || undefined,
        }),
      }),
    );
    if (ok) await refresh();
  }

  const canSign = ag.status === 'OUT_FOR_SIGNATURE' || ag.status === 'PARTIALLY_SIGNED';

  return (
    <Card title={ag.title} action={<StatusBadge status={ag.status} />}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <KeyValue
            items={[
              ['Term', `${ag.termMonths} months`],
              ['Jurisdiction', ag.jurisdiction],
              ['Property type', titleCase(ag.propertyType)],
              ['Stamp duty', `${formatINR(ag.stampDutyMinor)} · ${titleCase(ag.stampDutyStatus)}`],
              ['Registration', ag.registrationRequired ? titleCase(ag.registrationStatus) : 'Not required'],
              [
                'Rent Authority',
                ag.rentAuthorityRequired
                  ? `${titleCase(ag.rentAuthorityStatus)}${ag.rentAuthorityDue ? ` · due ${formatDate(ag.rentAuthorityDue)}` : ''}`
                  : 'Not required',
              ],
              ['Version', ag.currentVersion ? `v${ag.currentVersion.version}` : '—'],
              ['Document hash', ag.currentVersion ? <span className="font-mono text-xs">{ag.currentVersion.contentHash.slice(0, 18)}…</span> : '—'],
            ]}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {canManage && ag.status === 'DRAFT' && (
              <Button variant="primary" size="sm" onClick={() => setSendOpen(true)}>
                Send for signature
              </Button>
            )}
            {canSign && (
              <Button variant="primary" size="sm" onClick={() => setSignOpen(true)}>
                e-Sign
              </Button>
            )}
            {canOwn && ag.status === 'SIGNED' && (
              <Button variant="outline" size="sm" disabled={action.busy} onClick={() => void addendum()}>
                Create addendum
              </Button>
            )}
            {ag.currentVersion && (
              <Button variant="ghost" size="sm" onClick={() => setShowText((s) => !s)}>
                {showText ? 'Hide' : 'View'} document
              </Button>
            )}
          </div>
          <ErrorText>{action.error}</ErrorText>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Signers</p>
          {ag.signers.length === 0 ? (
            <Empty>No signatures yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {ag.signers.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <p className="text-white">{s.name}</p>
                    <p className="text-xs text-white/40">
                      {titleCase(s.partyRole)} · {s.provider} · {formatDate(s.signedAt)}
                    </p>
                  </div>
                  <Badge tone="green">{titleCase(s.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showText && ag.currentVersion && (
        <pre className="mt-5 max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/70 whitespace-pre-wrap">
          {ag.currentVersion.renderedText}
        </pre>
      )}

      {canManage && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/40">Compliance</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={stampPaid} onChange={(e) => setStampPaid(e.target.checked)} className="accent-[#FF0000]" />
              Stamp duty paid
            </label>
            <Select label="Registration" value={regStatus} onChange={setRegStatus} options={REGISTRATION_STATUS.map((s) => ({ value: s, label: titleCase(s) }))} />
            <Select label="Rent Authority" value={raStatus} onChange={setRaStatus} options={RENT_AUTHORITY_STATUS.map((s) => ({ value: s, label: titleCase(s) }))} />
            <Field label="Filing reference" value={raRef} onChange={setRaRef} placeholder="Reference no." />
          </div>
          <Button variant="outline" size="sm" className="mt-3" disabled={compliance.busy} onClick={() => void saveCompliance()}>
            {compliance.busy ? 'Saving…' : 'Save compliance'}
          </Button>
          <ErrorText>{compliance.error}</ErrorText>
        </div>
      )}

      <Banner tone="amber">
        <span className="mt-4 block">Templates require review by qualified counsel. Shipped defaults are flagged not-yet-counsel-reviewed.</span>
      </Banner>

      {/* Send confirm */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send for signature"
        description="The agreement moves out for signature and the document is locked to its current version."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={action.busy} onClick={() => void send()}>
              {action.busy ? 'Sending…' : 'Confirm send'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/60">Both landlord and tenant must e-sign to fully execute and hash-lock the agreement.</p>
      </Modal>

      {/* Sign */}
      <Modal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title="e-Sign agreement"
        description="Captures signer identity, timestamp, IP and the signed-document hash."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSignOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={action.busy || !signName} onClick={() => void sign()}>
              {action.busy ? 'Signing…' : 'Confirm signature'}
            </Button>
          </>
        }
      >
        <Select label="Signing as" value={signRole} onChange={setSignRole} options={SIGNER_ROLES.map((r) => ({ value: r, label: titleCase(r) }))} />
        <Field label="Full name" value={signName} onChange={setSignName} placeholder="As it should appear on the signature" />
        <Field label="Identifier (optional)" value={signId} onChange={setSignId} placeholder="Aadhaar / email used to sign" />
      </Modal>
    </Card>
  );
}
