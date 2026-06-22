import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { MoneyDto } from '../../common/money.util';

export const PAYMENT_METHODS = [
  'UPI',
  'CARD',
  'NETBANKING',
  'CASH',
  'CHEQUE',
  'BANK_TRANSFER',
  'ADJUSTMENT',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const MINOR = /^[0-9]+$/;

export class AllocationInput {
  @ApiProperty() @IsUUID() invoiceId!: string;
  @ApiProperty({ example: '2000000' }) @Matches(MINOR) amountMinor!: string;
}

export class RecordPaymentDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiProperty({ example: '2000000', description: 'Cash actually received, in minor units' })
  @Matches(MINOR)
  amountMinor!: string;
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS) method!: PaymentMethod;
  @ApiPropertyOptional({ example: '40000', description: 'TDS withheld by the tenant, if any' })
  @IsOptional()
  @Matches(MINOR)
  tdsMinor?: string;
  @ApiPropertyOptional({
    type: [AllocationInput],
    description: 'Explicit invoice allocations; omit to auto-allocate oldest-first',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationInput)
  allocations?: AllocationInput[];
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gateway?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gatewayPaymentId?: string;
  @ApiPropertyOptional({ description: 'Idempotency key for safe retries' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class AllocationDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty({ type: MoneyDto }) amount!: MoneyDto;
}

export class PaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenancyId!: string;
  @ApiProperty() method!: string;
  @ApiProperty({ type: MoneyDto }) amount!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) tds!: MoneyDto;
  @ApiProperty() status!: string;
  @ApiProperty({ type: [AllocationDto] }) allocations!: AllocationDto[];
  @ApiProperty({ type: MoneyDto, description: 'Unallocated amount rolled forward as advance' })
  advance!: MoneyDto;
  @ApiPropertyOptional() journalEntryId?: string | null;
}
