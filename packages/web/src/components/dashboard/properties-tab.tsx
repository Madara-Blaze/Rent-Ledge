import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface Property {
  id: string;
  name: string;
  address: string | null;
  type: string;
}
interface Unit {
  id: string;
  label: string;
}

const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'PG', label: 'PG / Hostel' },
  { value: 'CO_LIVING', label: 'Co-living' },
];

function UnitsPanel({ propertyId }: { propertyId: string }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setUnits(await apiFetch<Unit[]>(`/properties/${propertyId}/units`).catch(() => []));
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addUnit() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/properties/${propertyId}/units`, {
        method: 'POST',
        body: JSON.stringify({ label: label.trim() }),
      });
      setLabel('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {units.length === 0 && <span className="text-sm text-white/30">No units yet.</span>}
        {units.map((u) => (
          <Pill key={u.id}>{u.label}</Pill>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="New unit label" value={label} onChange={setLabel} placeholder="e.g. 2B, Shop-3, Floor 1" />
        </div>
        <Button variant="outline" size="sm" disabled={busy || !label.trim()} onClick={() => void addUnit()}>
          <Plus className="size-4" /> Add unit
        </Button>
      </div>
    </div>
  );
}

export function PropertiesTab({ landlordId }: { landlordId: string | null }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('RESIDENTIAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (lid: string) => {
    setProperties(await apiFetch<Property[]>(`/workspaces/${lid}/properties`).catch(() => []));
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  async function createProperty() {
    if (!landlordId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/workspaces/${landlordId}/properties`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), address: address.trim() || undefined, type }),
      });
      setName('');
      setAddress('');
      setType('RESIDENTIAL');
      await load(landlordId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create property');
    } finally {
      setBusy(false);
    }
  }

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  return (
    <div className="space-y-6">
      <Card title="Add a property">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={setName} placeholder="e.g. Lakeview Apartments" />
          <Select label="Type" value={type} onChange={setType} options={PROPERTY_TYPES} />
          <div className="sm:col-span-2">
            <Field label="Address (optional)" value={address} onChange={setAddress} placeholder="Street, city, PIN" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[#FF0000]">{error}</p>}
        <Button variant="primary" className="mt-4" disabled={busy || !name.trim()} onClick={() => void createProperty()}>
          {busy ? 'Saving…' : 'Add property'}
        </Button>
      </Card>

      <Card title={`Properties (${properties.length})`}>
        {properties.length === 0 ? (
          <Empty>No properties yet. Add your first one above.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {properties.map((p) => (
              <li key={p.id} className="py-3">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded((id) => (id === p.id ? null : p.id))}
                  aria-expanded={expanded === p.id}
                >
                  <span className="flex items-center gap-2">
                    {expanded === p.id ? (
                      <ChevronDown className="size-4 text-white/40" />
                    ) : (
                      <ChevronRight className="size-4 text-white/40" />
                    )}
                    <span className="font-medium text-white/90">{p.name}</span>
                    <Pill>{titleCase(p.type)}</Pill>
                  </span>
                  {p.address && <span className="hidden text-sm text-white/40 sm:inline">{p.address}</span>}
                </button>
                {expanded === p.id && <UnitsPanel propertyId={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
