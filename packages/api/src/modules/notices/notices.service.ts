import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { NoticeType, checkNoticePeriod, minNoticeDaysFor } from '../../domain/notices/notice-rules';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { deliveryReceipts, notices } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { EvidenceService } from '../evidence/evidence.service';
import { Channel } from '../notifications/notification.adapter';
import { NotificationsService } from '../notifications/notifications.service';
import { PolicyService } from '../policy/policy.service';
import { TenancyRepository } from '../tenancy/tenancy.repository';

type NoticeRow = typeof notices.$inferSelect;

export interface CreateNoticeInput {
  tenancyId: string;
  type: NoticeType;
  subject: string;
  body: string;
  effectiveDate?: string;
}

@Injectable()
export class NoticesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly policy: PolicyService,
    private readonly evidence: EvidenceService,
    private readonly notifications: NotificationsService,
    private readonly tenancyRepo: TenancyRepository,
    private readonly audit: AuditService,
  ) {}

  async create(landlordId: string, dto: CreateNoticeInput, actor: string) {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(dto.tenancyId);
    const policy = await this.policy.resolve(tenancy.jurisdiction, new Date());
    const minNoticeDays = minNoticeDaysFor(dto.type, policy);
    const [row] = await this.db
      .insert(notices)
      .values({
        landlordId,
        tenancyId: dto.tenancyId,
        type: dto.type,
        subject: dto.subject,
        body: dto.body,
        effectiveDate: dto.effectiveDate ?? null,
        minNoticeDays,
        status: 'DRAFT',
        createdBy: actor,
      })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'notice.create', resourceType: 'notice', resourceId: row.id });
    return this.getNotice(row.id);
  }

  /** Enforce the statutory notice window, write to the evidence vault, dispatch, and receipt. */
  async send(noticeId: string, channel: Channel, actor: string) {
    const notice = await this.getRow(noticeId);
    if (notice.status === 'SENT') return this.getNotice(noticeId);
    const tenancy = await this.tenancyRepo.findByIdOrThrow(notice.tenancyId);
    const policy = await this.policy.resolve(tenancy.jurisdiction, new Date());

    const check = checkNoticePeriod(
      notice.type as NoticeType,
      policy,
      new Date(),
      notice.effectiveDate ? new Date(`${notice.effectiveDate}T00:00:00Z`) : undefined,
    );
    if (!check.allowed) throw new BadRequestException(check.reason);

    const evidence = await this.evidence.append(
      notice.landlordId,
      {
        entryType: 'NOTICE_SENT',
        summary: `${notice.type}: ${notice.subject}`,
        content: { noticeId, type: notice.type, body: notice.body, effectiveDate: notice.effectiveDate },
        tenancyId: notice.tenancyId,
      },
      actor,
    );

    const recipient = await this.tenantContact(notice.tenancyId);
    const result = await this.notifications.dispatch({
      landlordId: notice.landlordId,
      channel,
      recipient,
      template: `notice.${notice.type.toLowerCase()}`,
      payload: { subject: notice.subject },
    });

    await this.pool.query(
      `INSERT INTO delivery_receipts (notice_id, channel, status, provider_ref) VALUES ($1, $2, $3, $4)`,
      [noticeId, channel, result.status, result.providerRef],
    );
    await this.db.update(notices).set({ status: 'SENT', evidenceEntryId: evidence.id }).where(eq(notices.id, noticeId));
    await this.audit.log({ actorUserId: actor, landlordId: notice.landlordId, action: 'notice.send', resourceType: 'notice', resourceId: noticeId, metadata: { channel } });
    return this.getNotice(noticeId);
  }

  listForTenancy(tenancyId: string) {
    return this.db.select().from(notices).where(eq(notices.tenancyId, tenancyId));
  }

  async getNotice(id: string) {
    const notice = await this.getRow(id);
    const receipts = await this.db.select().from(deliveryReceipts).where(eq(deliveryReceipts.noticeId, id));
    return { ...notice, deliveryReceipts: receipts };
  }

  async tenancyIdForNotice(id: string): Promise<string> {
    return (await this.getRow(id)).tenancyId;
  }

  // ---- internals ----
  private async tenantContact(tenancyId: string): Promise<string> {
    const { rows } = await this.pool.query<{ email: string | null; phone: string | null }>(
      `SELECT te.email, te.phone FROM tenancies tn JOIN tenants te ON te.id = tn.primary_tenant_id WHERE tn.id = $1`,
      [tenancyId],
    );
    const r = rows[0];
    return r?.email ?? r?.phone ?? 'unknown@example.com';
  }

  private async getRow(id: string): Promise<NoticeRow> {
    const [row] = await this.db.select().from(notices).where(eq(notices.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Notice ${id} not found`);
    return row;
  }
}
