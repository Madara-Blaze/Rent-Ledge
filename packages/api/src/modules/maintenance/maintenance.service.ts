import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { AccountCode } from '../../domain/ledger/accounts';
import { JournalEntryDraft, LedgerEntryType } from '../../domain/ledger/journal';
import { Money } from '../../domain/money/money';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { maintenanceTickets, ticketEvents, vendors } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TenancyRepository } from '../tenancy/tenancy.repository';

type TicketRow = typeof maintenanceTickets.$inferSelect;

export interface CreateTicketInput {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
}

export interface UpdateTicketInput {
  status?: string;
  priority?: string;
  assignedVendorId?: string;
  costMinor?: string;
  costBearer?: string;
  note?: string;
}

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly ledger: LedgerRepository,
    private readonly tenancyRepo: TenancyRepository,
  ) {}

  // ---- vendors ----
  async createVendor(landlordId: string, dto: { name: string; contact?: string; category?: string; rating?: number }, actor: string) {
    const [row] = await this.db
      .insert(vendors)
      .values({ landlordId, name: dto.name, contact: dto.contact ?? null, category: dto.category ?? null, rating: dto.rating ?? null })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'vendor.create', resourceType: 'vendor', resourceId: row.id });
    return row;
  }

  listVendors(landlordId: string) {
    return this.db.select().from(vendors).where(eq(vendors.landlordId, landlordId));
  }

  // ---- tickets ----
  async createTicket(tenancyId: string, dto: CreateTicketInput, actor: string) {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(tenancyId);
    const [ticket] = await this.db
      .insert(maintenanceTickets)
      .values({
        landlordId: tenancy.landlordId,
        tenancyId,
        propertyId: tenancy.propertyId,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? null,
        priority: dto.priority ?? 'NORMAL',
        status: 'OPEN',
        createdBy: actor,
      })
      .returning();
    await this.recordEvent(ticket.id, 'CREATED', dto.title, actor);
    await this.audit.log({ actorUserId: actor, landlordId: tenancy.landlordId, action: 'ticket.create', resourceType: 'ticket', resourceId: ticket.id });
    return this.getTicket(ticket.id);
  }

  listTickets(landlordId: string) {
    return this.db.select().from(maintenanceTickets).where(eq(maintenanceTickets.landlordId, landlordId));
  }

  async getTicket(id: string) {
    const ticket = await this.getRow(id);
    const events = await this.db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, id)).orderBy(asc(ticketEvents.createdAt));
    return { ...ticket, costMinor: ticket.costMinor.toString(), events };
  }

  async landlordIdForTicket(id: string): Promise<string> {
    return (await this.getRow(id)).landlordId;
  }

  async updateTicket(id: string, dto: UpdateTicketInput, actor: string) {
    const ticket = await this.getRow(id);
    const patch: Partial<TicketRow> = { updatedAt: new Date() };
    if (dto.status) patch.status = dto.status;
    if (dto.priority) patch.priority = dto.priority;
    if (dto.assignedVendorId) patch.assignedVendorId = dto.assignedVendorId;
    if (dto.costMinor !== undefined) patch.costMinor = BigInt(dto.costMinor);
    if (dto.costBearer) patch.costBearer = dto.costBearer;

    await this.db.update(maintenanceTickets).set(patch).where(eq(maintenanceTickets.id, id));
    await this.recordEvent(id, dto.status ? `STATUS_${dto.status}` : 'UPDATED', dto.note ?? null, actor);

    // Tenant-borne cost on resolution → chargeback to the tenant ledger.
    const effectiveStatus = dto.status ?? ticket.status;
    const effectiveBearer = dto.costBearer ?? ticket.costBearer;
    const effectiveCost = dto.costMinor !== undefined ? BigInt(dto.costMinor) : ticket.costMinor;
    if (
      effectiveStatus === 'RESOLVED' &&
      effectiveBearer === 'TENANT' &&
      effectiveCost > 0n &&
      !ticket.chargebackJournalEntryId &&
      ticket.tenancyId
    ) {
      await this.postChargeback(ticket, effectiveCost, actor);
    }

    await this.audit.log({ actorUserId: actor, landlordId: ticket.landlordId, action: 'ticket.update', resourceType: 'ticket', resourceId: id, metadata: { ...dto } });
    return this.getTicket(id);
  }

  // ---- internals ----
  private async postChargeback(ticket: TicketRow, cost: bigint, actor: string): Promise<void> {
    if (!ticket.tenancyId) throw new BadRequestException('Cannot charge back a ticket with no tenancy');
    const tenancy = await this.tenancyRepo.findByIdOrThrow(ticket.tenancyId);
    const amount = Money.of(cost, tenancy.currency);
    const acct = (code: AccountCode) => ({ code, landlordId: tenancy.landlordId, tenancyId: tenancy.id, propertyId: tenancy.propertyId });
    const draft = new JournalEntryDraft({
      entryType: LedgerEntryType.ADJUSTMENT,
      occurredAt: new Date(),
      currency: tenancy.currency,
      landlordId: tenancy.landlordId,
      tenancyId: tenancy.id,
      description: `Maintenance chargeback: ${ticket.title}`,
      sourceType: 'maintenance',
      sourceId: ticket.id,
    })
      .debit(acct(AccountCode.RENT_RECEIVABLE), amount)
      .credit(acct(AccountCode.MAINTENANCE_RECOVERY_INCOME), amount)
      .build();
    const entryId = await this.ledger.postEntry(draft);
    await this.db.update(maintenanceTickets).set({ chargebackJournalEntryId: entryId }).where(eq(maintenanceTickets.id, ticket.id));
    await this.recordEvent(ticket.id, 'CHARGEBACK_POSTED', `${amount.format('en-IN')} charged to tenant`, actor);
  }

  private async recordEvent(ticketId: string, type: string, note: string | null, actor: string): Promise<void> {
    await this.db.insert(ticketEvents).values({ ticketId, type, note, actorUserId: actor });
  }

  private async getRow(id: string): Promise<TicketRow> {
    const [row] = await this.db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Ticket ${id} not found`);
    return row;
  }
}
