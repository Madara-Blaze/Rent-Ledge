import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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

export class CreateGstInvoiceDto extends CreateRentInvoiceDto {
  @ApiProperty({ example: '29ABCDE1234F1Z5', description: "Supplier (landlord) GSTIN" })
  @IsString()
  supplierGstin!: string;
  @ApiProperty({ example: '29', description: "Place of supply — property's 2-digit state code" })
  @IsString()
  placeOfSupply!: string;
  @ApiPropertyOptional({ example: '27AAAAA0000A1Z5', description: 'Recipient (tenant) GSTIN, for B2B' })
  @IsOptional()
  @IsString()
  recipientGstin?: string;
  @ApiPropertyOptional({ example: 1800, description: 'GST rate in basis points (default 1800 = 18%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  gstRateBps?: number;
  @ApiPropertyOptional({ example: '997212', description: 'SAC code (default: rental of commercial property)' })
  @IsOptional()
  @IsString()
  hsnSac?: string;
}

export class GstInvoicePreviewDto {
  @ApiProperty({ type: InvoicePreviewDto }) rent!: InvoicePreviewDto;
  @ApiProperty() taxableMinor!: string;
  @ApiProperty() cgstMinor!: string;
  @ApiProperty() sgstMinor!: string;
  @ApiProperty() igstMinor!: string;
  @ApiProperty() totalTaxMinor!: string;
  @ApiProperty() grossMinor!: string;
  @ApiProperty() rateBps!: number;
  @ApiProperty() interState!: boolean;
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
