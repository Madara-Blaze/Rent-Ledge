import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { MoneyDto } from '../../common/money.util';

const MINOR = /^[0-9]+$/;

export class CollectDepositDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiProperty({ example: '4000000' }) @Matches(MINOR) amountMinor!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idempotencyKey?: string;
}

export class DeductDepositDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiProperty({ example: '500000' }) @Matches(MINOR) amountMinor!: string;
  @ApiProperty({ description: 'Reason for the deduction (tied to inspection evidence)' })
  @IsString()
  reason!: string;
  @ApiPropertyOptional({ description: 'Reference to the move-out inspection / evidence record' })
  @IsOptional()
  @IsString()
  evidenceRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idempotencyKey?: string;
}

export class RefundDepositDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
  @ApiProperty({ example: '3500000' }) @Matches(MINOR) amountMinor!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idempotencyKey?: string;
}

export class DepositStatementDto {
  @ApiProperty() tenancyId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ example: 'HELD' }) status!: string;
  @ApiProperty({ type: MoneyDto }) target!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) collected!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) deducted!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) interest!: MoneyDto;
  @ApiProperty({ type: MoneyDto }) refunded!: MoneyDto;
  @ApiProperty({ type: MoneyDto, description: 'collected + interest − deducted − refunded' })
  balanceHeld!: MoneyDto;
}
