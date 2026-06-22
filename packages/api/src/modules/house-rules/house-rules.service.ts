import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { houseRulesAcknowledgements, houseRulesVersions } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { TenancyRepository } from '../tenancy/tenancy.repository';

@Injectable()
export class HouseRulesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly tenancyRepo: TenancyRepository,
  ) {}

  async createVersion(landlordId: string, propertyId: string | undefined, body: string, actor: string) {
    const { rows } = await this.pool.query<{ v: number }>(
      `SELECT COALESCE(MAX(version), 0) AS v FROM house_rules_versions
        WHERE landlord_id = $1 AND property_id IS NOT DISTINCT FROM $2`,
      [landlordId, propertyId ?? null],
    );
    const version = Number(rows[0].v) + 1;
    const [row] = await this.db
      .insert(houseRulesVersions)
      .values({ landlordId, propertyId: propertyId ?? null, version, body, createdBy: actor })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'house_rules.publish', resourceType: 'house_rules', resourceId: row.id, metadata: { version } });
    return row;
  }

  listVersions(landlordId: string) {
    return this.db.select().from(houseRulesVersions).where(eq(houseRulesVersions.landlordId, landlordId)).orderBy(desc(houseRulesVersions.version));
  }

  /** Current rules for a tenancy's property, plus this tenancy's acknowledgement status. */
  async currentForTenancy(tenancyId: string) {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(tenancyId);
    const { rows } = await this.pool.query<{ id: string; version: number; body: string; created_at: string }>(
      `SELECT id, version, body, created_at FROM house_rules_versions
        WHERE landlord_id = $1 AND (property_id = $2 OR property_id IS NULL)
        ORDER BY version DESC LIMIT 1`,
      [tenancy.landlordId, tenancy.propertyId],
    );
    const current = rows[0] ?? null;
    if (!current) return { current: null, acknowledged: false };
    const ack = await this.db
      .select()
      .from(houseRulesAcknowledgements)
      .where(eq(houseRulesAcknowledgements.houseRulesVersionId, current.id));
    const acknowledged = ack.some((a) => a.tenancyId === tenancyId);
    return { current, acknowledged, acknowledgements: ack };
  }

  async acknowledge(versionId: string, tenancyId: string | undefined, userId: string) {
    const [row] = await this.db
      .insert(houseRulesAcknowledgements)
      .values({ houseRulesVersionId: versionId, tenancyId: tenancyId ?? null, userId })
      .returning();
    return row;
  }

  async landlordIdForVersion(versionId: string): Promise<string> {
    const [row] = await this.db.select().from(houseRulesVersions).where(eq(houseRulesVersions.id, versionId)).limit(1);
    if (!row) throw new NotFoundException(`House-rules version ${versionId} not found`);
    return row.landlordId;
  }
}
