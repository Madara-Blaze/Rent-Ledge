import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';

export interface AuditEntry {
  actorUserId?: string | null;
  landlordId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Record a state-changing action. Failures never block the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO audit_log (actor_user_id, landlord_id, action, resource_type, resource_id, ip, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.actorUserId ?? null,
          entry.landlordId ?? null,
          entry.action,
          entry.resourceType ?? null,
          entry.resourceId ?? null,
          entry.ip ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ],
      );
    } catch {
      // auditing must not break the primary operation
    }
  }

  async listForLandlord(landlordId: string, limit = 100) {
    const { rows } = await this.pool.query<{
      id: string;
      actor_user_id: string | null;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      ip: string | null;
      metadata: unknown;
      created_at: string;
    }>(
      `SELECT id, actor_user_id, action, resource_type, resource_id, ip, metadata, created_at
         FROM audit_log WHERE landlord_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [landlordId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      ip: r.ip,
      metadata: r.metadata,
      createdAt: r.created_at,
    }));
  }
}
