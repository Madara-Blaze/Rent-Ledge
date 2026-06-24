import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { DocumentsService, type UploadedFile as UploadedFileLike } from './documents.service';
import { UploadDocumentDto } from './documents.dto';

const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 15) * 1024 * 1024;

@ApiTags('Documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(
    private readonly svc: DocumentsService,
    private readonly access: AccessService,
  ) {}

  @Post('tenancies/:tenancyId/documents')
  @ApiOperation({ summary: 'Upload a lease document (and a record of what was signed)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: ['LEASE', 'ADDENDUM', 'OTHER'] },
        signedAt: { type: 'string', format: 'date-time' },
        signedBy: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @Param('tenancyId') tenancyId: string,
    @UploadedFile() file: UploadedFileLike,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('A file is required (multipart field "file")');
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.upload(landlordId, tenancyId, file, dto, user.userId);
  }

  @Get('tenancies/:tenancyId/documents')
  @ApiOperation({ summary: 'List lease documents for a tenancy' })
  async list(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.list(tenancyId);
  }

  @Get('documents/:documentId/download')
  @ApiOperation({ summary: 'Download the stored bytes of a lease document' })
  async download(@Param('documentId') documentId: string, @CurrentUser() user: AuthUser): Promise<StreamableFile> {
    const row = await this.svc.getRow(documentId);
    await this.access.assertTenancyAccess(user.userId, row.tenancyId, READ_ROLES_WITH_TENANT);
    const { bytes } = await this.svc.download(documentId);
    return new StreamableFile(bytes, {
      type: row.contentType,
      disposition: `attachment; filename="${row.fileName}"`,
      length: bytes.length,
    });
  }
}
