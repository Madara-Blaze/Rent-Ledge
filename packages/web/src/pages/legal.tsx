import { ArrowLeft } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/brand-mark';

const UPDATED = '22 June 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark size={20} className="text-[#FF0000]" />
            <span className="text-[15px] font-semibold">RentLedger</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/40">Last updated {UPDATED}</p>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This is a template provided with the product and is <strong>not legal advice</strong>. Have it reviewed and
          adapted by qualified counsel for your jurisdiction before relying on it in production.
        </div>

        <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-white/70">{children}</div>

        <div className="mt-12 flex gap-4 border-t border-white/10 pt-6 text-sm text-white/40">
          <Link to="/terms" className="hover:text-white">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-white">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-lg font-semibold text-white">{children}</h2>;
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of RentLedger (the “Service”), a rental-management
        platform operated by RentLedger (“we”, “us”). By creating an account or using the Service, you agree to these Terms.
      </p>

      <H>1. The Service</H>
      <p>
        RentLedger helps landlords, managers, accountants and tenants manage tenancies — digital agreements, a paise-accurate
        double-entry rent ledger, deposits, maintenance, an evidence vault, typed legal notices and tax-ready reports. The
        Service generates documents and computes statutory figures from configurable, versioned policy data.
      </p>

      <H>2. Not legal or tax advice</H>
      <p>
        RentLedger is a software tool, not a law firm or a tax advisor. Templates, rates, thresholds, notice periods and
        statutory figures are produced from policy data and may not fit your circumstances. Nothing in the Service constitutes
        legal or tax advice. For anything consequential — disputes, eviction, registration, tax filing or contested
        deductions — obtain advice from qualified counsel or a chartered accountant.
      </p>

      <H>3. Accounts and eligibility</H>
      <p>
        You must provide accurate information, keep your credentials secure, and be at least 18 years old and able to form a
        binding contract. You are responsible for activity under your account. Access is role-based; act only within the
        permissions granted to you and only on data you are authorised to access.
      </p>

      <H>4. Acceptable use</H>
      <p>
        You agree not to misuse the Service, including: fabricating records; evading tax or statutory obligations; accessing
        data belonging to other workspaces, landlords or tenants; attempting to breach security; or using the Service
        unlawfully. The append-only ledger, audit log and evidence vault are integrity features — do not attempt to
        circumvent them.
      </p>

      <H>5. Money and records</H>
      <p>
        Financial entries post to an immutable double-entry ledger; balances are computed, not edited. Corrections are made by
        reversing entries and amendments by addenda. You are responsible for the accuracy of the figures and instructions you
        enter and for confirming actions that move money or send notices.
      </p>

      <H>6. Third-party providers</H>
      <p>
        Payments, e-signature, e-stamp, KYC and messaging are delivered through third-party providers (or mock adapters in
        non-production environments). Your use of those features is also subject to the relevant provider’s terms.
      </p>

      <H>7. Intellectual property</H>
      <p>
        The Service, its software and its content are owned by us or our licensors. You retain ownership of the data you
        submit and grant us a limited licence to process it solely to provide the Service.
      </p>

      <H>8. Disclaimers and limitation of liability</H>
      <p>
        The Service is provided “as is” without warranties of any kind. To the maximum extent permitted by law, we are not
        liable for indirect or consequential losses, or for loss arising from reliance on computed figures or generated
        documents that were not reviewed by qualified counsel.
      </p>

      <H>9. Termination</H>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access for breach of these Terms. Certain
        records may be retained where required by law (for example, tax and audit records).
      </p>

      <H>10. Governing law</H>
      <p>
        These Terms are governed by the laws of India, and the courts at the place of our registered office have exclusive
        jurisdiction, subject to applicable consumer-protection law.
      </p>

      <H>11. Changes</H>
      <p>We may update these Terms. Material changes will be notified in-app or by email. Continued use constitutes acceptance.</p>

      <H>12. Contact</H>
      <p>
        Questions about these Terms: <a className="text-white underline-offset-4 hover:underline" href="mailto:legal@rentledger.example">legal@rentledger.example</a>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how RentLedger collects, uses, shares and protects personal data, and your rights under
        the Digital Personal Data Protection Act, 2023 (“DPDP Act”). We act as a data fiduciary for account data and as a
        processor for data your workspace manages about its tenants.
      </p>

      <H>1. Data we collect</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Account &amp; identity:</strong> name, email, phone and role.</li>
        <li><strong>KYC:</strong> PAN, captured for TDS and stored encrypted at rest (only the last four digits are shown).</li>
        <li><strong>Financial:</strong> tenancy, invoice, payment, deposit and ledger records (amounts in integer minor units).</li>
        <li><strong>Operational:</strong> agreements, notices, maintenance tickets, inspections and evidence entries.</li>
        <li><strong>Technical:</strong> authentication tokens, device/IP for security and audit, and usage logs.</li>
      </ul>

      <H>2. How we use data</H>
      <p>
        We use data to provide the Service: operate the ledger, generate agreements and notices, compute statutory figures
        (TDS, stamp duty, notice periods), produce reports, secure accounts and maintain an audit trail. Processing is
        purpose-bound; we practise data minimisation and mask sensitive identifiers (PAN, Aadhaar, bank, phone, email).
      </p>

      <H>3. Legal basis and consent</H>
      <p>
        We process data to perform our contract with you, to comply with legal obligations (e.g. tax and record-keeping), and
        on the basis of consent where required. Consent is captured per purpose and may be withdrawn at any time from the
        Privacy area inside the app.
      </p>

      <H>4. Sharing and processors</H>
      <p>
        We do not sell personal data. We share data only with service providers needed to deliver features — payment
        gateways, e-signature, e-stamp, KYC and messaging providers — under contractual confidentiality and security
        obligations, and where required by law or competent authority.
      </p>

      <H>5. Security</H>
      <p>
        We encrypt sensitive fields (such as PAN) at rest, mask identifiers in summaries, keep secrets and PII out of logs,
        and protect endpoints with authentication, rate limiting and input validation. The ledger, audit log, evidence vault
        and receipts are append-only and database-enforced.
      </p>

      <H>6. Retention</H>
      <p>
        We retain data for as long as needed to provide the Service and to meet legal-retention obligations (for example,
        financial and tax records). Erasure requests are honoured within those statutory limits.
      </p>

      <H>7. Your rights (DPDP)</H>
      <p>
        You have the right to access and export your data, to correct it, to withdraw consent, and to request erasure
        (subject to retention limits). Exercise these from{' '}
        <Link to="/app/privacy" className="text-white underline-offset-4 hover:underline">Privacy → Your data</Link> in the
        app, or by contacting our Grievance Officer below.
      </p>

      <H>8. Cookies and local storage</H>
      <p>
        We use browser local storage to hold your session tokens so you stay signed in; we do not use third-party advertising
        cookies. We choose privacy-preserving defaults.
      </p>

      <H>9. Children</H>
      <p>The Service is not directed to children and we do not knowingly process children’s data without verifiable consent.</p>

      <H>10. Changes</H>
      <p>We may update this Policy and will notify material changes in-app or by email.</p>

      <H>11. Grievance Officer</H>
      <p>
        For privacy questions or to exercise your rights, contact our Grievance Officer at{' '}
        <a className="text-white underline-offset-4 hover:underline" href="mailto:privacy@rentledger.example">privacy@rentledger.example</a>.
      </p>
    </LegalLayout>
  );
}
