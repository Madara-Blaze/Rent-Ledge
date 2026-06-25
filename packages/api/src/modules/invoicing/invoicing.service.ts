import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { moneyToDto } from '../../common/money.util';
import { AccountCode } from '../../domain/ledger/accounts';
import { JournalEntryDraft, LedgerEntryType } from '../../domain/ledger/journal';
import { Money } from '../../domain/money/money';
import { isoDate } from '../../domain/policy/jurisdiction-policy';
import { EscalationSchedule, escalatedRent } from '../../domain/rules/escalation';
import { computeLateFee } from '../../domain/rules/late-fee';
import { prorateRent } from '../../domain/rules/proration';
import { computeGst, type GstBreakdown, isInterState, isValidGstin } from '../../domain/tax/gst';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { invoices, landlords, properties, tenants } from '../../infra/db/schema';
import { LedgerRepository } from '../ledger/ledger.repository';
import { PolicyService } from '../policy/policy.service';
import { StoredEscalation, TenancyRepository, TenancyRow } from '../tenancy/tenancy.repository';
import {
  ApplyLateFeeDto,
  CreateGstInvoiceDto,
  CreateRentInvoiceDto,
  GstInvoicePreviewDto,
  InvoiceDto,
  InvoicePreviewDto,
  LateFeeResultDto,
} from './invoicing.dto';
import { buildTaxInvoicePdf } from './tax-invoice';

const parseDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

@Injectable()
export class InvoicingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly tenancyRepo: TenancyRepository,
    private readonly policy: PolicyService,
    private readonly ledger: LedgerRepository,
  ) {}

  /** Dry-run: show the rent breakdown (escalation + proration) without persisting. */
  async preview(input: CreateRentInvoiceDto): Promise<InvoicePreviewDto> {
    return (await this.computeRent(input)).preview;
  }

  async createRentInvoice(input: CreateRentInvoiceDto): Promise<InvoiceDto> {
    const { tenancy, amount } = await this.computeRent(input);
    const currency = tenancy.currency;
    const occurredAt = parseDate(input.periodStart);

    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.INVOICE,
        occurredAt,
        currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: `Rent ${input.periodStart}..${input.periodEnd}`,
        sourceType: 'invoice',
        idempotencyKey: input.idempotencyKey,
      })
        .debit(this.acct(AccountCode.RENT_RECEIVABLE, tenancy), amount)
        .credit(this.acct(AccountCode.RENT_INCOME, tenancy), amount)
        .build();

      const entryId = await this.ledger.postEntry(draft, tx);

      const existing = await tx.select().from(invoices).where(eq(invoices.journalEntryId, entryId)).limit(1);
      if (existing.length > 0) return this.rowToDto(existing[0]); // idempotent replay

      const number = await this.nextInvoiceNumber(tx, tenancy.landlordId);
      const [inv] = await tx
        .insert(invoices)
        .values({
          landlordId: tenancy.landlordId,
          tenancyId: tenancy.id,
          number,
          kind: 'RENT',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          dueDate: input.dueDate,
          currency,
          amountMinor: amount.amountMinor,
          status: 'OPEN',
          journalEntryId: entryId,
        })
        .returning();
      return this.rowToDto(inv);
    });
  }

  /** Dry-run a GST tax invoice: rent breakdown + CGST/SGST or IGST split. */
  async gstPreview(input: CreateGstInvoiceDto): Promise<GstInvoicePreviewDto> {
    const { rentPreview, gst } = await this.computeGstFor(input);
    return { rent: rentPreview, ...gst };
  }

  /** Issue a GST tax invoice for a commercial let and post it (with tax liability) to the ledger. */
  async createGstInvoice(input: CreateGstInvoiceDto): Promise<InvoiceDto> {
    const { tenancy, amount, gst } = await this.computeGstFor(input);
    const currency = tenancy.currency;
    const occurredAt = parseDate(input.periodStart);
    const gross = Money.of(gst.grossMinor, currency);

    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.INVOICE,
        occurredAt,
        currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: `GST rent ${input.periodStart}..${input.periodEnd}`,
        sourceType: 'invoice',
        idempotencyKey: input.idempotencyKey,
      });
      draft.debit(this.acct(AccountCode.RENT_RECEIVABLE, tenancy), gross);
      draft.credit(this.acct(AccountCode.RENT_INCOME, tenancy), amount);
      if (gst.interState) {
        draft.credit(this.acct(AccountCode.IGST_PAYABLE, tenancy), Money.of(gst.igstMinor, currency));
      } else {
        draft.credit(this.acct(AccountCode.CGST_PAYABLE, tenancy), Money.of(gst.cgstMinor, currency));
        draft.credit(this.acct(AccountCode.SGST_PAYABLE, tenancy), Money.of(gst.sgstMinor, currency));
      }
      const entryId = await this.ledger.postEntry(draft.build(), tx);

      const existing = await tx.select().from(invoices).where(eq(invoices.journalEntryId, entryId)).limit(1);
      if (existing.length > 0) return this.rowToDto(existing[0]); // idempotent replay

      const number = await this.nextInvoiceNumber(tx, tenancy.landlordId);
      const [inv] = await tx
        .insert(invoices)
        .values({
          landlordId: tenancy.landlordId,
          tenancyId: tenancy.id,
          number,
          kind: 'RENT',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          dueDate: input.dueDate,
          currency,
          amountMinor: gross.amountMinor,
          status: 'OPEN',
          taxableMinor: BigInt(gst.taxableMinor),
          cgstMinor: BigInt(gst.cgstMinor),
          sgstMinor: BigInt(gst.sgstMinor),
          igstMinor: BigInt(gst.igstMinor),
          gstRateBps: gst.rateBps,
          hsnSac: input.hsnSac ?? '997212',
          placeOfSupply: input.placeOfSupply,
          supplierGstin: input.supplierGstin.trim().toUpperCase(),
          recipientGstin: input.recipientGstin?.trim().toUpperCase() ?? null,
          journalEntryId: entryId,
        })
        .returning();
      return this.rowToDto(inv);
    });
  }

  /** Build a GST-compliant tax-invoice PDF for a previously-issued GST invoice. */
  async buildTaxInvoice(invoiceId: string): Promise<{ bytes: Buffer; fileName: string; tenancyId: string }> {
    const [inv] = await this.db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!inv) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    if (inv.gstRateBps == null) throw new BadRequestException('Invoice is not a GST tax invoice');

    const tenancy = await this.tenancyRepo.findByIdOrThrow(inv.tenancyId);
    const [landlord] = await this.db.select().from(landlords).where(eq(landlords.id, tenancy.landlordId)).limit(1);
    const [property] = await this.db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, tenancy.primaryTenantId)).limit(1);

    const igst = (inv.igstMinor ?? 0n).toString();
    const cgst = (inv.cgstMinor ?? 0n).toString();
    const sgst = (inv.sgstMinor ?? 0n).toString();
    const totalTax = ((inv.cgstMinor ?? 0n) + (inv.sgstMinor ?? 0n) + (inv.igstMinor ?? 0n)).toString();
    const date = (inv.createdAt instanceof Date ? inv.createdAt : new Date(inv.createdAt)).toISOString().slice(0, 10);

    const bytes = buildTaxInvoicePdf({
      number: inv.number,
      date,
      periodLabel: inv.periodStart ? `${inv.periodStart}${inv.periodEnd ? ` to ${inv.periodEnd}` : ''}` : null,
      supplierName: landlord?.name ?? 'Landlord',
      supplierGstin: inv.supplierGstin ?? '',
      recipientName: tenant?.name ?? 'Tenant',
      recipientGstin: inv.recipientGstin,
      propertyName: property?.name ?? 'Property',
      placeOfSupply: inv.placeOfSupply ?? '',
      hsnSac: inv.hsnSac ?? '997212',
      taxableMinor: (inv.taxableMinor ?? 0n).toString(),
      cgstMinor: cgst,
      sgstMinor: sgst,
      igstMinor: igst,
      totalTaxMinor: totalTax,
      grossMinor: inv.amountMinor.toString(),
      rateBps: inv.gstRateBps,
      interState: (inv.igstMinor ?? 0n) > 0n,
    });
    return { bytes, fileName: `tax-invoice-${inv.number}.pdf`, tenancyId: inv.tenancyId };
  }

  private async computeGstFor(
    input: CreateGstInvoiceDto,
  ): Promise<{ tenancy: TenancyRow; amount: Money; rentPreview: InvoicePreviewDto; gst: GstBreakdown }> {
    if (!isValidGstin(input.supplierGstin)) throw new BadRequestException('Invalid supplier GSTIN');
    const { tenancy, amount, preview } = await this.computeRent(input);
    const interState = isInterState(input.supplierGstin, input.placeOfSupply);
    const rateBps = input.gstRateBps ?? 1800;
    const gst = computeGst({ taxableMinor: amount.amountMinor, rateBps, interState });
    return { tenancy, amount, rentPreview: preview, gst };
  }

  async applyLateFee(input: ApplyLateFeeDto): Promise<LateFeeResultDto> {
    const inv = await this.loadInvoiceOutstanding(input.invoiceId);
    if (!inv) throw new NotFoundException(`Invoice ${input.invoiceId} not found`);
    const tenancy = await this.tenancyRepo.findByIdOrThrow(inv.tenancyId);
    const asOf = input.asOf ? parseDate(input.asOf) : new Date();
    const policy = await this.policy.resolve(tenancy.jurisdiction, asOf);

    const lf = computeLateFee({
      outstanding: Money.of(inv.outstanding, tenancy.currency),
      policy: policy.lateFee,
      dueDate: parseDate(inv.dueDate),
      asOf,
    });

    if (!lf.applied) {
      return {
        applied: false,
        daysLate: lf.daysLate,
        chargeableDays: lf.chargeableDays,
        fee: moneyToDto(lf.fee),
      };
    }

    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.LATE_FEE,
        occurredAt: asOf,
        currency: tenancy.currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: `Late fee on invoice ${inv.number}`,
        sourceType: 'invoice',
        sourceId: inv.id,
        idempotencyKey: input.idempotencyKey,
      })
        .debit(this.acct(AccountCode.LATE_FEE_RECEIVABLE, tenancy), lf.fee)
        .credit(this.acct(AccountCode.LATE_FEE_INCOME, tenancy), lf.fee)
        .build();

      const entryId = await this.ledger.postEntry(draft, tx);
      const existing = await tx.select().from(invoices).where(eq(invoices.journalEntryId, entryId)).limit(1);
      const row =
        existing.length > 0
          ? existing[0]
          : (
              await tx
                .insert(invoices)
                .values({
                  landlordId: tenancy.landlordId,
                  tenancyId: tenancy.id,
                  number: await this.nextInvoiceNumber(tx, tenancy.landlordId),
                  kind: 'LATE_FEE',
                  dueDate: isoDate(asOf),
                  currency: tenancy.currency,
                  amountMinor: lf.fee.amountMinor,
                  status: 'OPEN',
                  journalEntryId: entryId,
                })
                .returning()
            )[0];

      return {
        applied: true,
        daysLate: lf.daysLate,
        chargeableDays: lf.chargeableDays,
        fee: moneyToDto(lf.fee),
        invoice: this.rowToDto(row),
      };
    });
  }

  /** Resolve the owning tenancy of an invoice (for access checks). */
  async tenancyIdForInvoice(invoiceId: string): Promise<string> {
    const { rows } = await this.pool.query<{ tenancy_id: string }>(
      `SELECT tenancy_id FROM invoices WHERE id = $1`,
      [invoiceId],
    );
    if (!rows.length) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    return rows[0].tenancy_id;
  }

  // --- internals -----------------------------------------------------------

  private async computeRent(
    input: CreateRentInvoiceDto,
  ): Promise<{ tenancy: TenancyRow; amount: Money; preview: InvoicePreviewDto }> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(input.tenancyId);
    const periodStart = parseDate(input.periodStart);
    const policy = await this.policy.resolve(tenancy.jurisdiction, periodStart);

    const baseRent = Money.of(tenancy.rentMinor, tenancy.currency);
    let effective = baseRent;
    let periodsApplied = 0;
    if (tenancy.escalation) {
      const e = escalatedRent(baseRent, this.toSchedule(tenancy.escalation), periodStart);
      effective = e.rent;
      periodsApplied = e.periodsApplied;
    }

    const proration = prorateRent({
      monthlyRent: effective,
      periodStart,
      periodEnd: parseDate(input.periodEnd),
      occupancyStart: input.occupancyStart ? parseDate(input.occupancyStart) : undefined,
      occupancyEnd: input.occupancyEnd ? parseDate(input.occupancyEnd) : undefined,
      basis: policy.proration.basis,
    });

    const preview: InvoicePreviewDto = {
      baseRent: moneyToDto(baseRent),
      escalatedRent: moneyToDto(effective),
      escalationPeriodsApplied: periodsApplied,
      chargeableDays: proration.chargeableDays,
      totalDays: proration.totalDays,
      prorationBasis: proration.basis,
      amount: moneyToDto(proration.amount),
    };
    return { tenancy, amount: proration.amount, preview };
  }

  private toSchedule(stored: StoredEscalation): EscalationSchedule {
    return {
      type: stored.type,
      rateBps: stored.rateBps,
      amountMinor: stored.amountMinor,
      frequencyMonths: stored.frequencyMonths,
      startDate: parseDate(stored.startDate),
      compounding: stored.compounding,
      maxRentMinor: stored.maxRentMinor,
    };
  }

  private acct(code: AccountCode, tenancy: TenancyRow) {
    return { code, landlordId: tenancy.landlordId, tenancyId: tenancy.id, propertyId: tenancy.propertyId };
  }

  private async nextInvoiceNumber(tx: Db, landlordId: string): Promise<string> {
    const rows = await tx
      .select({ c: sql<string>`count(*)` })
      .from(invoices)
      .where(eq(invoices.landlordId, landlordId));
    const n = Number(rows[0]?.c ?? '0') + 1;
    return `INV-${new Date().getUTCFullYear()}-${String(n).padStart(5, '0')}`;
  }

  private async loadInvoiceOutstanding(
    invoiceId: string,
  ): Promise<{ id: string; number: string; tenancyId: string; dueDate: string; outstanding: string } | null> {
    const { rows } = await this.pool.query<{
      id: string;
      number: string;
      tenancy_id: string;
      due_date: string;
      outstanding: string;
    }>(
      `SELECT i.id, i.number, i.tenancy_id, i.due_date::text AS due_date,
              (i.amount_minor - COALESCE(SUM(a.amount_minor), 0))::text AS outstanding
         FROM invoices i
         LEFT JOIN payment_allocations a ON a.invoice_id = i.id
        WHERE i.id = $1
        GROUP BY i.id`,
      [invoiceId],
    );
    const r = rows[0];
    return r
      ? { id: r.id, number: r.number, tenancyId: r.tenancy_id, dueDate: r.due_date, outstanding: r.outstanding }
      : null;
  }

  private rowToDto(row: typeof invoices.$inferSelect): InvoiceDto {
    return {
      id: row.id,
      number: row.number,
      kind: row.kind,
      tenancyId: row.tenancyId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      dueDate: row.dueDate,
      amount: { amountMinor: row.amountMinor.toString(), currency: row.currency },
      status: row.status,
      journalEntryId: row.journalEntryId,
    };
  }
}
