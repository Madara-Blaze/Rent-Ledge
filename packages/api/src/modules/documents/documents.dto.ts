import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const DOCUMENT_KINDS = ['LEASE', 'ADDENDUM', 'OTHER'] as const;

/** Metadata sent alongside the multipart file upload (all optional text fields). */
export class UploadDocumentDto {
  @ApiPropertyOptional({ enum: DOCUMENT_KINDS, default: 'LEASE' })
  @IsOptional()
  @IsIn(DOCUMENT_KINDS as unknown as string[])
  kind?: string;

  @ApiPropertyOptional({ description: 'Link to an agreement record, if any' })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @ApiPropertyOptional({ description: 'When the document was signed (if already signed)' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @ApiPropertyOptional({ description: 'Who signed / signing note' })
  @IsOptional()
  @IsString()
  signedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
