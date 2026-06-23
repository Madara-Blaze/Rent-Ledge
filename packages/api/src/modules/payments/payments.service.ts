import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { AccountCode } from '../../domain/ledger/accounts';
import { JournalEntryDraft, LedgerEntryType } from '../../domain/ledger/journal';
import { Money } from '../../domain/money/money';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { paymentAllocations, payments, invoices } from '../../infra/db/schema';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TenancyRepository, TenancyRow } from '../tenancy/tenancy.repository';
import { PaymentDto, RecordPaymentDto } from './payments.dto';
import {
  GatewayWebhookEvent,
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './payment-gateway.adapter';

type PaymentRow = typeof payments.$inferSelect;
interface OpenInvoice {
  id: string;
  kind: string;
  outstanding: string;
}

const rowsOf = <T>(res: unknown): T[] => (res as { rows: T[] }).rows;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly tenancyRepo: TenancyRepository,
    private readonly ledger: LedgerRepository,
  ) {}

  /**
   * Record a payment: settle invoices (explicit allocations or oldest-first),
   * roll any surplus into a tenant advance, account for tenant-withheld TDS, and
   * post one balanced ledger entry — all idempotent on idempotencyKey.
   */
  async recordPayment(input: RecordPaymentDto): Promise<PaymentDto> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(input.tenancyId);
    const currency = tenancy.currency;
    const cash = Money.of(input.amountMinor, currency);
    if (!cash.isPositive()) throw new BadRequestException('Payment amount must be positive');
    const tds = input.tdsMinor ? Money.of(input.tdsMinor, currency) : Money.zero(currency);
    const settled = cash.add(tds); // gross applied to receivables (cash + withheld TDS)

    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;

      if (input.idempotencyKey) {
        const dup = await tx
          .select()
          .from(payments)
          .where(eq(payments.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (dup.length > 0) return this.toDto(tx, dup[0]);
      }

      const allocations = await this.resolveAllocations(tx, tenancy, settled, input);
      const allocatedTotal = Money.sum(
        allocations.map((a) => a.amount),
        currency,
      );
      if (allocatedTotal.greaterThan(settled)) {
        throw new BadRequestException('Allocations exceed the payment amount');
      }
      const advance = settled.subtract(allocatedTotal);

      const rentAlloc = Money.sum(
        allocations.filter((a) => a.kind !== 'LATE_FEE').map((a) => a.amount),
        currency,
      );
      const lateAlloc = Money.sum(
        allocations.filter((a) => a.kind === 'LATE_FEE').map((a) => a.amount),
        currency,
      );

      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.PAYMENT,
        occurredAt: new Date(),
        currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: `Payment via ${input.method}`,
        sourceType: 'payment',
        idempotencyKey: input.idempotencyKey,
      });
      draft.debit(this.acct(AccountCode.CASH, tenancy), cash);
      if (tds.isPositive()) draft.debit(this.acct(AccountCode.TDS_RECEIVABLE, tenancy), tds);
      if (rentAlloc.isPositive()) draft.credit(this.acct(AccountCode.RENT_RECEIVABLE, tenancy), rentAlloc);
      if (lateAlloc.isPositive()) draft.credit(this.acct(AccountCode.LATE_FEE_RECEIVABLE, tenancy), lateAlloc);
      if (advance.isPositive()) draft.credit(this.acct(AccountCode.TENANT_ADVANCE, tenancy), advance);

      const entryId = await this.ledger.postEntry(draft.build(), tx);

      const [pay] = await tx
        .insert(payments)
        .values({
          landlordId: tenancy.landlordId,
          tenancyId: tenancy.id,
          method: input.method,
          amountMinor: cash.amountMinor,
          tdsMinor: tds.amountMinor,
          currency,
          status: 'SUCCEEDED',
          reference: input.reference ?? null,
          gateway: input.gateway ?? null,
          gatewayPaymentId: input.gatewayPaymentId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          journalEntryId: entryId,
        })
        .returning();

      for (const a of allocations) {
        await tx.insert(paymentAllocations).values({
          paymentId: pay.id,
          invoiceId: a.invoiceId,
          amountMinor: a.amount.amountMinor,
        });
        await this.refreshInvoiceStatus(tx, a.invoiceId);
      }

      return this.toDto(tx, pay);
    });
  }

  /** Inbound gateway webhook → reconcile to a payment, idempotent on event id. */
  async handleWebhook(rawBody: string, signature?: string): Promise<{ received: boolean; paymentId?: string }> {
    const event: GatewayWebhookEvent = this.gateway.verifyWebhook(rawBody, signature);
    if (event.status !== 'SUCCEEDED') return { received: true };
    if (!event.tenancyId) throw new BadRequestException('Webhook missing tenancyId metadata');

    const dto = await this.recordPayment({
      tenancyId: event.tenancyId,
      amountMinor: event.amountMinor,
      method: 'UPI',
      gateway: this.gateway.name,
      gatewayPaymentId: event.gatewayPaymentId,
      idempotencyKey: `gw_${event.id}`,
    });
    return { received: true, paymentId: dto.id };
  }

  // --- internals -----------------------------------------------------------

  private async resolveAllocations(
    tx: Db,
    tenancy: TenancyRow,
    settled: Money,
    input: RecordPaymentDto,
  ): Promise<{ invoiceId: string; amount: Money; kind: string }[]> {
    const currency = tenancy.currency;

    if (input.allocations && input.allocations.length > 0) {
      const out: { invoiceId: string; amount: Money; kind: string }[] = [];
      for (const a of input.allocations) {
        const res = await tx.execute(
          sql`SELECT id, kind FROM invoices WHERE id = ${a.invoiceId} AND tenancy_id = ${tenancy.id}`,
        );
        const inv = rowsOf<{ id: string; kind: string }>(res)[0];
        if (!inv) throw new BadRequestException(`Invoice ${a.invoiceId} not found for this tenancy`);
        out.push({ invoiceId: inv.id, amount: Money.of(a.amountMinor, currency), kind: inv.kind });
      }
      return out;
    }

    // Auto-allocate oldest-first across open invoices.
    const res = await tx.execute(sql`
      SELECT i.id, i.kind,
             (i.amount_minor - COALESCE(SUM(a.amount_minor), 0))::text AS outstanding
        FROM invoices i
        LEFT JOIN payment_allocations a ON a.invoice_id = i.id
       WHERE i.tenancy_id = ${tenancy.id} AND i.status IN ('OPEN', 'PARTIALLY_PAID')
       GROUP BY i.id
      HAVING (i.amount_minor - COALESCE(SUM(a.amount_minor), 0)) > 0
       ORDER BY i.due_date ASC, i.created_at ASC`);

    const allocations: { invoiceId: string; amount: Money; kind: string }[] = [];
    let remaining = settled;
    for (const inv of rowsOf<OpenInvoice>(res)) {
      if (!remaining.isPositive()) break;
      const outstanding = Money.of(inv.outstanding, currency);
      const alloc = outstanding.min(remaining);
      if (alloc.isPositive()) {
        allocations.push({ invoiceId: inv.id, amount: alloc, kind: inv.kind });
        remaining = remaining.subtract(alloc);
      }
    }
    return allocations;
  }

  private async refreshInvoiceStatus(tx: Db, invoiceId: string): Promise<void> {
    const [inv] = await tx
      .select({ amount: invoices.amountMinor })
      .from(invoices)
      .where(eq(invoices.id, invoiceId));
    if (!inv) return;
    const paidRows = await tx
      .select({ s: sql<string>`coalesce(sum(amount_minor), 0)` })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId));
    const paid = BigInt(paidRows[0]?.s ?? '0');
    const status = paid >= inv.amount ? 'PAID' : paid > 0n ? 'PARTIALLY_PAID' : 'OPEN';
    await tx.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  }

  private acct(code: AccountCode, tenancy: TenancyRow) {
    return { code, landlordId: tenancy.landlordId, tenancyId: tenancy.id, propertyId: tenancy.propertyId };
  }

  private async toDto(tx: Db, pay: PaymentRow): Promise<PaymentDto> {
    const allocRows = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, pay.id));
    const allocations = allocRows.map((a) => ({
      invoiceId: a.invoiceId,
      amount: { amountMinor: a.amountMinor.toString(), currency: pay.currency },
    }));
    const allocated = allocRows.reduce((s, a) => s + a.amountMinor, 0n);
    const advance = pay.amountMinor + pay.tdsMinor - allocated;

    return {
      id: pay.id,
      tenancyId: pay.tenancyId,
      method: pay.method,
      amount: { amountMinor: pay.amountMinor.toString(), currency: pay.currency },
      tds: { amountMinor: pay.tdsMinor.toString(), currency: pay.currency },
      status: pay.status,
      allocations,
      advance: { amountMinor: advance.toString(), currency: pay.currency },
      journalEntryId: pay.journalEntryId,
    };
  }
}
