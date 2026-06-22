import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PayerClass } from '../../domain/policy/jurisdiction-policy';
import { PG_POOL } from '../../infra/db/db.module';

/** Escalation clause as stored in tenancy JSONB (dates are ISO strings). */
export interface StoredEscalation {
  type: 'PERCENT' | 'AMOUNT';
  rateBps?: number;
  amountMinor?: string;
  frequencyMonths: number;
  startDate: string;
  compounding?: boolean;
  maxRentMinor?: string | null;
}

export interface TenancyRow {
  id: string;
  landlordId: string;
  propertyId: string;
  unitId: string | null;
  primaryTenantId: string;
  currency: string;
  jurisdiction: string;
  rentMinor: bigint;
  depositMinor: bigint;
  billingDay: number;
  startDate: string;
  endDate: string | null;
  escalation: StoredEscalation | null;
  status: string;
}

export interface TaxContext {
  payerClass: PayerClass;
  landlordPanValid: boolean;
}

@Injectable()
export class TenancyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<TenancyRow | null> {
    const { rows } = await this.pool.query<{
      id: string;
      landlord_id: string;
      property_id: string;
      unit_id: string | null;
      primary_tenant_id: string;
      currency: string;
      jurisdiction: string;
      rent_minor: string;
      deposit_minor: string;
      billing_day: number;
      start_date: string;
      end_date: string | null;
      escalation: StoredEscalation | null;
      status: string;
    }>(
      `SELECT id, landlord_id, property_id, unit_id, primary_tenant_id, currency, jurisdiction,
              rent_minor::text, deposit_minor::text, billing_day,
              start_date::text, end_date::text, escalation, status
         FROM tenancies WHERE id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      landlordId: r.landlord_id,
      propertyId: r.property_id,
      unitId: r.unit_id,
      primaryTenantId: r.primary_tenant_id,
      currency: r.currency,
      jurisdiction: r.jurisdiction,
      rentMinor: BigInt(r.rent_minor),
      depositMinor: BigInt(r.deposit_minor),
      billingDay: r.billing_day,
      startDate: r.start_date,
      endDate: r.end_date,
      escalation: r.escalation,
      status: r.status,
    };
  }

  async findByIdOrThrow(id: string): Promise<TenancyRow> {
    const t = await this.findById(id);
    if (!t) throw new NotFoundException(`Tenancy ${id} not found`);
    return t;
  }

  /** PAN validity + payer class drive the TDS determination. */
  async getTaxContext(tenancyId: string): Promise<TaxContext> {
    const { rows } = await this.pool.query<{ payer_class: PayerClass; pan_valid: boolean }>(
      `SELECT t.payer_class, l.pan_valid
         FROM tenancies tn
         JOIN tenants t ON t.id = tn.primary_tenant_id
         JOIN landlords l ON l.id = tn.landlord_id
        WHERE tn.id = $1`,
      [tenancyId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException(`Tenancy ${tenancyId} not found`);
    return { payerClass: r.payer_class, landlordPanValid: r.pan_valid };
  }
}
