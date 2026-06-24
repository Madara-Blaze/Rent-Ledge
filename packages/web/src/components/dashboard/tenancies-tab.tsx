import { Copy, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { formatINR, rupeesToMinor, titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface Property {
  id: string;
  name: string;
}
interface Unit {
  id: string;
  label: string;
}
interface Tenancy {
  id: string;
  propertyId: string;
  unitId: string | null;
  rentMinor: string;
  depositMinor: string;
  status: string;
  startDate: string;
}
interface Invitation {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  token: string;
}

/** Lifecycle actions offered per status (mirrors the backend transition rules). */
const ACTIONS_BY_STATUS: Record<string, string[]> = {
  DRAFT: ['ISSUE_AGREEMENT', 'ACTIVATE'],
  AGREEMENT_PENDING: ['ACTIVATE'],
  ACTIVE: ['START_NOTICE', 'RENEW', 'TERMINATE', 'END', 'EVICT'],
  NOTICE_PERIOD: ['RENEW', 'TERMINATE', 'END', 'EVICT'],
};
const DESTRUCTIVE = new Set(['TERMINATE', 'END', 'EVICT']);
const ACTION_EFFECT: Record<string, string> = {
  TERMINATE: 'terminate this tenancy and stamp an end date — this cannot be undone',
  END: 'end this tenancy and stamp an end date — this cannot be undone',
  EVICT: 'mark this tenancy as evicted and stamp an end date — this cannot be undone',
};
const today = () => new Date().toISOString().slice(0, 10);

function InviteRow({ tenancyId, landlordId }: { tenancyId: string; landlordId: string }) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function invite() {
    setBusy(true);
    try {
      const inv = await apiFetch<Invitation>(`/tenancies/${tenancyId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      setInvites((s) => [inv, ...s]);
      setEmail('');
    } finally {
      setBusy(false);
    }
  }

  void landlordId; // reserved for listing existing invitations later
  return (
    <div className="mt-3">
      {!open ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Invite tenant to claim
        </Button>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Tenant email (optional)" value={email} onChange={setEmail} placeholder="tenant@example.com" />
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void invite()}>
            {busy ? 'Sending…' : 'Create invite'}
          </Button>
        </div>
      )}
      {invites.map((inv) => (
        <div key={inv.id} className="mt-2 rounded-lg border border-[#FF0000]/25 bg-[#FF0000]/[0.05] p-3 text-xs">
          <p className="text-white/60">Share this one-time invite link (shown only once):</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-black/40 px-2 py-1 text-white/80">{inv.token}</code>
            <button
              className="text-white/50 hover:text-white"
              onClick={() => void navigator.clipboard?.writeText(inv.token)}
              aria-label="Copy invite token"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TenanciesTab({
  landlordId,
  onChanged,
}: {
  landlordId: string | null;
  onChanged?: () => void;
}) {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // create form
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [startDate, setStartDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propName = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties]);

  const load = useCallback(async (lid: string) => {
    const [t, p] = await Promise.all([
      apiFetch<Tenancy[]>(`/workspaces/${lid}/tenancies`).catch(() => []),
      apiFetch<Property[]>(`/workspaces/${lid}/properties`).catch(() => []),
    ]);
    setTenancies(t);
    setProperties(p);
    setPropertyId((cur) => cur || p[0]?.id || '');
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  // load units for the selected property in the create form
  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      return;
    }
    void apiFetch<Unit[]>(`/properties/${propertyId}/units`)
      .then(setUnits)
      .catch(() => setUnits([]));
    setUnitId('');
  }, [propertyId]);

  async function createTenancy() {
    if (!landlordId || !propertyId || !tenantName.trim() || !rent) return;
    let rentMinor: string;
    let depositMinor: string | undefined;
    try {
      rentMinor = rupeesToMinor(rent);
      depositMinor = deposit ? rupeesToMinor(deposit) : undefined;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/workspaces/${landlordId}/tenancies`, {
        method: 'POST',
        body: JSON.stringify({
          propertyId,
          unitId: unitId || undefined,
          tenantName: tenantName.trim(),
          tenantEmail: tenantEmail.trim() || undefined,
          tenantPhone: tenantPhone.trim() || undefined,
          rentMinor,
          depositMinor,
          billingDay: Number(billingDay),
          startDate,
        }),
      });
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
      setRent('');
      setDeposit('');
      await load(landlordId);
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create tenancy');
    } finally {
      setBusy(false);
    }
  }

  async function transition(t: Tenancy, action: string) {
    if (DESTRUCTIVE.has(action) && !window.confirm(`You are about to ${ACTION_EFFECT[action]}. Continue?`)) {
      return;
    }
    await apiFetch(`/tenancies/${t.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }).catch((e: unknown) => {
      window.alert(e instanceof ApiError ? e.message : 'Transition failed');
      throw e;
    });
    if (landlordId) await load(landlordId);
    onChanged?.();
  }

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  const hasProperties = properties.length > 0;
  const dayOptions = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <div className="space-y-6">
      <Card title="Create a tenancy">
        {!hasProperties ? (
          <Empty>Add a property first — a tenancy needs a property to attach to.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Property"
                value={propertyId}
                onChange={setPropertyId}
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Select
                label="Unit (optional)"
                value={unitId}
                onChange={setUnitId}
                options={[{ value: '', label: '— Whole property —' }, ...units.map((u) => ({ value: u.id, label: u.label }))]}
              />
              <Field label="Tenant name" value={tenantName} onChange={setTenantName} placeholder="Full name" />
              <Field label="Tenant phone (optional)" value={tenantPhone} onChange={setTenantPhone} placeholder="+91…" />
              <Field label="Tenant email (optional)" value={tenantEmail} onChange={setTenantEmail} placeholder="tenant@example.com" />
              <Field label="Monthly rent (₹)" value={rent} onChange={setRent} placeholder="e.g. 55000" />
              <Field label="Security deposit (₹, optional)" value={deposit} onChange={setDeposit} placeholder="e.g. 110000" />
              <Select label="Billing day" value={billingDay} onChange={setBillingDay} options={dayOptions} />
              <Field label="Start date" value={startDate} onChange={setStartDate} type="date" />
            </div>
            {error && <p className="mt-3 text-sm text-[#FF0000]">{error}</p>}
            <Button
              variant="primary"
              className="mt-4"
              disabled={busy || !tenantName.trim() || !rent}
              onClick={() => void createTenancy()}
            >
              <Plus className="size-4" /> {busy ? 'Creating…' : 'Create tenancy'}
            </Button>
            <p className="mt-3 text-xs text-white/30">Creates the tenant party and a DRAFT tenancy. Activate it to start billing.</p>
          </>
        )}
      </Card>

      <Card title={`Tenancies (${tenancies.length})`}>
        {tenancies.length === 0 ? (
          <Empty>No tenancies yet.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {tenancies.map((t) => {
              const actions = ACTIONS_BY_STATUS[t.status] ?? [];
              return (
                <li key={t.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white/90">
                        {propName.get(t.propertyId) ?? 'Property'}{' '}
                        <span className="text-white/40">· {formatINR(t.rentMinor)}/mo</span>
                      </p>
                      <p className="mt-0.5 text-xs text-white/40">
                        Since {t.startDate} · #{t.id.slice(0, 8)}
                      </p>
                    </div>
                    <Pill>{titleCase(t.status)}</Pill>
                  </div>
                  {actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.map((a) => (
                        <Button
                          key={a}
                          variant={DESTRUCTIVE.has(a) ? 'outline' : 'ghost'}
                          size="sm"
                          onClick={() => void transition(t, a)}
                        >
                          {titleCase(a)}
                        </Button>
                      ))}
                    </div>
                  )}
                  <InviteRow tenancyId={t.id} landlordId={landlordId} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
