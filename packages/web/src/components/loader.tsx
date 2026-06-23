'use client';

import { BrandMark } from '@/components/brand-mark';
import { ShaderAnimation } from '@/components/ui/shader-animation';

/** Full-screen startup animation shown while heavy assets (Spline, fonts) load. */
export function Loader() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <ShaderAnimation />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-7">
        <BrandMark size={44} className="text-[#FF0000]" />
        <div className="font-italiana pl-[0.35em] text-4xl tracking-[0.35em] text-white md:text-6xl">
          RENTLEDGER
        </div>
        <div className="text-[11px] uppercase tracking-[0.4em] text-white/40">
          Balancing the books
        </div>
      </div>
    </div>
  );
}
