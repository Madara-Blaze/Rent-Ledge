import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DEFAULT_POLICIES } from '../../domain/policy/india-default.policy';
import { JurisdictionPolicy, resolvePolicy } from '../../domain/policy/jurisdiction-policy';
import { PG_POOL } from '../../infra/db/db.module';

/**
 * Loads versioned jurisdiction policies. Reads from the DB when seeded; otherwise
 * falls back to the shipped India defaults so the rule engine works out-of-the-box.
 */
@Injectable()
export class PolicyService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getPolicies(jurisdiction: string): Promise<JurisdictionPolicy[]> {
    const { rows } = await this.pool.query<{ body: JurisdictionPolicy }>(
      'SELECT body FROM jurisdiction_policies WHERE jurisdiction = $1',
      [jurisdiction],
    );
    if (rows.length > 0) return rows.map((r) => r.body);
    return DEFAULT_POLICIES.filter((p) => p.jurisdiction === jurisdiction);
  }

  /** The policy version in force for a jurisdiction on a given date. */
  async resolve(jurisdiction: string, onDate: Date): Promise<JurisdictionPolicy> {
    const policies = await this.getPolicies(jurisdiction);
    const pool = policies.length > 0 ? policies : DEFAULT_POLICIES;
    return resolvePolicy(pool, jurisdiction, onDate);
  }
}
