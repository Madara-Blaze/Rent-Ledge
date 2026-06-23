import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';
import { READ_ROLES, Role, ScopeType, roleSatisfies } from './roles';

export interface TenancyAccess {
  landlordId: string;
  roles: Role[];
  isTenant: boolean;
}

export interface GrantParams {
  userId: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
  grantedBy: string | null;
}

/**
 * Resource-scoped access control. A user reaches a workspace's data through a
 * role_assignment at LANDLORD scope (or PLATFORM for admins); tenants reach a
 * single tenancy through a TENANCY-scoped TENANT assignment.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async rolesOnLandlord(userId: string, landlordId: string): Promise<Role[]> {
    const { rows } = await this.pool.query<{ role: Role }>(
      `SELECT DISTINCT role FROM role_assignments
        WHERE user_id = $1
          AND (scope_type = 'PLATFORM' OR (scope_type = 'LANDLORD' AND scope_id = $2))`,
      [userId, landlordId],
    );
    return rows.map((r) => r.role);
  }

  async assertWorkspaceAccess(
    userId: string,
    landlordId: string,
    allowed: Role[] = READ_ROLES,
  ): Promise<Role[]> {
    const roles = await this.rolesOnLandlord(userId, landlordId);
    if (!roleSatisfies(roles, allowed)) {
      throw new ForbiddenException('Insufficient role for this workspace');
    }
    return roles;
  }

  async assertPlatformAdmin(userId: string): Promise<void> {
    const direct = await this.pool.query(`SELECT 1 FROM users WHERE id = $1 AND is_platform_admin = true`, [userId]);
    if (direct.rows.length) return;
    const role = await this.pool.query(
      `SELECT 1 FROM role_assignments WHERE user_id = $1 AND role = 'ADMIN' AND scope_type = 'PLATFORM'`,
      [userId],
    );
    if (!role.rows.length) throw new ForbiddenException('Platform administrator access required');
  }

  async landlordIdForTenancy(tenancyId: string): Promise<string> {
    const { rows } = await this.pool.query<{ landlord_id: string }>(
      `SELECT landlord_id FROM tenancies WHERE id = $1`,
      [tenancyId],
    );
    if (!rows.length) throw new NotFoundException(`Tenancy ${tenancyId} not found`);
    return rows[0].landlord_id;
  }

  async assertTenancyAccess(
    userId: string,
    tenancyId: string,
    allowed: Role[] = READ_ROLES,
  ): Promise<TenancyAccess> {
    const landlordId = await this.landlordIdForTenancy(tenancyId);
    const roles = await this.rolesOnLandlord(userId, landlordId);
    if (roleSatisfies(roles, allowed)) return { landlordId, roles, isTenant: false };

    if (allowed.includes(Role.TENANT)) {
      const { rows } = await this.pool.query(
        `SELECT 1 FROM role_assignments
          WHERE user_id = $1 AND role = 'TENANT' AND scope_type = 'TENANCY' AND scope_id = $2`,
        [userId, tenancyId],
      );
      if (rows.length) return { landlordId, roles: [Role.TENANT], isTenant: true };
    }
    throw new ForbiddenException('No access to this tenancy');
  }

  async grant(params: GrantParams): Promise<string> {
    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM role_assignments
        WHERE user_id = $1 AND role = $2 AND scope_type = $3 AND scope_id IS NOT DISTINCT FROM $4`,
      [params.userId, params.role, params.scopeType, params.scopeId],
    );
    if (existing.rows.length) return existing.rows[0].id;

    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO role_assignments (user_id, role, scope_type, scope_id, granted_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [params.userId, params.role, params.scopeType, params.scopeId, params.grantedBy],
    );
    return rows[0].id;
  }

  async revoke(landlordId: string, assignmentId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM role_assignments
        WHERE id = $1
          AND ((scope_type = 'LANDLORD' AND scope_id = $2)
            OR (scope_type = 'TENANCY' AND scope_id IN (SELECT id FROM tenancies WHERE landlord_id = $2)))`,
      [assignmentId, landlordId],
    );
  }

  async listForLandlord(landlordId: string): Promise<
    Array<{ id: string; userId: string; userName: string; role: Role; scopeType: ScopeType; scopeId: string | null }>
  > {
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      user_name: string;
      role: Role;
      scope_type: ScopeType;
      scope_id: string | null;
    }>(
      `SELECT ra.id, ra.user_id, u.name AS user_name, ra.role, ra.scope_type, ra.scope_id
         FROM role_assignments ra
         JOIN users u ON u.id = ra.user_id
        WHERE (ra.scope_type = 'LANDLORD' AND ra.scope_id = $1)
           OR (ra.scope_type = 'TENANCY' AND ra.scope_id IN (SELECT id FROM tenancies WHERE landlord_id = $1))
        ORDER BY ra.created_at`,
      [landlordId],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      role: r.role,
      scopeType: r.scope_type,
      scopeId: r.scope_id,
    }));
  }
}
