import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  ChainEntry,
  GENESIS_HASH,
  contentHashOf,
  entryHashOf,
  verifyChain,
} from '../../domain/evidence/evidence-chain';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { disputeCases, evidenceEntries } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';

export interface AppendEvidenceInput {
  entryType: string;
  summary: string;
  content?: Record<string, unknown> | null;
  tenancyId?: string | null;
  disputeCaseId?: string | null;
}

type EvidenceRow = typeof evidenceEntries.$inferSelect;
const rowsOf = <T>(res: unknown): T[] => (res as { rows: T[] }).rows;

@Injectable()
export class EvidenceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /** Append a tamper-evident entry to the workspace's hash chain. */
  async append(landlordId: string, input: AppendEvidenceInput, actor?: string): Promise<EvidenceRow> {
    return this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const res = await tx.execute(
        sql`SELECT seq::text AS seq, entry_hash FROM evidence_entries WHERE landlord_id = ${landlordId} ORDER BY seq DESC LIMIT 1 FOR UPDATE`,
      );
      const last = rowsOf<{ seq: string; entry_hash: string }>(res)[0];
      const seq = last ? BigInt(last.seq) + 1n : 1n;
      const prevHash = last ? last.entry_hash : GENESIS_HASH;
      const createdAtIso = new Date().toISOString();
      const contentHash = contentHashOf({
        entryType: input.entryType,
        summary: input.summary,
        content: input.content ?? null,
        authorUserId: actor ?? null,
      });
      const entryHash = entryHashOf(prevHash, contentHash, seq, createdAtIso);

      const [row] = await tx
        .insert(evidenceEntries)
        .values({
          landlordId,
          disputeCaseId: input.disputeCaseId ?? null,
          tenancyId: input.tenancyId ?? null,
          seq,
          authorUserId: actor ?? null,
          entryType: input.entryType,
          summary: input.summary,
          content: input.content ?? null,
          contentHash,
          prevHash,
          entryHash,
          createdAt: new Date(createdAtIso),
        })
        .returning();

      await this.audit.log({ actorUserId: actor, landlordId, action: 'evidence.append', resourceType: 'evidence', resourceId: row.id });
      return row;
    });
  }

  async list(landlordId: string, disputeCaseId?: string) {
    const rows = await this.loadEntries(landlordId, disputeCaseId);
    return rows.map((r) => this.toDto(r));
  }

  /** Re-derive every content hash and walk the chain to detect any tampering. */
  async verify(landlordId: string) {
    const rows = await this.loadEntries(landlordId);
    for (const e of rows) {
      const recomputed = contentHashOf({
        entryType: e.entryType,
        summary: e.summary,
        content: e.content,
        authorUserId: e.authorUserId,
      });
      if (recomputed !== e.contentHash) {
        return { valid: false, brokenAtSeq: Number(e.seq), reason: 'content hash mismatch', count: rows.length };
      }
    }
    const chain: ChainEntry[] = rows.map((e) => ({
      seq: e.seq,
      contentHash: e.contentHash,
      prevHash: e.prevHash,
      entryHash: e.entryHash,
      createdAt: new Date(e.createdAt).toISOString(),
    }));
    return { ...verifyChain(chain), count: rows.length };
  }

  /** Chronological, hash-verified evidence bundle (for a Rent Authority / tribunal). */
  async bundle(landlordId: string, disputeCaseId?: string) {
    const rows = await this.loadEntries(landlordId, disputeCaseId);
    const verification = await this.verify(landlordId);
    const head = rows[rows.length - 1];
    return {
      generatedAt: new Date().toISOString(),
      landlordId,
      disputeCaseId: disputeCaseId ?? null,
      count: rows.length,
      verification,
      manifest: {
        algorithm: 'sha256 hash chain (prevHash | contentHash | seq | createdAt)',
        genesisHash: GENESIS_HASH,
        headHash: head?.entryHash ?? GENESIS_HASH,
      },
      entries: rows.map((r) => this.toDto(r)),
    };
  }

  async createDispute(landlordId: string, title: string, tenancyId: string | undefined, actor: string) {
    const [row] = await this.db
      .insert(disputeCases)
      .values({ landlordId, tenancyId: tenancyId ?? null, title, status: 'OPEN', createdBy: actor })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'dispute.create', resourceType: 'dispute', resourceId: row.id });
    await this.append(landlordId, { entryType: 'DISPUTE_OPENED', summary: `Dispute opened: ${title}`, tenancyId, disputeCaseId: row.id }, actor);
    return row;
  }

  listDisputes(landlordId: string) {
    return this.db.select().from(disputeCases).where(eq(disputeCases.landlordId, landlordId));
  }

  async updateDispute(landlordId: string, disputeId: string, patch: { status?: string; resolutionNotes?: string }, actor: string) {
    const [row] = await this.db
      .update(disputeCases)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(disputeCases.id, disputeId))
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'dispute.update', resourceType: 'dispute', resourceId: disputeId, metadata: { ...patch } });
    return row;
  }

  // --- internals ---

  private loadEntries(landlordId: string, disputeCaseId?: string) {
    const base = this.db.select().from(evidenceEntries);
    const where = disputeCaseId
      ? base.where(eq(evidenceEntries.disputeCaseId, disputeCaseId))
      : base.where(eq(evidenceEntries.landlordId, landlordId));
    return where.orderBy(asc(evidenceEntries.seq));
  }

  private toDto(r: EvidenceRow) {
    return {
      id: r.id,
      seq: r.seq.toString(),
      entryType: r.entryType,
      summary: r.summary,
      content: r.content,
      tenancyId: r.tenancyId,
      disputeCaseId: r.disputeCaseId,
      contentHash: r.contentHash,
      prevHash: r.prevHash,
      entryHash: r.entryHash,
      createdAt: r.createdAt,
    };
  }
}
