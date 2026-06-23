import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class AppendEvidenceDto {
  @ApiProperty({ example: 'PAYMENT_PROOF' }) @IsString() entryType!: string;
  @ApiProperty() @IsString() summary!: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() content?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tenancyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() disputeCaseId?: string;
}

export class CreateDisputeDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tenancyId?: string;
}

export class UpdateDisputeDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'ESCALATED', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'ESCALATED', 'RESOLVED', 'CLOSED'])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNotes?: string;
}
