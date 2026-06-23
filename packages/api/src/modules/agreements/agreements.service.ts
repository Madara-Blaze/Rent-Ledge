import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { agreementHash } from '../../domain/agreements/hash';
import { assessRegistration } from '../../domain/agreements/registration';
import { ClauseInput, renderClauses } from '../../domain/agreements/template';
import { Money } from '../../domain/money/money';
import { isoDate } from '../../domain/policy/jurisdiction-policy';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { agreements, agreementVersions, signerEvents } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policy/policy.service';
import { AddendumDto, ComplianceDto, CreateAgreementDto, SignAgreementDto } from './agreements.dto';
import { DEFAULT_RESIDENTIAL_CLAUSES } from './default-template';
import { ESIGN_PROVIDER, ESignProvider, SignerRole } from './esign.adapter';
import { STAMP_DUTY_PROVIDER, StampDutyProvider } from './stamp-duty.adapter';

type AgreementRow = typeof agreements.$inferSelect;
type VersionRow = typeof agreementVersions.$inferSelect;

interface TenancyContext {
  landlordId: string;
  landlordName: string;
  tenantName: string;
  propertyAddress: string | null;
  propertyType: string;
  rentMinor: string;
  depositMinor: string;
  billingDay: number;
  startDate: string;
  jurisdiction: string;
}

interface CreateOpts {
  templateId?: string;
  title?: string;
  termMonths?: number;
  variables?: Record<string, string>;
  supersedesId?: string;
}

@Injectable()
export class AgreementsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ESIGN_PROVIDER) private readonly esign: ESignProvider,
    @Inject(STAMP_DUTY_PROVIDER) private readonly stamp: StampDutyProvider,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async tenancyIdForAgreement(agreementId: string): Promise<string> {
    const { rows } = await this.pool.query<{ tenancy_id: string }>(
      `SELECT tenancy_id FROM agreements WHERE id = $1`,
      [agreementId],
    );
    if (!rows.length) throw new NotFoundException(`Agreement ${agreementId} not found`);
    return rows[0].tenancy_id;
  }

  createFromTemplate(landlordId: string, dto: CreateAgreementDto, actor: string) {
    return this.createAgreement(landlordId, dto.tenancyId, dto, actor);
  }

  async createAddendum(agreementId: string, dto: AddendumDto, actor: string) {
    const original = await this.getRow(agreementId);
    const result = await this.createAgreement(original.landlordId, original.tenancyId, { ...dto, supersedesId: original.id }, actor);
    await this.db.update(agreements).set({ status: 'AMENDED', updatedAt: new Date() }).where(eq(agreements.id, original.id));
    return result;
  }

  async sendForSignature(agreementId: string, actor: string) {
    const ag = await this.getRow(agreementId);
    if (ag.status !== 'DRAFT') throw new BadRequestException(`Only a DRAFT can be sent (status is ${ag.status})`);
    await this.db.update(agreements).set({ status: 'OUT_FOR_SIGNATURE', updatedAt: new Date() }).where(eq(agreements.id, agreementId));
    await this.audit.log({ actorUserId: actor, landlordId: ag.landlordId, action: 'agreement.send', resourceType: 'agreement', resourceId: agreementId });
    return this.getAgreement(agreementId);
  }

  async sign(agreementId: string, dto: SignAgreementDto, actor: string, ip?: string) {
    const ag = await this.getRow(agreementId);
    if (!ag.currentVersionId) throw new BadRequestException('Agreement has no version to sign');
    if (ag.status !== 'OUT_FOR_SIGNATURE' && ag.status !== 'PARTIALLY_SIGNED') {
      throw new BadRequestException(`Agreement is not open for signature (status ${ag.status})`);
    }
    const version = await this.getVersion(ag.currentVersionId);

    const result = await this.esign.sign({
      partyRole: dto.partyRole as SignerRole,
      name: dto.name,
      identifier: dto.identifier,
      documentHash: version.contentHash,
      ip,
    });

    await this.db.insert(signerEvents).values({
      agreementVersionId: version.id,
      partyRole: dto.partyRole,
      name: dto.name,
      identifier: dto.identifier ?? null,
      provider: result.provider,
      providerRef: result.providerRef,
      documentHash: result.documentHash,
      ip: ip ?? null,
      status: 'SIGNED',
      signedAt: result.signedAt,
    });

    const { rows } = await this.pool.query<{ party_role: string }>(
      `SELECT DISTINCT party_role FROM signer_events WHERE agreement_version_id = $1 AND status = 'SIGNED'`,
      [version.id],
    );
    const roles = new Set(rows.map((r) => r.party_role));
    const fullySigned = roles.has('LANDLORD') && roles.has('TENANT');
    const status = fullySigned ? 'SIGNED' : 'PARTIALLY_SIGNED';

    await this.db.update(agreements).set({ status, updatedAt: new Date() }).where(eq(agreements.id, agreementId));
    await this.audit.log({
      actorUserId: actor,
      landlordId: ag.landlordId,
      action: 'agreement.sign',
      resourceType: 'agreement',
      resourceId: agreementId,
      metadata: { partyRole: dto.partyRole, fullySigned },
    });
    return this.getAgreement(agreementId);
  }

  async updateCompliance(agreementId: string, dto: ComplianceDto, actor: string) {
    const ag = await this.getRow(agreementId);
    const patch: Partial<AgreementRow> = { updatedAt: new Date() };
    if (dto.stampDutyPaid) patch.stampDutyStatus = 'PAID';
    if (dto.registrationStatus) patch.registrationStatus = dto.registrationStatus;
    if (dto.rentAuthorityStatus) patch.rentAuthorityStatus = dto.rentAuthorityStatus;
    if (dto.rentAuthorityRef) patch.rentAuthorityRef = dto.rentAuthorityRef;
    if (dto.registrationStatus === 'REGISTERED') patch.status = 'REGISTERED';

    await this.db.update(agreements).set(patch).where(eq(agreements.id, agreementId));
    await this.audit.log({ actorUserId: actor, landlordId: ag.landlordId, action: 'agreement.compliance', resourceType: 'agreement', resourceId: agreementId, metadata: { ...dto } });
    return this.getAgreement(agreementId);
  }

  async listForTenancy(tenancyId: string) {
    const rows = await this.db.select().from(agreements).where(eq(agreements.tenancyId, tenancyId));
    return rows.map((r) => this.headerDto(r));
  }

  async getAgreement(agreementId: string) {
    const ag = await this.getRow(agreementId);
    const version = ag.currentVersionId ? await this.getVersion(ag.currentVersionId) : null;
    const signers = version
      ? await this.db.select().from(signerEvents).where(eq(signerEvents.agreementVersionId, version.id))
      : [];
    return {
      ...this.headerDto(ag),
      currentVersion: version
        ? {
            version: version.version,
            contentHash: version.contentHash,
            clauses: version.clauses,
            renderedText: version.renderedText,
          }
        : null,
      signers: signers.map((s) => ({
        partyRole: s.partyRole,
        name: s.name,
        provider: s.provider,
        providerRef: s.providerRef,
        documentHash: s.documentHash,
        signedAt: s.signedAt,
        status: s.status,
      })),
    };
  }

  // --- internals -----------------------------------------------------------

  private async createAgreement(landlordId: string, tenancyId: string, opts: CreateOpts, actor: string) {
    const ctx = await this.getContext(tenancyId);
    const jurisdiction = ctx.jurisdiction;
    const policy = await this.policy.resolve(jurisdiction, new Date());
    const termMonths = opts.termMonths ?? policy.registration.defaultTermMonths;
    const reg = assessRegistration(termMonths, policy);
    const clauses = await this.resolveClauses(opts.templateId, jurisdiction, ctx.propertyType);

    const rent = Money.of(ctx.rentMinor, 'INR');
    const deposit = Money.of(ctx.depositMinor, 'INR');
    const variables: Record<string, string> = {
      landlordName: ctx.landlordName,
      tenantName: ctx.tenantName,
      propertyAddress: ctx.propertyAddress ?? '',
      monthlyRent: rent.format('en-IN'),
      deposit: deposit.format('en-IN'),
      termMonths: String(termMonths),
      startDate: ctx.startDate,
      billingDay: String(ctx.billingDay),
      noticePeriodDays: String(policy.noticePeriods.terminationDays),
      jurisdiction,
      ...(opts.variables ?? {}),
    };

    const render = renderClauses(clauses, variables);
    const hash = agreementHash(render.text, variables);
    const stamp = this.stamp.compute({
      jurisdiction,
      annualRentMinor: rent.amountMinor * 12n,
      depositMinor: deposit.amountMinor,
      termMonths,
    });
    const rentAuthorityDue =
      reg.rentAuthorityRequired && reg.rentAuthorityFilingDays
        ? isoDate(new Date(Date.now() + reg.rentAuthorityFilingDays * 86_400_000))
        : null;

    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const [ag] = await tx
        .insert(agreements)
        .values({
          landlordId,
          tenancyId,
          templateId: opts.templateId ?? null,
          title: opts.title ?? `Rental Agreement — ${ctx.tenantName}`,
          jurisdiction,
          propertyType: ctx.propertyType,
          termMonths,
          status: 'DRAFT',
          registrationRequired: reg.registrationRequired,
          registrationStatus: reg.registrationRequired ? 'PENDING' : 'NOT_REQUIRED',
          stampDutyMinor: stamp.amountMinor,
          stampDutyStatus: 'NOT_PAID',
          rentAuthorityRequired: reg.rentAuthorityRequired,
          rentAuthorityStatus: reg.rentAuthorityRequired ? 'PENDING' : 'NOT_REQUIRED',
          rentAuthorityDue,
          supersedesId: opts.supersedesId ?? null,
          createdBy: actor,
        })
        .returning();

      const [version] = await tx
        .insert(agreementVersions)
        .values({
          agreementId: ag.id,
          version: 1,
          variables,
          clauses: render.clauses,
          renderedText: render.text,
          contentHash: hash,
          createdBy: actor,
        })
        .returning();

      await tx.update(agreements).set({ currentVersionId: version.id, updatedAt: new Date() }).where(eq(agreements.id, ag.id));

      await this.audit.log({
        actorUserId: actor,
        landlordId,
        action: opts.supersedesId ? 'agreement.addendum' : 'agreement.create',
        resourceType: 'agreement',
        resourceId: ag.id,
        metadata: { registrationRequired: reg.registrationRequired, unfilledVariables: render.missing },
      });

      return this.getAgreement(ag.id);
    });
  }

  private async resolveClauses(
    templateId: string | undefined,
    jurisdiction: string,
    propertyType: string,
  ): Promise<ClauseInput[]> {
    let keys: string[] | null = null;
    if (templateId) {
      const { rows } = await this.pool.query<{ clause_keys: string[] }>(
        `SELECT clause_keys FROM agreement_templates WHERE id = $1`,
        [templateId],
      );
      if (rows[0]) keys = rows[0].clause_keys;
    } else {
      const { rows } = await this.pool.query<{ clause_keys: string[] }>(
        `SELECT clause_keys FROM agreement_templates WHERE jurisdiction = $1 AND property_type = $2 ORDER BY version DESC LIMIT 1`,
        [jurisdiction, propertyType],
      );
      if (rows[0]) keys = rows[0].clause_keys;
    }
    if (!keys) return DEFAULT_RESIDENTIAL_CLAUSES;

    const out: ClauseInput[] = [];
    for (const key of keys) {
      const { rows } = await this.pool.query<{ clause_key: string; title: string; body: string }>(
        `SELECT clause_key, title, body FROM clauses WHERE clause_key = $1 AND jurisdiction = $2 ORDER BY version DESC LIMIT 1`,
        [key, jurisdiction],
      );
      if (rows[0]) out.push({ key: rows[0].clause_key, title: rows[0].title, body: rows[0].body });
      else {
        const fallback = DEFAULT_RESIDENTIAL_CLAUSES.find((c) => c.key === key);
        if (fallback) out.push(fallback);
      }
    }
    return out.length ? out : DEFAULT_RESIDENTIAL_CLAUSES;
  }

  private async getContext(tenancyId: string): Promise<TenancyContext> {
    const { rows } = await this.pool.query<{
      landlord_id: string;
      landlord_name: string;
      tenant_name: string;
      property_address: string | null;
      property_type: string;
      rent_minor: string;
      deposit_minor: string;
      billing_day: number;
      start_date: string;
      jurisdiction: string;
    }>(
      `SELECT tn.landlord_id, l.name AS landlord_name, te.name AS tenant_name,
              p.address AS property_address, p.type AS property_type,
              tn.rent_minor::text, tn.deposit_minor::text, tn.billing_day,
              tn.start_date::text, tn.jurisdiction
         FROM tenancies tn
         JOIN landlords l ON l.id = tn.landlord_id
         JOIN tenants te ON te.id = tn.primary_tenant_id
         JOIN properties p ON p.id = tn.property_id
        WHERE tn.id = $1`,
      [tenancyId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException(`Tenancy ${tenancyId} not found`);
    return {
      landlordId: r.landlord_id,
      landlordName: r.landlord_name,
      tenantName: r.tenant_name,
      propertyAddress: r.property_address,
      propertyType: r.property_type,
      rentMinor: r.rent_minor,
      depositMinor: r.deposit_minor,
      billingDay: r.billing_day,
      startDate: r.start_date,
      jurisdiction: r.jurisdiction,
    };
  }

  private async getRow(id: string): Promise<AgreementRow> {
    const [row] = await this.db.select().from(agreements).where(eq(agreements.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Agreement ${id} not found`);
    return row;
  }

  private async getVersion(id: string): Promise<VersionRow> {
    const [row] = await this.db.select().from(agreementVersions).where(eq(agreementVersions.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Agreement version ${id} not found`);
    return row;
  }

  private headerDto(r: AgreementRow) {
    return {
      id: r.id,
      tenancyId: r.tenancyId,
      title: r.title,
      jurisdiction: r.jurisdiction,
      propertyType: r.propertyType,
      termMonths: r.termMonths,
      status: r.status,
      registrationRequired: r.registrationRequired,
      registrationStatus: r.registrationStatus,
      stampDutyMinor: r.stampDutyMinor.toString(),
      stampDutyStatus: r.stampDutyStatus,
      rentAuthorityRequired: r.rentAuthorityRequired,
      rentAuthorityStatus: r.rentAuthorityStatus,
      rentAuthorityDue: r.rentAuthorityDue,
      rentAuthorityRef: r.rentAuthorityRef,
      supersedesId: r.supersedesId,
      createdAt: r.createdAt,
    };
  }
}
