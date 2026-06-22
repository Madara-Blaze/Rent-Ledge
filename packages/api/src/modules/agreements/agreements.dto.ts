import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const SIGNER_ROLES = ['LANDLORD', 'TENANT', 'GUARANTOR', 'WITNESS'] as const;
const REGISTRATION_STATUS = ['NOT_REQUIRED', 'PENDING', 'FILED', 'REGISTERED'] as const;
const RENT_AUTHORITY_STATUS = ['NOT_REQUIRED', 'PENDING', 'FILED'] as const;

export class CreateAgreementDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional({ example: 11 }) @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number;
  @ApiPropertyOptional({ description: 'Extra/override template variables' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class AddendumDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() variables?: Record<string, string>;
}

export class SignAgreementDto {
  @ApiProperty({ enum: SIGNER_ROLES }) @IsIn(SIGNER_ROLES as unknown as string[]) partyRole!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() identifier?: string;
}

export class ComplianceDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() stampDutyPaid?: boolean;
  @ApiPropertyOptional({ enum: REGISTRATION_STATUS })
  @IsOptional()
  @IsIn(REGISTRATION_STATUS as unknown as string[])
  registrationStatus?: string;
  @ApiPropertyOptional({ enum: RENT_AUTHORITY_STATUS })
  @IsOptional()
  @IsIn(RENT_AUTHORITY_STATUS as unknown as string[])
  rentAuthorityStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rentAuthorityRef?: string;
}
