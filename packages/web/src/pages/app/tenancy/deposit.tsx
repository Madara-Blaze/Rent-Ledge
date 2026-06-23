import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Banner,
  Card,
  ErrorText,
  Field,
  KeyValue,
  Modal,
  MoneyField,
  PageHeader,
  Stat,
  StatusBadge,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatINR, rupeesToMinor, shortId } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Money {
  amountMinor: string;
}
interface Statement {
  tenancyId: string;
  currency: string;
  status: string;
  target: Money;
  collected: Money;
  deducted: Money;
  interest: Money;
  refunded: Money;
  balanceHeld: Money;
}

type Action = 'collect' | 'deduct' | 'refund';

export function DepositPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Security deposit"
        description="A dedicated sub-ledger: collection, evidence-tied deductions, refund and a settlement statement."
      />
      <TenancyGate>{({ tenancyId }) => <DepositBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function DepositBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const [stmt, setStmt] = useState<Statement | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const { busy, error, setError, run } = useRun();

  const load = useCallback(async (id: string) => {
    setStmt(await apiFetch<Statement>(`/deposits/${id}/statement`).catch(() => null));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  function open(a: Action) {
    setError(null);
    setAmount('');
    setReason('');
    setEvidenceRef('');
    setMethod('UPI');
    setAction(a);
  }

  async function submit() {
    if (!action) return;
    const amountMinor = rupeesToMinor(amount);
    if (!amountMinor) {
      setError('Enter a valid amount.');
      return;
    }
    if (action === 'deduct' && !reason) {
      setError('A reason is required for a deduction.');
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    const payload: Record<string, unknown> = { tenancyId, amountMinor, idempotencyKey };
    if (action === 'deduct') {
      payload.reason = reason;
      payload.evidenceRef = evidenceRef || undefined;
    } else {
      payload.method = method;
    }
    const ok = await run(async () => {
      await apiFetch(`/deposits/${action}`, { method: 'POST', body: JSON.stringify(payload) });
    });
    if (ok) {
      setAction(null);
      await load(tenancyId);
    }
  }

  const labels: Record<Action, string> = { collect: 'Collect deposit', deduct: 'Deduct from deposit', refund: 'Refund deposit' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Balance held" value={formatINR(stmt?.balanceHeld.amountMinor)} accent sub={stmt ? undefined : 'No deposit yet'} />
        <Stat label="Collected" value={formatINR(stmt?.collected.amountMinor)} />
        <Stat label="Deducted" value={formatINR(stmt?.deducted.amountMinor)} />
        <Stat label="Refunded" value={formatINR(stmt?.refunded.amountMinor)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Settlement statement" action={stmt ? <StatusBadge status={stmt.status} /> : undefined}>
          {stmt ? (
            <KeyValue
              items={[
                ['Target', formatINR(stmt.target.amountMinor)],
                ['Collected', formatINR(stmt.collected.amountMinor)],
                ['Interest', formatINR(stmt.interest.amountMinor)],
                ['Deducted', `− ${formatINR(stmt.deducted.amountMinor)}`],
                ['Refunded', `− ${formatINR(stmt.refunded.amountMinor)}`],
                ['Balance held', <span className="font-semibold text-white">{formatINR(stmt.balanceHeld.amountMinor)}</span>],
              ]}
            />
          ) : (
            <Banner tone="blue">No deposit account yet. Collect a deposit to open the sub-ledger.</Banner>
          )}
        </Card>

        {canManage && (
          <Card title="Actions" description="Each action posts to the deposit sub-ledger and is irreversible (corrections are reversing entries).">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => open('collect')}>
                Collect
              </Button>
              <Button variant="outline" size="sm" onClick={() => open('deduct')}>
                Deduct
              </Button>
              <Button variant="outline" size="sm" onClick={() => open('refund')}>
                Refund
              </Button>
            </div>
            <p className="mt-3 text-xs text-white/30">
              Deductions at move-out must be tied to inspection evidence. Respect statutory deposit caps for the jurisdiction.
            </p>
          </Card>
        )}
      </div>

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action ? labels[action] : ''}
        description="This moves money on the deposit sub-ledger. Confirm the exact amount and effect."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Posting…' : `Confirm ${action ?? ''}`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/50">
          Tenancy <span className="font-mono">{shortId(tenancyId)}</span>
        </p>
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
        {action === 'deduct' ? (
          <>
            <Textarea label="Reason" value={reason} onChange={setReason} rows={2} placeholder="e.g. Repainting (move-out inspection)" />
            <Field label="Evidence reference (optional)" value={evidenceRef} onChange={setEvidenceRef} placeholder="Inspection / evidence ID" />
          </>
        ) : (
          <Field label="Method" value={method} onChange={setMethod} placeholder="UPI / BANK_TRANSFER" />
        )}
        <ErrorText>{error}</ErrorText>
      </Modal>
    </div>
  );
}
