import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { chooseChannel, classifyReminder, type ReminderBucket, reminderKey } from './reminders.logic';

export interface ReminderItem {
  tenancyId: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  dueDate: string;
  outstandingMinor: string;
  bucket: ReminderBucket;
  channel: string | null;
  recipient: string | null;
  alreadySentToday: boolean;
}

export interface SendResult {
  sent: number;
  skippedAlreadySent: number;
  skippedNoContact: number;
}

const DEFAULT_WINDOW_DAYS = 3;
const TEMPLATE = 'rent_reminder';

@Injectable()
export class RemindersService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Dry-run: which tenancies have rent overdue or due within the window, and how much. */
  async preview(landlordId: string, opts?: { tenancyId?: string; windowDays?: number }): Promise<ReminderItem[]> {
    const today = this.today();
    const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
    const params: unknown[] = [landlordId, today, windowDays];
    let tenancyFilter = '';
    if (opts?.tenancyId) {
      params.push(opts.tenancyId);
      tenancyFilter = `AND i.tenancy_id = $${params.length}`;
    }

    const { rows } = await this.pool.query(
      `SELECT i.id AS invoice_id, i.number AS invoice_number, i.tenancy_id, i.due_date,
              i.amount_minor, COALESCE(a.allocated, 0) AS allocated,
              t.name AS tenant_name, t.phone, t.email
         FROM invoices i
         JOIN tenancies tn ON tn.id = i.tenancy_id
         JOIN tenants t ON t.id = tn.primary_tenant_id
         LEFT JOIN (
           SELECT invoice_id, SUM(amount_minor) AS allocated FROM payment_allocations GROUP BY invoice_id
         ) a ON a.invoice_id = i.id
        WHERE i.landlord_id = $1
          AND i.status = 'OPEN'
          AND (i.amount_minor - COALESCE(a.allocated, 0)) > 0
          AND i.due_date <= ($2::date + ($3 || ' days')::interval)
          ${tenancyFilter}
        ORDER BY i.due_date ASC`,
      params,
    );

    const sentKeys = await this.sentKeysToday(landlordId, today);

    return rows.map((r) => {
      const outstanding = BigInt(r.amount_minor) - BigInt(r.allocated);
      const due = this.isoDate(r.due_date);
      const contact = chooseChannel(r.phone, r.email);
      return {
        tenancyId: r.tenancy_id,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        tenantName: r.tenant_name,
        dueDate: due,
        outstandingMinor: outstanding.toString(),
        bucket: classifyReminder(due, today),
        channel: contact?.channel ?? null,
        recipient: contact?.recipient ?? null,
        alreadySentToday: sentKeys.has(reminderKey(r.invoice_id, today)),
      };
    });
  }

  /** Send reminders for everything due (optionally scoped to one tenancy). Idempotent per invoice/day. */
  async sendDue(landlordId: string, actor: string, tenancyId?: string): Promise<SendResult> {
    const today = this.today();
    const items = await this.preview(landlordId, { tenancyId });
    const result: SendResult = { sent: 0, skippedAlreadySent: 0, skippedNoContact: 0 };

    for (const item of items) {
      if (item.alreadySentToday) {
        result.skippedAlreadySent += 1;
        continue;
      }
      if (!item.channel || !item.recipient) {
        result.skippedNoContact += 1;
        continue;
      }
      await this.notifications.dispatch({
        landlordId,
        channel: item.channel as 'WHATSAPP' | 'EMAIL' | 'SMS',
        recipient: item.recipient,
        template: TEMPLATE,
        payload: {
          reminderKey: reminderKey(item.invoiceId, today),
          tenancyId: item.tenancyId,
          invoiceId: item.invoiceId,
          invoiceNumber: item.invoiceNumber,
          dueDate: item.dueDate,
          outstandingMinor: item.outstandingMinor,
          bucket: item.bucket,
        },
      });
      result.sent += 1;
    }

    await this.audit.log({
      actorUserId: actor,
      landlordId,
      action: 'reminder.send_batch',
      resourceType: tenancyId ? 'tenancy' : 'workspace',
      resourceId: tenancyId ?? landlordId,
      metadata: { ...result, tenancyId: tenancyId ?? null },
    });
    return result;
  }

  // --- internals -------------------------------------------------------------

  private isoDate(v: unknown): string {
    if (typeof v === 'string') return v.slice(0, 10);
    return new Date(v as string | number | Date).toISOString().slice(0, 10);
  }

  private async sentKeysToday(landlordId: string, today: string): Promise<Set<string>> {
    const { rows } = await this.pool.query(
      `SELECT payload->>'reminderKey' AS k
         FROM notification_log
        WHERE landlord_id = $1 AND template = $2 AND created_at::date = $3::date
          AND payload->>'reminderKey' IS NOT NULL`,
      [landlordId, TEMPLATE, today],
    );
    return new Set(rows.map((r) => r.k as string));
  }
}
