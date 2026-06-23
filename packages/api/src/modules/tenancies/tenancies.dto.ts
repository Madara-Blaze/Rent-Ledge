import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const MINOR = /^[0-9]+$/;
const PAYER_CLASSES = ['INDIVIDUAL_HUF', 'COMPANY_FIRM_AUDITED', 'OTHER'] as const;
export const TENANCY_ACTIONS = [
  'ISSUE_AGREEMENT',
  'ACTIVATE',
  'START_NOTICE',
  'RENEW',
  'TERMINATE',
  'END',
  'EVICT',
] as const;
export type TenancyAction = (typeof TENANCY_ACTIONS)[number];

export class CreateTenancyDto {
  @ApiProperty() @IsUUID() propertyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiProperty() @IsString() tenantName!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() tenantEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tenantPhone?: string;
  @ApiPropertyOptional({ enum: PAYER_CLASSES }) @IsOptional() @IsIn(PAYER_CLASSES as unknown as string[]) payerClass?: string;
  @ApiPropertyOptional({ example: 'INR' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional({ example: 'IN' }) @IsOptional() @IsString() jurisdiction?: string;
  @ApiProperty({ example: '5500000', description: 'Monthly rent in minor units' }) @Matches(MINOR) rentMinor!: string;
  @ApiPropertyOptional({ example: '5500000' }) @IsOptional() @Matches(MINOR) depositMinor?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) @Max(28) billingDay?: number;
  @ApiProperty({ example: '2026-06-01' }) @IsDateString() startDate!: string;
  @ApiPropertyOptional({ description: 'EscalationSchedule (type/rateBps/frequencyMonths/startDate/...)' })
  @IsOptional()
  @IsObject()
  escalation?: Record<string, unknown>;
  @ApiPropertyOptional({ example: 'DRAFT' }) @IsOptional() @IsString() status?: string;
}

export class TransitionTenancyDto {
  @ApiProperty({ enum: TENANCY_ACTIONS }) @IsIn(TENANCY_ACTIONS as unknown as string[]) action!: TenancyAction;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateInspectionDto {
  @ApiProperty({ enum: ['MOVE_IN', 'MOVE_OUT'] }) @IsIn(['MOVE_IN', 'MOVE_OUT']) type!: 'MOVE_IN' | 'MOVE_OUT';
  @ApiPropertyOptional() @IsOptional() @IsString() conditionNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() checklist?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() evidenceRefs?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsDateString() conductedAt?: string;
}

export class InviteTenantDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}
