'use client';

import { BrandMark } from '@/components/brand-mark';
import { BlurFade } from '@/components/ui/blur-fade';

/**
 * The red "founder note" section that sits below the landing page.
 * Layout follows the supplied design brief: centered content over a solid
 * #FF0000 field, a cursive brand signature, and a bottom video whose top edge
 * is blended into the red with a gradient overlay.
 */
export function Mission() {
  return (
    <section id="story" className="relative z-10 flex min-h-screen w-full flex-col bg-[#FF0000]">
      {/* Centered content */}
      <div className="flex w-full flex-1 flex-col items-center pt-[100px] md:pt-[400px]">
        <div className="relative z-20 mx-auto flex h-auto w-full max-w-[900px] flex-col items-center px-8 text-center md:h-[620px]">
          <BlurFade inView>
            <BrandMark size={80} className="mb-12 text-white" />
          </BlurFade>

          <BlurFade inView delay={0.1}>
            <p className="mx-auto mb-[40px] h-[100px] w-full max-w-[400px] text-[16px] uppercase leading-[1.6] tracking-wider text-white">
              We built this platform with a single purpose — to eliminate operational chaos and
              restore balance to your daily business routine
            </p>
          </BlurFade>

          <BlurFade inView delay={0.2}>
            <div className="font-marck mb-[32px] text-[64px] leading-none text-white md:text-[120px]">
              RentLedger
            </div>
          </BlurFade>

          <div className="mb-[100px] flex w-full flex-col items-center font-light leading-[1.6] text-white md:mb-24">
            <p className="mb-[24px] w-[400px] max-w-full text-center text-[16px]">
              I Was Exhausted By Software That Demanded More Effort Than It Actually Saved. That Is
              Why We Engineered An Autonomous Architecture That Operates Silently In The Background.
            </p>
            <p className="w-[400px] max-w-full text-center text-[16px]">
              Your Business Should Serve Your Life, Not Consume It. Let Our Algorithms Handle The
              Heavy Lifting, So You Can Focus On The Vision.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom video with red gradient blend */}
      <div className="relative w-full shrink-0">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-[100px] w-full bg-gradient-to-b from-[#FF0000] to-transparent" />
        <video autoPlay loop muted playsInline className="block h-auto w-full object-contain">
          <source
            src="https://res.cloudinary.com/daklr2whx/video/upload/v1778602552/track-video_2_s9lp53.mp4"
            type="video/mp4"
          />
        </video>
      </div>
    </section>
  );
}
