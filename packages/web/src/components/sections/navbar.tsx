'use client';

import { useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Ledger', href: '#ledger' },
  { label: 'Compliance', href: '#compliance' },
  { label: 'Story', href: '#story' },
];

export function Navbar() {
  const navigate = useNavigate();
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mt-4 flex h-14 items-center justify-between rounded-full border border-white/10 bg-black/40 pl-6 pr-3 backdrop-blur-xl">
          <a href="#" className="flex items-center gap-2.5 text-white">
            <BrandMark size={20} className="text-[#FF0000]" />
            <span className="text-[15px] font-semibold tracking-tight">RentLedger</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-white/55 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
              Get started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
