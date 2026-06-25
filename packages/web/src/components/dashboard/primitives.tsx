import { useCallback, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';

/* ----------------------------------------------------------------------------
 * Surfaces
 * ------------------------------------------------------------------------- */

export function Card({
  title,
  action,
  description,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#fff]/85 backdrop-blur-md dark:bg-black/40 p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h2>}
            {description && <p className="mt-1 text-xs text-white/35">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-md ${
        accent ? 'border-[#FF0000]/40 bg-[#FF0000]/10' : 'border-white/10 bg-[#fff]/85 dark:bg-black/40'
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white [text-shadow:_0_2px_16px_rgba(0,0,0,0.55)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-white/55 [text-shadow:_0_1px_10px_rgba(0,0,0,0.5)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Form controls
 * ------------------------------------------------------------------------- */

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#FF0000]/60';

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">{label}</span>
      <input
        className={inputClass}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="mt-1 block text-xs text-white/30">{hint}</span>}
    </label>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">{label}</span>
      <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] focus-within:border-[#FF0000]/60">
        <span className="pl-3 text-sm text-white/40">₹</span>
        <input
          className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/25"
          inputMode="decimal"
          value={value}
          placeholder={placeholder ?? 'e.g. 55000'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint && <span className="mt-1 block text-xs text-white/30">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">{label}</span>}
      <textarea
        rows={rows}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">{label}</span>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ----------------------------------------------------------------------------
 * Status / labels
 * ------------------------------------------------------------------------- */

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/70">
      {children}
    </span>
  );
}

type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-white/15 bg-white/[0.04] text-white/70',
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  red: 'border-[#ff6b6b]/30 bg-[#ff6b6b]/10 text-[#ff8f8f]',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  blue: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
};

const GREEN = new Set([
  'ACTIVE', 'SIGNED', 'REGISTERED', 'PAID', 'RESOLVED', 'CLOSED', 'HELD', 'GRANTED',
  'SETTLED', 'COMPLETED', 'SENT', 'DELIVERED', 'ACCEPTED', 'VERIFIED', 'APPROVED',
]);
const RED = new Set([
  'EVICTED', 'TERMINATED', 'DEFAULT', 'OVERDUE', 'CANCELLED', 'BROKEN', 'FAILED',
  'WITHDRAWN', 'REJECTED', 'VOID', 'NOT_PAID',
]);
const AMBER = new Set([
  'DRAFT', 'PENDING', 'NOTICE_PERIOD', 'OUT_FOR_SIGNATURE', 'PARTIALLY_SIGNED', 'OPEN',
  'IN_PROGRESS', 'ASSIGNED', 'AGREEMENT_PENDING', 'PARTIAL', 'NOT_REQUIRED',
]);
const BLUE = new Set(['RENEWED', 'FILED', 'PROCESSING']);

export function toneFor(status: string): Tone {
  const s = status.toUpperCase();
  if (GREEN.has(s)) return 'green';
  if (RED.has(s)) return 'red';
  if (AMBER.has(s)) return 'amber';
  if (BLUE.has(s)) return 'blue';
  return 'neutral';
}

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const resolved = tone ?? 'neutral';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[resolved]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={toneFor(status)}>{titleCaseLocal(status)}</Badge>;
}

function titleCaseLocal(v: string): string {
  return v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ----------------------------------------------------------------------------
 * Data display
 * ------------------------------------------------------------------------- */

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  empty = 'Nothing to show yet.',
  keyOf,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  keyOf: (row: T, i: number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-7 text-center text-white/30">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={keyOf(row, i)} className="border-t border-white/[0.06]">
                {columns.map((c, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-2.5 text-white/80 ${
                      c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''
                    } ${c.className ?? ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-white/[0.06]">
      {items.map(([label, value], i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-sm text-white/45">{label}</dt>
          <dd className="text-right text-sm text-white/90">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-white/30">{children}</p>;
}

export function Banner({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASS[tone]}`}>{children}</div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-[#ff8f8f]">{children}</p>;
}

export function Spinner() {
  return <span className="loader inline-block !h-4 !w-4 !border-2 align-[-2px]" aria-label="Loading" />;
}

/* ----------------------------------------------------------------------------
 * Modal
 * ------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#fff]/98 p-6 shadow-2xl backdrop-blur-xl dark:bg-[#0a0a0a]/95">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="mt-1 text-sm text-white/45">{description}</p>}
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Async action helper — busy + ApiError-aware error state
 * ------------------------------------------------------------------------- */

export function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
