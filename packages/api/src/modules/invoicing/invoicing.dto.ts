import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { MoneyDto } from '../../common/money.util';

export class CreateRentInvoiceDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiProperty({ example: '2026-06-01' }) @IsDateString() periodStart!: string;
  @ApiProperty({ example: '2026-06-30' }) @IsDateString() periodEnd!: string;
  @ApiProperty({ example: '2026-06-05' }) @IsDateString() dueDate!: string;
  @ApiPropertyOptional({ example: '2026-06-16', description: 'For a mid-month move-in' })
  @IsOptional()
  @IsDateString()
  occupancyStart?: string;
  @ApiPropertyOptional({ example: '2026-06-20', description: 'For a mid-month move-out' })
  @IsOptional()
  @IsDateString()
  occupancyEnd?: string;
  @ApiPropertyOptional({ description: 'Idempotency key for safe retries' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class InvoicePreviewDto {
  @ApiProperty({ type: MoneyDto }) baseRent!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) escalatedRent!: MoneyDto;
  @ApiProperty() escalationPeriodsApplied!: number;
  @ApiProperty() chargeableDays!: number;
  @ApiProperty() totalDays!: number;
  @ApiProperty({ example: 'ACTUAL_DAYS_IN_PERIOD' }) prorationBasis!: string;
  @ApiProperty({ type: MoneyDto }) amount!: MoneyDto;
}

export class InvoiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() number!: string;
  @ApiProperty({ example: 'RENT' }) kind!: string;
  @ApiProperty() tenancyId!: string;
  @ApiPropertyOptional() periodStart?: string | null;
  @ApiPropertyOptional() periodEnd?: string | null;
  @ApiProperty() dueDate!: string;
  @ApiProperty({ type: MoneyDto }) amount!: MoneyDto;
  @ApiProperty({ example: 'OPEN' }) status!: string;
  @ApiPropertyOptional() journalEntryId?: string | null;
}

export class ApplyLateFeeDto {
  @ApiProperty() @IsUUID() invoiceId!: string;
  @ApiPropertyOptional({ description: 'ISO date; defaults to today' })
  @IsOptional()
  @IsDateString()
  asOf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idempotencyKey?: string;
}

export class LateFeeResultDto {
  @ApiProperty() applied!: boolean;
  @ApiProperty() daysLate!: number;
  @ApiProperty() chargeableDays!: number;
  @ApiProperty({ type: MoneyDto }) fee!: MoneyDto;
  @ApiPropertyOptional({ type: InvoiceDto }) invoice?: InvoiceDto;
}
