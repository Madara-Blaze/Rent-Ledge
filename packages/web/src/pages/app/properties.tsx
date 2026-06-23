import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
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
import { titleCase } from '@/lib/format';
import { useWorkspace, type PropertyLite } from '@/lib/workspace';

interface Portfolio {
  id: string;
  name: string;
}
interface Unit {
  id: string;
  label: string;
}

const PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'PG', 'CO_LIVING'];

export function PropertiesPage() {
  const { landlordId, canManage, reloadTenancies } = useWorkspace();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [showProperty, setShowProperty] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);

  // property form
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('RESIDENTIAL');
  const [portfolioId, setPortfolioId] = useState('');
  // portfolio form
  const [portfolioName, setPortfolioName] = useState('');

  const propForm = useRun();
  const portForm = useRun();

  async function load() {
    if (!landlordId) return;
    setPortfolios(await apiFetch<Portfolio[]>(`/workspaces/${landlordId}/portfolios`).catch(() => []));
    setProperties(await apiFetch<PropertyLite[]>(`/workspaces/${landlordId}/properties`).catch(() => []));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Properties" />
        <Banner tone="blue">Properties are managed by the landlord workspace.</Banner>
      </div>
    );
  }

  async function createProperty() {
    const ok = await propForm.run(async () => {
      await apiFetch(`/workspaces/${landlordId}/properties`, {
        method: 'POST',
        body: JSON.stringify({ name, address: address || undefined, type, portfolioId: portfolioId || undefined }),
      });
    });
    if (ok) {
      setShowProperty(false);
      setName('');
      setAddress('');
      setType('RESIDENTIAL');
      setPortfolioId('');
      await load();
    }
  }

  async function createPortfolio() {
    const ok = await portForm.run(async () => {
      await apiFetch(`/workspaces/${landlordId}/portfolios`, {
        method: 'POST',
        body: JSON.stringify({ name: portfolioName }),
      });
    });
    if (ok) {
      setShowPortfolio(false);
      setPortfolioName('');
      await load();
    }
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Your portfolio hierarchy: portfolios, properties and the units inside them."
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowPortfolio(true)}>
                <Plus className="size-4" /> Portfolio
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowProperty(true)}>
                <Plus className="size-4" /> Property
              </Button>
            </>
          ) : undefined
        }
      />

      {portfolios.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {portfolios.map((p) => (
            <Pill key={p.id}>{p.name}</Pill>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {properties.length === 0 ? (
          <Card>
            <Empty>No properties yet. {canManage ? 'Add your first property to get started.' : ''}</Empty>
          </Card>
        ) : (
          properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              portfolioName={portfolios.find((pf) => pf.id === p.portfolioId)?.name}
              canManage={canManage}
              onUnitsChanged={reloadTenancies}
            />
          ))
        )}
      </div>

      <Modal
        open={showProperty}
        onClose={() => setShowProperty(false)}
        title="New property"
        description="Add a property to your workspace."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowProperty(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={propForm.busy || !name} onClick={() => void createProperty()}>
              {propForm.busy ? 'Creating…' : 'Create property'}
            </Button>
          </>
        }
      >
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. 12 Marine Drive" />
        <Textarea label="Address" value={address} onChange={setAddress} rows={2} placeholder="Full address" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={type} onChange={setType} options={PROPERTY_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
          <Select
            label="Portfolio"
            value={portfolioId}
            onChange={setPortfolioId}
            options={[{ value: '', label: 'None' }, ...portfolios.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
        <ErrorText>{propForm.error}</ErrorText>
      </Modal>

      <Modal
        open={showPortfolio}
        onClose={() => setShowPortfolio(false)}
        title="New portfolio"
        description="Group related properties under a portfolio."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowPortfolio(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={portForm.busy || !portfolioName} onClick={() => void createPortfolio()}>
              {portForm.busy ? 'Creating…' : 'Create portfolio'}
            </Button>
          </>
        }
      >
        <Field label="Name" value={portfolioName} onChange={setPortfolioName} placeholder="e.g. Mumbai residential" />
        <ErrorText>{portForm.error}</ErrorText>
      </Modal>
    </div>
  );
}

function PropertyCard({
  property,
  portfolioName,
  canManage,
  onUnitsChanged,
}: {
  property: PropertyLite;
  portfolioName?: string;
  canManage: boolean;
  onUnitsChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [label, setLabel] = useState('');
  const { busy, error, run } = useRun();

  async function loadUnits() {
    setUnits(await apiFetch<Unit[]>(`/properties/${property.id}/units`).catch(() => []));
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && units === null) await loadUnits();
  }

  async function addUnit() {
    const ok = await run(async () => {
      await apiFetch(`/properties/${property.id}/units`, { method: 'POST', body: JSON.stringify({ label }) });
    });
    if (ok) {
      setLabel('');
      await loadUnits();
      onUnitsChanged();
    }
  }

  return (
    <Card className="!p-0">
      <button
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
        onClick={() => void toggle()}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{property.name}</p>
            <StatusBadge status={property.type} />
            {portfolioName && <Badge tone="blue">{portfolioName}</Badge>}
          </div>
          {property.address && <p className="mt-1 text-xs text-white/40">{property.address}</p>}
        </div>
        {open ? <ChevronDown className="size-4 text-white/40" /> : <ChevronRight className="size-4 text-white/40" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-6 py-5">
          <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Units</p>
          {units === null ? (
            <Empty>Loading…</Empty>
          ) : units.length === 0 ? (
            <p className="text-sm text-white/35">No units defined — a single-unit property bills at property level.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <Pill key={u.id}>{u.label}</Pill>
              ))}
            </div>
          )}
          {canManage && (
            <div className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <Field label="Add unit" value={label} onChange={setLabel} placeholder="e.g. Flat 3B" />
              </div>
              <Button variant="outline" size="sm" disabled={busy || !label} onClick={() => void addUnit()}>
                Add
              </Button>
            </div>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
  );
}
