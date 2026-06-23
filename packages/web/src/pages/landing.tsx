'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CtaSection } from '@/components/cta/cta-section';
import { Loader } from '@/components/loader';
import { Features } from '@/components/sections/features';
import { Footer } from '@/components/sections/footer';
import { Hero } from '@/components/sections/hero';
import { Navbar } from '@/components/sections/navbar';

export function Landing() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minimum = window.setTimeout(() => setLoading(false), 2800);
    const onLoad = () => window.setTimeout(() => setLoading(false), 900);
    window.addEventListener('load', onLoad);
    return () => {
      window.clearTimeout(minimum);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            className="fixed inset-0 z-[100]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            <Loader />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative overflow-x-hidden bg-black">
        <Navbar />
        <Hero />
        <Features />
        <CtaSection />
        <Footer />
      </main>
    </>
  );
}
