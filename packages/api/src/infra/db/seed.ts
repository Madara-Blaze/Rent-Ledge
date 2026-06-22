/**
 * Seed a full demo tenancy that exercises the whole financial core, so balances,
 * arrears, deposit and TDS are non-trivial out of the box. Runs through the REAL
 * services (not raw inserts) so every figure flows through the double-entry ledger.
 *
 *   pnpm db:migrate && pnpm db:seed
 *
 * Idempotent: fixed demo ids + idempotency keys mean re-running is safe.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { hashPassword } from '../../common/crypto/password';
import { INDIA_DEFAULT_POLICY } from '../../domain/policy/india-default.policy';
import { DepositsService } from '../../modules/deposits/deposits.service';
import { InvoicingService } from '../../modules/invoicing/invoicing.service';
import { LedgerService } from '../../modules/ledger/ledger.service';
import { PaymentsService } from '../../modules/payments/payments.service';
import { TaxService } from '../../modules/tax/tax.service';
import { loadEnv, type Db } from './client';
import { DRIZZLE } from './db.module';
import {
  jurisdictionPolicies,
  landlords,
  properties,
  roleAssignments,
  tenancies,
  tenants,
  units,
  users,
} from './schema';

const LANDLORD = '11111111-1111-1111-1111-111111111111';
const TENANT = '22222222-2222-2222-2222-222222222222';
const PROPERTY = '33333333-3333-3333-3333-333333333333';
const UNIT = '44444444-4444-4444-4444-444444444444';
const TENANCY = '55555555-5555-5555-5555-555555555555';
const OWNER_USER = '66666666-6666-6666-6666-666666666666';
const TENANT_USER = '77777777-7777-7777-7777-777777777777';
const DEMO_PASSWORD = 'password123';

async function main(): Promise<void> {
  loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<Db>(DRIZZLE);
  const invoicing = app.get(InvoicingService);
  const payments = app.get(PaymentsService);
  const deposits = app.get(DepositsService);
  const ledger = app.get(LedgerService);
  const tax = app.get(TaxService);

  // 1) Jurisdiction policy (India default).
  await db
    .insert(jurisdictionPolicies)
    .values({
      jurisdiction: INDIA_DEFAULT_POLICY.jurisdiction,
      version: INDIA_DEFAULT_POLICY.version,
      effectiveFrom: INDIA_DEFAULT_POLICY.effectiveFrom,
      effectiveTo: INDIA_DEFAULT_POLICY.effectiveTo ?? null,
      reviewedByCounsel: INDIA_DEFAULT_POLICY.reviewedByCounsel,
      body: INDIA_DEFAULT_POLICY,
    })
    .onConflictDoNothing();

  // 2) Login identities. Both sign in with the demo password.
  const passwordHash = hashPassword(DEMO_PASSWORD);
  await db.insert(users).values([
    { id: OWNER_USER, name: 'Demo Owner', email: 'owner@example.com', passwordHash, isPlatformAdmin: true },
    { id: TENANT_USER, name: 'Demo Tenant', email: 'tenant@example.com', passwordHash },
  ]).onConflictDoNothing();

  // 3) Parties + property + unit + tenancy (₹55,000/month, 10% annual escalation).
  await db.insert(landlords).values({
    id: LANDLORD,
    name: 'Demo Landlord',
    email: 'owner@example.com',
    panValid: true,
    jurisdiction: 'IN',
    ownerUserId: OWNER_USER,
  }).onConflictDoNothing();

  await db.insert(tenants).values({
    id: TENANT,
    name: 'Demo Tenant',
    email: 'tenant@example.com',
    phone: '+919999999999',
    payerClass: 'INDIVIDUAL_HUF',
    userId: TENANT_USER,
  }).onConflictDoNothing();

  await db.insert(properties).values({
    id: PROPERTY,
    landlordId: LANDLORD,
    name: 'Demo Residency',
    address: '12 MG Road, Bengaluru',
    type: 'RESIDENTIAL',
  }).onConflictDoNothing();

  await db.insert(units).values({ id: UNIT, propertyId: PROPERTY, label: 'A-101' }).onConflictDoNothing();

  await db.insert(tenancies).values({
    id: TENANCY,
    landlordId: LANDLORD,
    propertyId: PROPERTY,
    unitId: UNIT,
    primaryTenantId: TENANT,
    currency: 'INR',
    jurisdiction: 'IN',
    rentMinor: 5_500_000n, // ₹55,000
    depositMinor: 5_500_000n, // ₹55,000
    billingDay: 1,
    startDate: '2025-06-01',
    escalation: {
      type: 'PERCENT',
      rateBps: 1000, // 10% per year
      frequencyMonths: 12,
      startDate: '2025-06-01',
      compounding: true,
    },
    status: 'ACTIVE',
  }).onConflictDoNothing();

  // 4) Grant RBAC roles: owner on the workspace, tenant on the tenancy.
  await db
    .insert(roleAssignments)
    .values([
      { userId: OWNER_USER, role: 'OWNER', scopeType: 'LANDLORD', scopeId: LANDLORD, grantedBy: OWNER_USER },
      { userId: TENANT_USER, role: 'TENANT', scopeType: 'TENANCY', scopeId: TENANCY, grantedBy: OWNER_USER },
    ])
    .onConflictDoNothing();

  // 5) Collect the security deposit.
  await deposits.collect({ tenancyId: TENANCY, amountMinor: '5500000', idempotencyKey: 'seed-deposit' });

  // 6) Three months of rent invoices (the 2026 one is escalated to ₹60,500).
  const months = [
    { periodStart: '2025-06-01', periodEnd: '2025-06-30', dueDate: '2025-06-05', key: 'seed-inv-2025-06' },
    { periodStart: '2025-07-01', periodEnd: '2025-07-31', dueDate: '2025-07-05', key: 'seed-inv-2025-07' },
    { periodStart: '2026-06-01', periodEnd: '2026-06-30', dueDate: '2026-06-05', key: 'seed-inv-2026-06' },
  ];
  for (const m of months) {
    const inv = await invoicing.createRentInvoice({ tenancyId: TENANCY, ...m, idempotencyKey: m.key });
    console.log(`  invoice ${inv.number}  ${m.periodStart}  ${inv.amount.amountMinor} ${inv.amount.currency}  [${inv.status}]`);
  }

  // 7) Payments: June paid in full, July partial; 2026-06 left unpaid (arrears).
  await payments.recordPayment({
    tenancyId: TENANCY,
    amountMinor: '5500000',
    method: 'UPI',
    idempotencyKey: 'seed-pay-2025-06',
  });
  await payments.recordPayment({
    tenancyId: TENANCY,
    amountMinor: '3000000', // ₹30,000 of the ₹55,000 July rent
    method: 'BANK_TRANSFER',
    idempotencyKey: 'seed-pay-2025-07',
  });

  // 8) Show the resulting state.
  const balances = await ledger.getTenancyBalances(LANDLORD, TENANCY);
  const arrears = await ledger.getArrears(LANDLORD, TENANCY, new Date('2026-06-20T00:00:00Z'));
  const deposit = await deposits.getStatement(TENANCY);
  const tdsLegacy = await tax.previewTds(TENANCY, undefined, '2026-03-31');
  const tdsNew = await tax.previewTds(TENANCY, undefined, '2026-04-01');

  console.log('\nLedger balances (signed by normal side):');
  console.table(balances);
  console.log('\nArrears ageing @ 2026-06-20:', arrears);
  console.log('\nDeposit statement:', deposit);
  console.log('\nTDS preview (2026-03-31):', tdsLegacy.section, tdsLegacy.amount, tdsLegacy.reason);
  console.log('TDS preview (2026-04-01):', tdsNew.section, tdsNew.amount, tdsNew.reason);

  console.log('\nSeed complete.');
  console.log(`  Owner login:  owner@example.com / ${DEMO_PASSWORD}  (workspace ${LANDLORD})`);
  console.log(`  Tenant login: tenant@example.com / ${DEMO_PASSWORD}  (tenancy ${TENANCY})`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
