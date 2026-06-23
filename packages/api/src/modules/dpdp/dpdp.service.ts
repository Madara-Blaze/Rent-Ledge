import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';
import { AuditService } from '../audit/audit.service';

/**
 * DPDP Act, 2023 helpers: consent capture, the right to access (data export) and
 * the right to erasure (request workflow — actual erasure is a controlled,
 * audited process that respects legal-retention windows).
 */
@Injectable()
export class DpdpService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async setConsent(userId: string, purpose: string, granted: boolean) {
    const { rows } = await this.pool.query(
      `INSERT INTO consents (user_id, purpose, granted, granted_at, withdrawn_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, purpose, granted, granted_at, withdrawn_at`,
      [userId, purpose, granted, granted ? new Date() : null, granted ? null : new Date()],
    );
    await this.audit.log({ actorUserId: userId, action: granted ? 'consent.grant' : 'consent.withdraw', resourceType: 'consent', metadata: { purpose } });
    return rows[0];
  }

  async listConsents(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, purpose, granted, granted_at, withdrawn_at, created_at FROM consents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }

  /** Right to access: assemble everything we hold about the user (PAN stays masked). */
  async exportData(userId: string) {
    const user = (
      await this.pool.query(`SELECT id, name, email, phone, pan_last4, pan_valid, status, created_at FROM users WHERE id = $1`, [userId])
    ).rows[0];
    const consents = (await this.pool.query(`SELECT purpose, granted, granted_at, withdrawn_at FROM consents WHERE user_id = $1`, [userId])).rows;
    const roles = (await this.pool.query(`SELECT role, scope_type, scope_id FROM role_assignments WHERE user_id = $1`, [userId])).rows;
    const tenancies = (
      await this.pool.query(
        `SELECT t.id AS tenancy_id, p.name AS property_name
           FROM role_assignments ra JOIN tenancies t ON t.id = ra.scope_id JOIN properties p ON p.id = t.property_id
          WHERE ra.user_id = $1 AND ra.scope_type = 'TENANCY' AND ra.role = 'TENANT'`,
        [userId],
      )
    ).rows;
    await this.audit.log({ actorUserId: userId, action: 'dpdp.export', resourceType: 'user', resourceId: userId });
    return { exportedAt: new Date().toISOString(), user, consents, roles, tenancies };
  }

  async requestErasure(userId: string, reason?: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO data_subject_requests (user_id, type, status, details) VALUES ($1, 'ERASURE', 'PENDING', $2) RETURNING id, type, status, created_at`,
      [userId, reason ? JSON.stringify({ reason }) : null],
    );
    await this.audit.log({ actorUserId: userId, action: 'dpdp.erasure_request', resourceType: 'user', resourceId: userId });
    return rows[0];
  }

  async listRequests(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, type, status, created_at, completed_at FROM data_subject_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }
}
