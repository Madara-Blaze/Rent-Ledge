'use client';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';

const trust = ['Paise-accurate ledger', 'Form 26QC / 16C', 'Aadhaar eSign ready', 'UPI · Razorpay'];

export function Hero() {
  return (
    <section id="product" className="relative w-full overflow-hidden bg-black pb-16 pt-28 md:pt-36">
      {/* Ambient video backdrop behind the 3D hero card */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064209_0cb7d815-ff61-4caa-a6d5-bbff145ab272.mp4"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <BlurFade inView delay={0.1}>
          <div className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF0000]" />
            India-first rental operating system
          </div>
        </BlurFade>

        <Card className="relative min-h-[560px] w-full overflow-hidden border-white/10 bg-black/[0.96]">
          <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

          <div className="flex h-full flex-col md:flex-row">
            {/* Left content */}
            <div className="relative z-10 flex flex-1 flex-col justify-center p-8 md:p-12">
              <BlurFade inView delay={0.15}>
                <h1 className="bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold leading-[1.05] tracking-tight text-transparent md:text-6xl">
                  Rentals that
                  <br /> run themselves.
                </h1>
              </BlurFade>

              <BlurFade inView delay={0.3}>
                <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-neutral-300">
                  RentLedger is the single source of truth for the landlord–tenant relationship —
                  digital agreements, automated rent collection on a double-entry ledger, a
                  tamper-evident evidence vault, and tax-ready TDS reporting.
                </p>
              </BlurFade>

              <BlurFade inView delay={0.45}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="lg">
                    Start free
                    <ArrowRight />
                  </Button>
                  <Button variant="outline" size="lg">
                    Book a demo
                  </Button>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
                  <ShieldCheck className="size-4" />
                  DPDP-aligned · PAN encrypted · audit-ready
                </div>
              </BlurFade>
            </div>

            {/* Right content — interactive 3D scene */}
            <div className="relative min-h-[320px] flex-1 md:min-h-0">
              <SplineScene
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="h-full w-full"
              />
            </div>
          </div>
        </Card>

        <BlurFade inView delay={0.3}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs uppercase tracking-[0.2em] text-white/35">
            {trust.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
