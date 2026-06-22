import { BrandMark } from '@/components/brand-mark';

const columns = [
  { title: 'Product', links: ['Ledger', 'Payments', 'Agreements', 'Reports'] },
  { title: 'Company', links: ['About', 'Careers', 'Contact'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'DPDP'] },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <a href="#" className="flex items-center gap-2.5 text-white">
              <BrandMark size={22} className="text-[#FF0000]" />
              <span className="text-[15px] font-semibold">RentLedger</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              The single source of truth for the landlord–tenant relationship. Built in India, for
              the world.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-white">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/45 transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row sm:items-center">
          <span>© 2026 RentLedger. Not legal or tax advice.</span>
          <span>Money is sacred. We treat it that way.</span>
        </div>
      </div>
    </footer>
  );
}
