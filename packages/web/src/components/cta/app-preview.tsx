import { BrandMark } from '@/components/brand-mark';

/** An on-brand snapshot of the RentLedger app, used inside the landing CTA mock. */
export function RentLedgerAppPreview() {
  const stats = [
    { label: 'Rent outstanding', value: '₹55,000', accent: true },
    { label: 'Deposit held', value: '₹1,10,000' },
    { label: 'TDS (annual)', value: '₹6,600' },
    { label: 'Arrears 0–30d', value: '₹55,000' },
  ];
  const ledger = [
    ['Rent income', '₹3,30,000'],
    ['Cash received', '₹2,75,000'],
    ['Security deposit', '₹1,10,000'],
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0d]">
      {/* brand glow */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#FF0000]/20 blur-3xl" />

      {/* top bar */}
      <div className="relative flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <BrandMark size={15} className="text-[#FF0000]" />
          <span className="text-xs font-semibold text-white sm:text-sm">RentLedger</span>
          <span className="hidden text-[10px] text-white/35 sm:inline">· Overview</span>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] text-white/60 sm:text-[10px]">
          12 Marine Drive · Active
        </span>
      </div>

      {/* stat tiles */}
      <div className="relative grid grid-cols-2 gap-2 p-3 sm:p-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-2.5 sm:p-3 ${
              s.accent ? 'border-[#FF0000]/40 bg-[#FF0000]/10' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <p className="text-[8px] uppercase tracking-wider text-white/40 sm:text-[9px]">{s.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-white sm:text-base">{s.value}</p>
          </div>
        ))}
      </div>

      {/* mini ledger */}
      <div className="relative flex-1 px-3 pb-3 sm:px-4">
        <p className="mb-1.5 text-[8px] uppercase tracking-wider text-white/40 sm:text-[9px]">Ledger balances</p>
        <div className="space-y-1">
          {ledger.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <span className="text-[10px] text-white/55 sm:text-xs">{k}</span>
              <span className="text-[10px] tabular-nums text-white/85 sm:text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* action */}
      <div className="relative border-t border-white/10 p-3 sm:p-4">
        <div className="flex items-center justify-center rounded-full bg-[#FF0000] py-1.5 text-[10px] font-medium text-white shadow-[0_8px_30px_rgba(255,0,0,0.25)] sm:py-2 sm:text-xs">
          Record UPI payment
        </div>
      </div>
    </div>
  );
}
