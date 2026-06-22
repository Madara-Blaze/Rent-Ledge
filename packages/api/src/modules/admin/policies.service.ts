import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';
import { CreatePolicyDto } from './policies.dto';

@Injectable()
export class PoliciesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list() {
    const { rows } = await this.pool.query(
      `SELECT id, jurisdiction, version, effective_from, effective_to, reviewed_by_counsel, created_at
         FROM jurisdiction_policies ORDER BY jurisdiction, version`,
    );
    return rows;
  }

  async getByJurisdiction(jurisdiction: string) {
    const { rows } = await this.pool.query(
      `SELECT id, jurisdiction, version, effective_from, effective_to, reviewed_by_counsel, body
         FROM jurisdiction_policies WHERE jurisdiction = $1 ORDER BY version`,
      [jurisdiction],
    );
    return rows;
  }

  async create(dto: CreatePolicyDto) {
    const { rows } = await this.pool.query<{ id: string; jurisdiction: string; version: number }>(
      `INSERT INTO jurisdiction_policies (jurisdiction, version, effective_from, effective_to, reviewed_by_counsel, body)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, jurisdiction, version`,
      [
        dto.jurisdiction,
        dto.version,
        dto.effectiveFrom,
        dto.effectiveTo ?? null,
        dto.reviewedByCounsel ?? false,
        JSON.stringify(dto.body),
      ],
    );
    return rows[0];
  }
}
