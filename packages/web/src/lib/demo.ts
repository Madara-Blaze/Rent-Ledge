/**
 * In-browser demo backend. When VITE_DEMO=1, api.ts routes every request here
 * instead of the network, so the whole UI is explorable without a live API/DB.
 * All figures are clearly-labelled demo fixtures (paise minor units, like the real API).
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';

const now = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 86400000));

const M = (amountMinor: string) => ({ amountMinor, currency: 'INR' });

// ---- seed store (mutable) ----
const store = {
  user: { id: 'u-owner', name: 'Test User', email: 'test@gmail.com', phone: '+919800000000', panValid: true, panLast4: '234F' },
  workspace: { landlordId: 'ws-1', name: 'Thakkar Properties', roles: ['OWNER'] },
  portfolios: [{ id: 'pf-1', name: 'Mumbai residential', landlordId: 'ws-1' }] as Record<string, unknown>[],
  properties: [
    { id: 'prop-1', landlordId: 'ws-1', portfolioId: 'pf-1', name: '12 Marine Drive', address: 'Marine Drive, Mumbai 400020', type: 'RESIDENTIAL' },
    { id: 'prop-2', landlordId: 'ws-1', portfolioId: null, name: 'Prabhadevi Heights', address: 'Prabhadevi, Mumbai 400025', type: 'COMMERCIAL' },
  ] as Record<string, unknown>[],
  units: {
    'prop-1': [{ id: 'un-1', label: 'Flat 3B' }, { id: 'un-2', label: 'Flat 4A' }],
    'prop-2': [{ id: 'un-3', label: 'Shop G-2' }],
  } as Record<string, { id: string; label: string }[]>,
  tenancies: [
    { id: 'ten-1', landlordId: 'ws-1', propertyId: 'prop-1', unitId: 'un-1', status: 'ACTIVE', rentMinor: '5500000', depositMinor: '11000000', billingDay: 5, startDate: '2026-01-01', jurisdiction: 'IN', currency: 'INR', noticeDate: null, endedAt: null, endReason: null },
    { id: 'ten-2', landlordId: 'ws-1', propertyId: 'prop-2', unitId: 'un-3', status: 'NOTICE_PERIOD', rentMinor: '12000000', depositMinor: '24000000', billingDay: 1, startDate: '2025-06-01', jurisdiction: 'IN', currency: 'INR', noticeDate: daysAgo(20), endedAt: null, endReason: null },
  ] as Record<string, unknown>[],
  vendors: [{ id: 'ven-1', landlordId: 'ws-1', name: 'CoolAir HVAC', contact: '+9198xxxxxx21', category: 'HVAC', rating: 4 }] as Record<string, unknown>[],
  tickets: [
    { id: 'tk-1', title: 'Leaking tap in kitchen', status: 'IN_PROGRESS', priority: 'HIGH', category: 'Plumbing', costBearer: 'LANDLORD' },
    { id: 'tk-2', title: 'AC not cooling', status: 'OPEN', priority: 'NORMAL', category: 'HVAC', costBearer: 'TENANT' },
  ] as Record<string, unknown>[],
  notices: [
    { id: 'no-1', type: 'RENT_REMINDER', subject: 'Rent due reminder for June', body: 'This is a reminder that June rent is due on the 5th.', effectiveDate: null, minNoticeDays: 0, status: 'SENT', createdAt: daysAgo(8) },
    { id: 'no-2', type: 'RENT_INCREASE', subject: 'Rent revision from October', body: 'Per the agreement, rent will be revised by 5% from 1 October.', effectiveDate: '2026-10-01', minNoticeDays: 60, status: 'DRAFT', createdAt: daysAgo(2) },
  ] as Record<string, unknown>[],
  evidence: [
    { id: 'ev-1', seq: '1', entryType: 'MOVE_IN', summary: 'Move-in inspection photos uploaded', entryHash: '9f2b7c1a44de83b0c5e1', prevHash: 'GENESIS', createdAt: daysAgo(170) },
    { id: 'ev-2', seq: '2', entryType: 'PAYMENT', summary: 'Rent payment ₹55,000 recorded', entryHash: '3c8a1de990fb2271aa04', prevHash: '9f2b7c1a44de83b0c5e1', createdAt: daysAgo(35) },
    { id: 'ev-3', seq: '3', entryType: 'NOTICE_SENT', summary: 'RENT_REMINDER: Rent due reminder for June', entryHash: 'a1b2c3d4e5f607182930', prevHash: '3c8a1de990fb2271aa04', createdAt: daysAgo(8) },
  ] as Record<string, unknown>[],
  disputes: [{ id: 'dp-1', landlordId: 'ws-1', tenancyId: 'ten-2', title: 'Deposit deduction contested', status: 'UNDER_REVIEW', resolutionNotes: null, createdAt: daysAgo(12) }] as Record<string, unknown>[],
  consents: [{ id: 'cs-1', purpose: 'rent_reminders', granted: true, granted_at: daysAgo(170), withdrawn_at: null }] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  policies: [
    { id: 'pol-1', jurisdiction: 'IN', version: 1, effective_from: '2025-04-01', effective_to: '2026-03-31', reviewed_by_counsel: false, created_at: daysAgo(400) },
    { id: 'pol-2', jurisdiction: 'IN', version: 2, effective_from: '2026-04-01', effective_to: null, reviewed_by_counsel: false, created_at: daysAgo(80) },
  ] as Record<string, unknown>[],
  audit: [
    { id: 'au-1', actorUserId: 'u-owner', action: 'payment.record', resourceType: 'payment', resourceId: 'pay-1', ip: '127.0.0.1', createdAt: daysAgo(35) },
    { id: 'au-2', actorUserId: 'u-owner', action: 'notice.send', resourceType: 'notice', resourceId: 'no-1', ip: '127.0.0.1', createdAt: daysAgo(8) },
    { id: 'au-3', actorUserId: 'u-owner', action: 'tenancy.start_notice', resourceType: 'tenancy', resourceId: 'ten-2', ip: '127.0.0.1', createdAt: daysAgo(20) },
  ] as Record<string, unknown>[],
};

let seq = 100;
const id = (p: string) => `${p}-${seq++}`;

const ledger: Record<string, { code: string; type: string; balanceMinor: string }[]> = {
  'ten-1': [
    { code: 'RENT_RECEIVABLE', type: 'ASSET', balanceMinor: '5500000' },
    { code: 'RENT_INCOME', type: 'INCOME', balanceMinor: '33000000' },
    { code: 'CASH', type: 'ASSET', balanceMinor: '27500000' },
    { code: 'TENANT_ADVANCE', type: 'LIABILITY', balanceMinor: '0' },
    { code: 'SECURITY_DEPOSIT_LIABILITY', type: 'LIABILITY', balanceMinor: '11000000' },
    { code: 'TDS_RECEIVABLE', type: 'ASSET', balanceMinor: '660000' },
  ],
  'ten-2': [
    { code: 'RENT_RECEIVABLE', type: 'ASSET', balanceMinor: '0' },
    { code: 'RENT_INCOME', type: 'INCOME', balanceMinor: '144000000' },
    { code: 'SECURITY_DEPOSIT_LIABILITY', type: 'LIABILITY', balanceMinor: '24000000' },
  ],
};

function reports() {
  return {
    income: { period: 'FY 2026-27', from: '2026-04-01', to: '2027-04-01', lines: [{ code: 'RENT_INCOME', label: 'Rent income', amountMinor: '33000000' }, { code: 'LATE_FEE_INCOME', label: 'Late fee income', amountMinor: '250000' }], totalIncomeMinor: '33250000' },
    expense: { period: 'FY 2026-27', lines: [{ code: 'MAINTENANCE_EXPENSE', label: 'Maintenance expense', amountMinor: '1800000' }], totalExpenseMinor: '1800000' },
    pnl: { period: 'FY 2026-27', properties: [{ propertyId: 'prop-1', propertyName: '12 Marine Drive', incomeMinor: '33000000', expenseMinor: '1800000', netMinor: '31200000' }, { propertyId: 'prop-2', propertyName: 'Prabhadevi Heights', incomeMinor: '250000', expenseMinor: '0', netMinor: '250000' }], totalIncomeMinor: '33250000', totalExpenseMinor: '1800000', netMinor: '31450000' },
    tds: { period: 'FY 2026-27', totalTdsMinor: '660000', byTenancy: [{ tenancyId: 'ten-1', amountMinor: '660000' }] },
    deposits: { totalHeldMinor: '35000000', byTenancy: [{ tenancyId: 'ten-1', heldMinor: '11000000' }, { tenancyId: 'ten-2', heldMinor: '24000000' }] },
  };
}

function agreementDetail(agreementId: string, status: string) {
  const signed = status === 'SIGNED';
  return {
    id: agreementId,
    tenancyId: 'ten-1',
    title: 'Rental Agreement — Rohan Mehta',
    status,
    termMonths: 11,
    jurisdiction: 'IN',
    propertyType: 'RESIDENTIAL',
    registrationRequired: false,
    registrationStatus: 'NOT_REQUIRED',
    stampDutyMinor: '50000',
    stampDutyStatus: 'PAID',
    rentAuthorityRequired: false,
    rentAuthorityStatus: 'NOT_REQUIRED',
    rentAuthorityDue: null,
    rentAuthorityRef: null,
    supersedesId: null,
    createdAt: daysAgo(170),
    currentVersion: {
      version: 1,
      contentHash: 'b7f3a1c92e84d05f6a1b2c3d4e5f60718293a4b5c6d7e8f9',
      clauses: [{ title: 'Parties & Premises' }, { title: 'Rent & Escalation' }, { title: 'Security Deposit' }, { title: 'Termination' }],
      renderedText:
        'THIS RENTAL AGREEMENT is made between Thakkar Properties (Landlord) and Rohan Mehta (Tenant) for the premises at 12 Marine Drive, Flat 3B.\n\n1. RENT. The Tenant shall pay ₹55,000 per month on or before the 5th day of each month.\n\n2. DEPOSIT. The Tenant has paid a refundable security deposit of ₹1,10,000.\n\n3. TERM. 11 months commencing 1 January 2026.\n\n4. NOTICE. Either party may terminate with 30 days written notice.\n\n(Demo document — templates require counsel review.)',
    },
    signers: signed
      ? [
          { partyRole: 'LANDLORD', name: 'Aarav Thakkar', provider: 'mock-esign', documentHash: 'b7f3a1c9', signedAt: daysAgo(168), status: 'SIGNED' },
          { partyRole: 'TENANT', name: 'Rohan Mehta', provider: 'mock-esign', documentHash: 'b7f3a1c9', signedAt: daysAgo(167), status: 'SIGNED' },
        ]
      : [],
  };
}

function notFound(): never {
  throw Object.assign(new Error('Demo endpoint not implemented'), { status: 404 });
}

// ---- demo auth: credential-aware login/signup with a localStorage session ----
const SESSION_KEY = 'rl_demo_session';
interface DemoAccount { email: string; password: string }
const accounts: DemoAccount[] = [{ email: 'test@gmail.com', password: 'test' }];

function getSession(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function setSession(email: string): void {
  try { localStorage.setItem(SESSION_KEY, email); } catch { /* ignore */ }
}
function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
function authFail(message: string, status = 401): never {
  throw Object.assign(new Error(message), { status });
}
function authTokens() {
  return { accessToken: 'demo', refreshToken: 'demo', tokenType: 'Bearer', expiresIn: 900, user: store.user, landlordId: 'ws-1' };
}

/** Returns a string for CSV endpoints, otherwise a JSON-able value. */
export async function demoFetch(rawPath: string, method = 'GET', body?: Record<string, unknown>): Promise<unknown> {
  const [path, qs = ''] = rawPath.split('?');
  const query = new URLSearchParams(qs);
  const b = body ?? {};
  const seg = path.split('/').filter(Boolean); // e.g. ['tenancies','ten-1','ledger']

  // --- auth (credential-aware; session persisted in localStorage) ---
  if (path === '/auth/login') {
    const identifier = String(b.identifier ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const acct = accounts.find((a) => a.email.toLowerCase() === identifier && a.password === password);
    if (!acct) authFail('Invalid email or password');
    store.user.email = acct.email;
    setSession(acct.email);
    return authTokens();
  }
  if (path === '/auth/signup') {
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    if (!email || !password) authFail('Email and password are required', 400);
    if (accounts.some((a) => a.email.toLowerCase() === email)) authFail('An account with that email already exists', 409);
    accounts.push({ email, password });
    if (b.name) store.user.name = String(b.name);
    store.user.email = email;
    setSession(email);
    return authTokens();
  }
  if (path === '/auth/otp/verify') {
    const identifier = String(b.identifier ?? '').trim().toLowerCase();
    if (String(b.code ?? '') !== '123456') authFail('Invalid or expired code');
    const acct = accounts.find((a) => a.email.toLowerCase() === identifier);
    if (acct) store.user.email = acct.email;
    setSession(identifier || store.user.email);
    return authTokens();
  }
  if (path === '/auth/invitations/accept') {
    if (!b.token) authFail('Invalid invitation token', 400);
    setSession(store.user.email);
    return authTokens();
  }
  if (path === '/auth/otp/request') return { sent: true, devCode: '123456' };
  if (path === '/auth/refresh') {
    if (!getSession()) authFail('Session expired');
    return authTokens();
  }
  if (path === '/auth/logout') {
    clearSession();
    return { loggedOut: true };
  }
  if (path === '/auth/me') {
    const email = getSession();
    if (!email) authFail('Not authenticated');
    store.user.email = email;
    return { user: store.user, workspaces: [store.workspace], tenancies: [] };
  }
  if (path === '/auth/kyc/pan') {
    store.user.panValid = true;
    store.user.panLast4 = String(b.pan ?? 'XXXX234F').slice(-4);
    return { panLast4: store.user.panLast4, panValid: true };
  }

  // --- portfolios / properties / units ---
  if (path === '/workspaces/ws-1/portfolios') {
    if (method === 'POST') { const r = { id: id('pf'), name: b.name, landlordId: 'ws-1' }; store.portfolios.push(r); return r; }
    return store.portfolios;
  }
  if (path === '/workspaces/ws-1/properties') {
    if (method === 'POST') { const r = { id: id('prop'), landlordId: 'ws-1', portfolioId: b.portfolioId ?? null, name: b.name, address: b.address ?? null, type: b.type ?? 'RESIDENTIAL' }; store.properties.push(r); return r; }
    return store.properties;
  }
  if (seg[0] === 'properties' && seg[2] === 'units') {
    const pid = seg[1];
    if (method === 'POST') { const r = { id: id('un'), label: b.label as string }; (store.units[pid] ??= []).push(r); return r; }
    return store.units[pid] ?? [];
  }

  // --- tenancies ---
  if (path === '/workspaces/ws-1/tenancies') {
    if (method === 'POST') {
      const r = { id: id('ten'), landlordId: 'ws-1', propertyId: b.propertyId, unitId: b.unitId ?? null, status: 'DRAFT', rentMinor: b.rentMinor, depositMinor: b.depositMinor ?? '0', billingDay: b.billingDay ?? 1, startDate: b.startDate, jurisdiction: 'IN', currency: 'INR', noticeDate: null, endedAt: null, endReason: null };
      store.tenancies.push(r);
      return r;
    }
    return store.tenancies;
  }
  if (path === '/workspaces/ws-1/invitations') return [];
  if (seg[0] === 'tenancies' && seg.length === 2 && method === 'GET') {
    return store.tenancies.find((t) => t.id === seg[1]) ?? notFound();
  }
  if (seg[0] === 'tenancies' && seg[2] === 'transition') {
    const t = store.tenancies.find((x) => x.id === seg[1]);
    if (t) {
      const map: Record<string, string> = { ISSUE_AGREEMENT: 'AGREEMENT_PENDING', ACTIVATE: 'ACTIVE', START_NOTICE: 'NOTICE_PERIOD', RENEW: 'RENEWED', END: 'ENDED', TERMINATE: 'TERMINATED', EVICT: 'EVICTED' };
      t.status = map[b.action as string] ?? t.status;
    }
    return t ?? {};
  }
  if (seg[0] === 'tenancies' && seg[2] === 'inspections') {
    const key = `insp-${seg[1]}`;
    const list = ((store as Record<string, unknown>)[key] as Record<string, unknown>[]) ?? [
      { id: 'in-1', type: 'MOVE_IN', conditionNotes: 'Good condition. Meter reading 12,341. All fixtures intact.', conductedAt: daysAgo(170), createdAt: daysAgo(170) },
    ];
    if (method === 'POST') { const r = { id: id('in'), type: b.type, conditionNotes: b.conditionNotes ?? null, conductedAt: b.conductedAt ?? iso(now), createdAt: iso(now) }; list.push(r); (store as Record<string, unknown>)[key] = list; return r; }
    (store as Record<string, unknown>)[key] = list;
    return list;
  }
  if (seg[0] === 'tenancies' && seg[2] === 'invitations' && method === 'POST') {
    return { id: id('inv'), tenancyId: seg[1], email: b.email ?? null, phone: b.phone ?? null, status: 'PENDING', expiresAt: daysAgo(-7), token: 'demo-invite-' + Math.random().toString(36).slice(2, 10) };
  }

  // --- ledger / arrears / deposits / tax ---
  if (seg[0] === 'tenancies' && seg[2] === 'ledger') return ledger[seg[1]] ?? [];
  if (seg[0] === 'tenancies' && seg[2] === 'arrears') {
    return seg[1] === 'ten-1'
      ? { bucket0to30: '5500000', bucket31to60: '0', bucket61to90: '0', bucket90plus: '0', totalOutstanding: '5500000' }
      : { bucket0to30: '0', bucket31to60: '0', bucket61to90: '0', bucket90plus: '0', totalOutstanding: '0' };
  }
  if (seg[0] === 'deposits' && seg[2] === 'statement') {
    const t = store.tenancies.find((x) => x.id === seg[1]);
    const dep = (t?.depositMinor as string) ?? '0';
    return { tenancyId: seg[1], currency: 'INR', status: dep === '0' ? 'NONE' : 'HELD', target: M(dep), collected: M(dep), deducted: M('0'), interest: M('0'), refunded: M('0'), balanceHeld: M(dep) };
  }
  if (path === '/deposits/collect' || path === '/deposits/deduct' || path === '/deposits/refund') {
    const t = store.tenancies.find((x) => x.id === b.tenancyId);
    const dep = (t?.depositMinor as string) ?? '0';
    return { tenancyId: b.tenancyId, currency: 'INR', status: 'HELD', target: M(dep), collected: M(dep), deducted: M('0'), interest: M('0'), refunded: M('0'), balanceHeld: M(dep) };
  }
  if (path === '/tax/tds/preview') {
    return { applicable: true, reason: 'Rent exceeds the ₹50,000/month threshold under §194-IB.', section: '194IB', rateBps: 200, panSurchargeApplied: false, base: M('66000000'), amount: M('1320000'), returnForm: '26QC', certificateForm: '16C', filingDueDays: 30, deductionTiming: 'ONCE_A_YEAR' };
  }

  // --- invoicing ---
  if (path === '/invoices/preview') return { baseRent: M('5500000'), escalatedRent: M('5500000'), escalationPeriodsApplied: 0, chargeableDays: 30, totalDays: 30, prorationBasis: 'ACTUAL_DAYS_IN_PERIOD', amount: M('5500000') };
  if (path === '/invoices') return { id: id('inv'), number: `RENT-2026-${seq}`, kind: 'RENT', tenancyId: b.tenancyId, periodStart: b.periodStart, periodEnd: b.periodEnd, dueDate: b.dueDate, amount: M('5500000'), status: 'OPEN', journalEntryId: id('je') };
  if (path === '/invoices/late-fee') return { applied: true, daysLate: 6, chargeableDays: 1, fee: M('55000'), invoice: { id: b.invoiceId, number: 'RENT-2026-LATE', kind: 'LATE_FEE', tenancyId: 'ten-1', dueDate: daysAgo(6), amount: M('5555000'), status: 'OPEN' } };

  // --- payments ---
  if (path === '/payments') {
    const amt = String(b.amountMinor);
    const tds = String(b.tdsMinor ?? '0');
    return { id: id('pay'), tenancyId: b.tenancyId, method: b.method, amount: M(amt), tds: M(tds), status: 'COMPLETED', allocations: Array.isArray(b.allocations) ? (b.allocations as Record<string, unknown>[]).map((a) => ({ invoiceId: a.invoiceId, amount: M(String(a.amountMinor)) })) : [{ invoiceId: 'inv-oldest', amount: M(amt) }], advance: M('0'), journalEntryId: id('je') };
  }

  // --- agreements ---
  if (seg[0] === 'tenancies' && seg[2] === 'agreements') {
    return [{ id: 'ag-1', tenancyId: seg[1], title: 'Rental Agreement — Rohan Mehta', status: 'SIGNED', termMonths: 11, jurisdiction: 'IN', propertyType: 'RESIDENTIAL', registrationRequired: false, registrationStatus: 'NOT_REQUIRED', stampDutyMinor: '50000', stampDutyStatus: 'PAID', rentAuthorityRequired: false, rentAuthorityStatus: 'NOT_REQUIRED', rentAuthorityDue: null, rentAuthorityRef: null, supersedesId: null, createdAt: daysAgo(170) }];
  }
  if (path === '/agreements' && method === 'POST') return agreementDetail(id('ag'), 'DRAFT');
  if (seg[0] === 'agreements' && seg.length === 2) return agreementDetail(seg[1], 'SIGNED');
  if (seg[0] === 'agreements' && seg[2] === 'send') return agreementDetail(seg[1], 'OUT_FOR_SIGNATURE');
  if (seg[0] === 'agreements' && seg[2] === 'sign') return agreementDetail(seg[1], 'SIGNED');
  if (seg[0] === 'agreements' && (seg[2] === 'addendum' || seg[2] === 'compliance')) return agreementDetail(seg[1], 'SIGNED');

  // --- notices ---
  if (seg[0] === 'tenancies' && seg[2] === 'notices') return store.notices;
  if (path === '/notices' && method === 'POST') { const r = { id: id('no'), type: b.type, subject: b.subject, body: b.body, effectiveDate: b.effectiveDate ?? null, minNoticeDays: b.type === 'RENT_INCREASE' ? 60 : 0, status: 'DRAFT', createdAt: iso(now) }; store.notices.push(r); return r; }
  if (seg[0] === 'notices' && seg[2] === 'send') { const n = store.notices.find((x) => x.id === seg[1]); if (n) n.status = 'SENT'; return { ...(n ?? {}), deliveryReceipts: [{ id: id('dr'), channel: b.channel ?? 'EMAIL', status: 'DELIVERED', providerRef: 'mock-ref' }] }; }
  if (seg[0] === 'notices' && seg.length === 2) { const n = store.notices.find((x) => x.id === seg[1]); return { ...(n ?? {}), deliveryReceipts: n?.status === 'SENT' ? [{ id: 'dr-1', channel: 'EMAIL', status: 'DELIVERED', providerRef: 'mock-ref' }] : [] }; }

  // --- house rules ---
  if (seg[0] === 'tenancies' && seg[2] === 'house-rules') return { current: { id: 'hr-2', version: 2, body: '1. No subletting without written consent.\n2. Quiet hours 10pm–7am.\n3. No structural changes without approval.\n4. Maintenance requests via the portal.' }, acknowledged: false };
  if (path === '/workspaces/ws-1/house-rules') {
    if (method === 'POST') return { id: id('hr'), version: 3, body: b.body, propertyId: b.propertyId ?? null, createdAt: iso(now) };
    return [{ id: 'hr-2', version: 2, body: 'Current rules…', propertyId: 'prop-1', createdAt: daysAgo(40) }, { id: 'hr-1', version: 1, body: 'Original rules…', propertyId: 'prop-1', createdAt: daysAgo(170) }];
  }
  if (seg[0] === 'house-rules' && seg[2] === 'acknowledge') return { id: id('ack'), houseRulesVersionId: seg[1], tenancyId: b.tenancyId };

  // --- maintenance ---
  if (path === '/workspaces/ws-1/vendors') { if (method === 'POST') { const r = { id: id('ven'), landlordId: 'ws-1', name: b.name, contact: b.contact ?? null, category: b.category ?? null, rating: null }; store.vendors.push(r); return r; } return store.vendors; }
  if (path === '/workspaces/ws-1/maintenance/tickets') return store.tickets;
  if (seg[0] === 'tenancies' && seg[2] === 'maintenance') { const r = { id: id('tk'), title: b.title, status: 'OPEN', priority: b.priority ?? 'NORMAL', category: b.category ?? null, costBearer: 'LANDLORD' }; store.tickets.push(r); return r; }
  if (seg[0] === 'maintenance' && seg[1] === 'tickets' && seg.length === 3) {
    const t = store.tickets.find((x) => x.id === seg[2]);
    if (method === 'POST' && t) { if (b.status) t.status = b.status; if (b.priority) t.priority = b.priority; if (b.costBearer) t.costBearer = b.costBearer; }
    return { ...(t ?? {}), description: 'Reported via the tenant portal.', costMinor: '0', assignedVendorId: null, events: [{ id: 'te-1', type: 'CREATED', note: (t?.title as string) ?? null, createdAt: daysAgo(5) }, { id: 'te-2', type: `STATUS_${(t?.status as string) ?? 'OPEN'}`, note: b.note ?? null, createdAt: iso(now) }] };
  }

  // --- evidence / disputes ---
  if (path === '/workspaces/ws-1/evidence') { if (method === 'POST') { const r = { id: id('ev'), seq: String(store.evidence.length + 1), entryType: b.entryType ?? 'NOTE', summary: b.summary, entryHash: Math.random().toString(16).slice(2, 22), prevHash: 'x', createdAt: iso(now) }; store.evidence.push(r); return r; } return store.evidence.filter((e) => !query.get('disputeCaseId') || e.id === 'ev-3'); }
  if (path === '/workspaces/ws-1/evidence/verify') return { valid: true, count: store.evidence.length };
  if (path === '/workspaces/ws-1/evidence/bundle') return { generatedAt: iso(now), landlordId: 'ws-1', count: store.evidence.length, verification: { valid: true, count: store.evidence.length }, manifest: { algorithm: 'sha256 hash chain', genesisHash: 'GENESIS', headHash: store.evidence[store.evidence.length - 1]?.entryHash }, entries: store.evidence };
  if (path === '/workspaces/ws-1/disputes') { if (method === 'POST') { const r = { id: id('dp'), landlordId: 'ws-1', tenancyId: b.tenancyId ?? null, title: b.title, status: 'OPEN', resolutionNotes: null, createdAt: iso(now) }; store.disputes.push(r); return r; } return store.disputes; }
  if (seg[0] === 'workspaces' && seg[2] === 'disputes' && seg.length === 4) { const d = store.disputes.find((x) => x.id === seg[3]); if (d) { if (b.status) d.status = b.status; if (b.resolutionNotes !== undefined) d.resolutionNotes = b.resolutionNotes; } return d ?? {}; }

  // --- roles / audit ---
  if (path === '/workspaces/ws-1/roles') {
    if (method === 'POST') return { id: id('ra') };
    return [{ id: 'ra-1', userId: 'u-owner', userName: 'Aarav Thakkar', role: 'OWNER', scopeType: 'LANDLORD', scopeId: 'ws-1' }, { id: 'ra-2', userId: 'u-mgr', userName: 'Priya Nair', role: 'MANAGER', scopeType: 'LANDLORD', scopeId: 'ws-1' }];
  }
  if (path.startsWith('/workspaces/ws-1/roles/')) return { revoked: true };
  if (path === '/workspaces/ws-1/audit') return store.audit;

  // --- reports ---
  if (path === '/workspaces/ws-1/reports/income-statement') return reports().income;
  if (path === '/workspaces/ws-1/reports/expense-report') return reports().expense;
  if (path === '/workspaces/ws-1/reports/pnl') return reports().pnl;
  if (path === '/workspaces/ws-1/reports/tds-summary') return reports().tds;
  if (path === '/workspaces/ws-1/reports/deposits-summary') return reports().deposits;
  if (path === '/workspaces/ws-1/reports/ca-pack') { const r = reports(); return { financialYear: '2026-27', period: { from: '2026-04-01', to: '2027-04-01' }, income: r.income, expenses: r.expense, tds: r.tds, deposits: r.deposits, generatedAt: iso(now) }; }
  if (path === '/workspaces/ws-1/reports/ca-pack.csv') return 'Section,Account,Amount (paise)\nIncome,Rent income,33000000\nIncome,Late fee income,250000\nExpenses,Maintenance expense,1800000\nTDS,ten-1,660000\nDeposits,ten-1,11000000\nDeposits,ten-2,24000000\n';

  // --- DPDP ---
  if (path === '/me/consents') { if (method === 'POST') { const r = { id: id('cs'), purpose: b.purpose, granted: b.granted ?? true, granted_at: b.granted ? iso(now) : null, withdrawn_at: b.granted ? null : iso(now) }; store.consents.unshift(r); return r; } return store.consents; }
  if (path === '/me/data-export') return { exportedAt: iso(now), user: store.user, consents: store.consents, roles: [{ role: 'OWNER', scope_type: 'LANDLORD', scope_id: 'ws-1' }], tenancies: [] };
  if (path === '/me/erasure-request') { const r = { id: id('dsr'), type: 'ERASURE', status: 'PENDING', created_at: iso(now), completed_at: null }; store.requests.unshift(r); return r; }
  if (path === '/me/requests') return store.requests;

  // --- admin policies ---
  if (path === '/admin/policies') { if (method === 'POST') { const r = { id: id('pol'), jurisdiction: b.jurisdiction, version: b.version, effective_from: b.effectiveFrom, effective_to: b.effectiveTo ?? null, reviewed_by_counsel: b.reviewedByCounsel ?? false, created_at: iso(now) }; store.policies.push(r); return r; } return store.policies; }

  return notFound();
}
