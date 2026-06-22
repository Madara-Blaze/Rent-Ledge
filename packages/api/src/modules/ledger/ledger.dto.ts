import { ApiProperty } from '@nestjs/swagger';

export class AccountBalanceDto {
  @ApiProperty({ example: 'RENT_RECEIVABLE' }) code!: string;
  @ApiProperty({ example: 'ASSET' }) type!: string;
  @ApiProperty({ example: '2000000' }) debitMinor!: string;
  @ApiProperty({ example: '0' }) creditMinor!: string;
  @ApiProperty({ example: '2000000', description: 'Signed by the account normal side' })
  balanceMinor!: string;
}

export class ArrearsAgeingDto {
  @ApiProperty({ example: '2000000' }) bucket0to30!: string;
  @ApiProperty({ example: '0' }) bucket31to60!: string;
  @ApiProperty({ example: '0' }) bucket61to90!: string;
  @ApiProperty({ example: '0' }) bucket90plus!: string;
  @ApiProperty({ example: '2000000' }) totalOutstanding!: string;
}
