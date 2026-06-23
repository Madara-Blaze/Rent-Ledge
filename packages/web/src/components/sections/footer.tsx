import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/brand-mark';

const columns: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Ledger', href: '#product' },
      { label: 'Payments', href: '#product' },
      { label: 'Agreements', href: '#product' },
      { label: 'Reports', href: '#product' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: 'mailto:hello@rentledger.example' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Your data (DPDP)', to: '/app/privacy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-50 border-t border-white/10 bg-black">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:grid-cols-6">
          <div className="col-span-2 md:col-span-3">
            <a href="#" className="flex items-center gap-2.5 text-white">
              <BrandMark size={22} className="text-[#FF0000]" />
              <span className="text-[15px] font-semibold">RentLedger</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              The single source of truth for the landlord–tenant relationship — digital agreements, a paise-accurate
              double-entry ledger, deposits, maintenance, an evidence vault and tax-ready reporting. India-first,
              multi-jurisdiction-ready.
            </p>
            <div className="mt-5 space-y-1 text-sm text-white/45">
              <p>
                General:{' '}
                <a className="text-white/70 hover:text-white" href="mailto:hello@rentledger.example">
                  hello@rentledger.example
                </a>
              </p>
              <p>
                Support:{' '}
                <a className="text-white/70 hover:text-white" href="mailto:support@rentledger.example">
                  support@rentledger.example
                </a>
              </p>
              <p>
                Privacy / Grievance Officer:{' '}
                <a className="text-white/70 hover:text-white" href="mailto:privacy@rentledger.example">
                  privacy@rentledger.example
                </a>
              </p>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-white">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="text-sm text-white/45 transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href ?? '#'} className="text-sm text-white/45 transition-colors hover:text-white">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-8 text-xs text-white/40">
          <p>RentLedger Technologies Pvt. Ltd. · Registered office: Mumbai, Maharashtra, India · CIN: U72900MH2026PTC000000</p>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span>© 2026 RentLedger. All rights reserved. Not legal or tax advice.</span>
            <div className="flex flex-wrap gap-4">
              <Link to="/terms" className="hover:text-white">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <a href="mailto:privacy@rentledger.example" className="hover:text-white">
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
