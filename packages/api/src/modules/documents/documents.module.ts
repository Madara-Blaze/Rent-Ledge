import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { DOCUMENT_STORAGE } from './document-storage.adapter';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorage } from './local-document-storage.adapter';

@Module({
  imports: [RbacModule, AuditModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    // Dev/default = local filesystem. Swap for Supabase Storage / S3 behind the
    // same interface in prod (private bucket + signed URLs).
    { provide: DOCUMENT_STORAGE, useClass: LocalDocumentStorage },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
