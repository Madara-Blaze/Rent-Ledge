import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomToken, sha256 } from '../../common/crypto/tokens';
import { isoDate } from '../../domain/policy/jurisdiction-policy';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { moveInspections, tenancies, tenantInvitations, tenants } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import {
  CreateInspectionDto,
  CreateTenancyDto,
  InviteTenantDto,
  TenancyAction,
} from './tenancies.dto';

type TenancyRow = typeof tenancies.$inferSelect;

interface TransitionRule {
  from: string[];
  to: string;
  setNotice?: boolean;
  setEnded?: boolean;
}

const TRANSITIONS: Record<TenancyAction, TransitionRule> = {
  ISSUE_AGREEMENT: { from: ['DRAFT'], to: 'AGREEMENT_PENDING' },
  ACTIVATE: { from: ['DRAFT', 'AGREEMENT_PENDING'], to: 'ACTIVE' },
  START_NOTICE: { from: ['ACTIVE'], to: 'NOTICE_PERIOD', setNotice: true },
  RENEW: { from: ['ACTIVE', 'NOTICE_PERIOD'], to: 'RENEWED' },
  TERMINATE: { from: ['ACTIVE', 'NOTICE_PERIOD'], to: 'TERMINATED', setEnded: true },
  END: { from: ['ACTIVE', 'NOTICE_PERIOD'], to: 'ENDED', setEnded: true },
  EVICT: { from: ['ACTIVE', 'NOTICE_PERIOD'], to: 'EVICTED', setEnded: true },
};

@Injectable()
export class TenanciesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async createTenancy(landlordId: string, dto: CreateTenancyDto, actor: string) {
    const [tenant] = await this.db
      .insert(tenants)
      .values({
        name: dto.tenantName,
        email: dto.tenantEmail ?? null,
        phone: dto.tenantPhone ?? null,
        payerClass: dto.payerClass ?? 'INDIVIDUAL_HUF',
      })
      .returning();

    const [row] = await this.db
      .insert(tenancies)
      .values({
        landlordId,
        propertyId: dto.propertyId,
        unitId: dto.unitId ?? null,
        primaryTenantId: tenant.id,
        currency: dto.currency ?? 'INR',
        jurisdiction: dto.jurisdiction ?? 'IN',
        rentMinor: BigInt(dto.rentMinor),
        depositMinor: BigInt(dto.depositMinor ?? '0'),
        billingDay: dto.billingDay ?? 1,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        escalation: dto.escalation ?? null,
        status: dto.status ?? 'DRAFT',
      })
      .returning();

    await this.audit.log({ actorUserId: actor, landlordId, action: 'tenancy.create', resourceType: 'tenancy', resourceId: row.id });
    return this.toDto(row);
  }

  listTenancies(landlordId: string) {
    return this.db
      .select()
      .from(tenancies)
      .where(eq(tenancies.landlordId, landlordId))
      .then((rows) => rows.map((r) => this.toDto(r)));
  }

  async getTenancy(tenancyId: string) {
    return this.toDto(await this.getRow(tenancyId));
  }

  async transition(tenancyId: string, action: TenancyAction, reason: string | undefined, actor: string) {
    const row = await this.getRow(tenancyId);
    const rule = TRANSITIONS[action];
    if (!rule.from.includes(row.status)) {
      throw new BadRequestException(`Cannot ${action} a tenancy in status ${row.status}`);
    }
    const patch: Partial<TenancyRow> = { status: rule.to };
    if (rule.setNotice) patch.noticeDate = isoDate(new Date());
    if (rule.setEnded) {
      patch.endedAt = isoDate(new Date());
      patch.endReason = reason ?? action;
    }
    const [updated] = await this.db.update(tenancies).set(patch).where(eq(tenancies.id, tenancyId)).returning();
    await this.audit.log({
      actorUserId: actor,
      landlordId: row.landlordId,
      action: `tenancy.${action.toLowerCase()}`,
      resourceType: 'tenancy',
      resourceId: tenancyId,
      metadata: reason ? { reason } : null,
    });
    return this.toDto(updated);
  }

  async createInspection(tenancyId: string, dto: CreateInspectionDto, actor: string) {
    const tn = await this.getRow(tenancyId);
    const [row] = await this.db
      .insert(moveInspections)
      .values({
        tenancyId,
        type: dto.type,
        conditionNotes: dto.conditionNotes ?? null,
        checklist: dto.checklist ?? null,
        evidenceRefs: dto.evidenceRefs ?? null,
        conductedAt: dto.conductedAt ? new Date(dto.conductedAt) : new Date(),
        createdBy: actor,
      })
      .returning();
    await this.audit.log({
      actorUserId: actor,
      landlordId: tn.landlordId,
      action: `inspection.${dto.type.toLowerCase()}`,
      resourceType: 'inspection',
      resourceId: row.id,
    });
    return row;
  }

  listInspections(tenancyId: string) {
    return this.db.select().from(moveInspections).where(eq(moveInspections.tenancyId, tenancyId));
  }

  /** Create an invitation; the raw token is returned ONCE (only its hash is stored). */
  async inviteTenant(landlordId: string, tenancyId: string, dto: InviteTenantDto, actor: string) {
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const [row] = await this.db
      .insert(tenantInvitations)
      .values({
        landlordId,
        tenancyId,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        tokenHash: sha256(token),
        status: 'PENDING',
        invitedBy: actor,
        expiresAt,
      })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'invitation.create', resourceType: 'invitation', resourceId: row.id });
    return { id: row.id, tenancyId, email: row.email, phone: row.phone, status: row.status, expiresAt: row.expiresAt, token };
  }

  async listInvitations(landlordId: string) {
    const rows = await this.db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.landlordId, landlordId));
    return rows.map((r) => ({
      id: r.id,
      tenancyId: r.tenancyId,
      email: r.email,
      phone: r.phone,
      status: r.status,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  // --- internals -----------------------------------------------------------

  private async getRow(tenancyId: string): Promise<TenancyRow> {
    const [row] = await this.db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
    if (!row) throw new NotFoundException(`Tenancy ${tenancyId} not found`);
    return row;
  }

  private toDto(r: TenancyRow) {
    return {
      id: r.id,
      landlordId: r.landlordId,
      propertyId: r.propertyId,
      unitId: r.unitId,
      primaryTenantId: r.primaryTenantId,
      currency: r.currency,
      jurisdiction: r.jurisdiction,
      rentMinor: r.rentMinor.toString(),
      depositMinor: r.depositMinor.toString(),
      billingDay: r.billingDay,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      noticeDate: r.noticeDate,
      endedAt: r.endedAt,
      endReason: r.endReason,
      escalation: r.escalation,
    };
  }
}
