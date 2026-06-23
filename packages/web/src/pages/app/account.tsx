import { useState } from 'react';
import { Badge, Banner, Card, ErrorText, Field, KeyValue, PageHeader, useRun } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';

export function AccountPage() {
  const { user, refreshMe } = useAuth();
  const { roles } = useWorkspace();
  const [pan, setPan] = useState('');
  const { busy, error, setError, run } = useRun();
  const [done, setDone] = useState(false);

  async function savePan() {
    setDone(false);
    const normalized = pan.toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
      setError('Enter a valid PAN (e.g. ABCDE1234F).');
      return;
    }
    const ok = await run(async () => {
      await apiFetch('/auth/kyc/pan', { method: 'POST', body: JSON.stringify({ pan: normalized }) });
      await refreshMe();
    });
    if (ok) {
      setPan('');
      setDone(true);
    }
  }

  return (
    <div>
      <PageHeader title="KYC & account" description="Your profile and tax identity. Sensitive identifiers are encrypted at rest." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <KeyValue
            items={[
              ['Name', user?.name ?? '—'],
              ['Email', user?.email ?? '—'],
              ['Phone', user?.phone ?? '—'],
              ['Roles', roles.length ? roles.join(', ') : 'Tenant'],
              [
                'PAN',
                user?.panLast4 ? (
                  <span className="font-mono">
                    XXXXXX{user.panLast4} {user.panValid ? <Badge tone="green">Valid</Badge> : <Badge tone="amber">Unverified</Badge>}
                  </span>
                ) : (
                  <Badge tone="red">Not captured</Badge>
                ),
              ],
            ]}
          />
        </Card>

        <Card title="KYC — PAN" description="Captured for TDS. Only the last 4 digits are ever shown.">
          {!user?.panValid && (
            <Banner tone="amber">
              Without a valid landlord PAN, rent TDS is withheld at the higher 20% rate. Capture your PAN to apply the standard rate.
            </Banner>
          )}
          <div className="mt-3">
            <Field label="PAN" value={pan} onChange={setPan} placeholder="ABCDE1234F" hint="Validated and encrypted at rest." />
          </div>
          <Button variant="primary" size="sm" className="mt-3" disabled={busy || !pan} onClick={() => void savePan()}>
            {busy ? 'Saving…' : 'Save PAN'}
          </Button>
          <ErrorText>{error}</ErrorText>
          {done && <p className="mt-2 text-sm text-emerald-400">PAN saved and encrypted.</p>}
        </Card>
      </div>

      <Banner tone="neutral">
        <span className="mt-6 block">
          We minimise and mask personal data (PAN, Aadhaar, bank, phone, email). Manage consent and exercise your data rights
          under the DPDP Act on the Privacy page.
        </span>
      </Banner>
    </div>
  );
}
