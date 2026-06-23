'use client';

import { FileCheck2, Receipt, Scale, ShieldCheck } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';

const features = [
  {
    icon: Scale,
    title: 'Double-entry ledger',
    body: 'Every rupee is a balanced, append-only posting. Balances are computed, never edited — so arrears ageing and reconciliation are always correct.',
  },
  {
    icon: FileCheck2,
    title: 'Compliant agreements',
    body: 'Clause-based templates by jurisdiction, e-signature, stamp-duty and registration flags, and Rent Authority filing reminders.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidence vault',
    body: 'A hash-chained, tamper-evident log of notices, payments and inspections — export a verifiable bundle for any dispute.',
  },
  {
    icon: Receipt,
    title: 'Tax-ready TDS',
    body: '194-IB / 194-I computed from policy, a higher rate when PAN is missing, Form 26QC windows, and a year-end pack for your CA.',
  },
];

export function Features() {
  return (
    <section id="ledger" className="relative w-full bg-black py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <BlurFade inView>
          <p className="text-xs uppercase tracking-[0.3em] text-[#FF0000]">Why RentLedger</p>
        </BlurFade>
        <BlurFade inView delay={0.1}>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
            The boring parts, handled with precision.
          </h2>
        </BlurFade>
        <BlurFade inView delay={0.2}>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/50">
            One system replaces scattered WhatsApp chats, paper receipts and unsigned verbal
            agreements — with money you can actually trust.
          </p>
        </BlurFade>

        <div
          id="compliance"
          className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((f, i) => (
            <BlurFade key={f.title} inView delay={0.1 * i} className="bg-black">
              <div className="group h-full p-8 transition-colors hover:bg-white/[0.02]">
                <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#FF0000]">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{f.body}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
