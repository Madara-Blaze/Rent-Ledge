import { ApiProperty } from '@nestjs/swagger';
import { Money } from '../domain/money/money';

/** Wire representation of money: integer minor units as a string + ISO currency. */
export class MoneyDto {
  @ApiProperty({ example: '2000000', description: 'Amount in integer minor units (paise)' })
  amountMinor!: string;

  @ApiProperty({ example: 'INR' })
  currency!: string;
}

export function moneyToDto(m: Money): MoneyDto {
  return { amountMinor: m.amountMinor.toString(), currency: m.currency };
}

export function toMoney(amountMinor: string | number | bigint, currency: string): Money {
  return Money.of(amountMinor, currency);
}
