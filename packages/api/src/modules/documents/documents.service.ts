import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { leaseDocuments } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { DOCUMENT_STORAGE, type DocumentStorageAdapter } from './document-storage.adapter';
import { UploadDocumentDto } from './documents.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type LeaseDocumentRow = typeof leaseDocuments.$inferSelect;

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorageAdapter,
    private readonly audit: AuditService,
  ) {}

  async upload(
    landlordId: string,
    tenancyId: string,
    file: UploadedFile,
    dto: UploadDocumentDto,
    actor: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'document';
    const storageKey = `leases/${tenancyId}/${randomUUID()}-${safeName}`;

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const [row] = await this.db
      .insert(leaseDocuments)
      .values({
        landlordId,
        tenancyId,
        agreementId: dto.agreementId ?? null,
        kind: dto.kind ?? 'LEASE',
        fileName: safeName,
        contentType: file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(file.size ?? file.buffer.length),
        storageKey,
        sha256,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
        signedBy: dto.signedBy ?? null,
        notes: dto.notes ?? null,
        uploadedBy: actor,
      })
      .returning();

    await this.audit.log({
      actorUserId: actor,
      landlordId,
      action: 'lease_document.upload',
      resourceType: 'lease_document',
      resourceId: row.id,
      metadata: { sha256, kind: row.kind, signed: Boolean(row.signedAt) },
    });
    return this.toDto(row);
  }

  async list(tenancyId: string) {
    const rows = await this.db
      .select()
      .from(leaseDocuments)
      .where(eq(leaseDocuments.tenancyId, tenancyId))
      .orderBy(desc(leaseDocuments.createdAt));
    return rows.map((r) => this.toDto(r));
  }

  /** Returns the row (for access checks) plus the stored bytes. */
  async download(documentId: string): Promise<{ row: LeaseDocumentRow; bytes: Buffer }> {
    const row = await this.getRow(documentId);
    const bytes = await this.storage.get(row.storageKey);
    return { row, bytes };
  }

  async getRow(documentId: string): Promise<LeaseDocumentRow> {
    const [row] = await this.db
      .select()
      .from(leaseDocuments)
      .where(eq(leaseDocuments.id, documentId))
      .limit(1);
    if (!row) throw new NotFoundException(`Document ${documentId} not found`);
    return row;
  }

  /** API view: never leaks the internal storage key. */
  private toDto(r: LeaseDocumentRow) {
    return {
      id: r.id,
      tenancyId: r.tenancyId,
      agreementId: r.agreementId,
      kind: r.kind,
      fileName: r.fileName,
      contentType: r.contentType,
      sizeBytes: r.sizeBytes.toString(),
      sha256: r.sha256,
      signedAt: r.signedAt,
      signedBy: r.signedBy,
      notes: r.notes,
      uploadedBy: r.uploadedBy,
      createdAt: r.createdAt,
    };
  }
}
