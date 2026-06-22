import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MoneyDto } from '../../common/money.util';

export class TdsPreviewDto {
  @ApiProperty() applicable!: boolean;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ description: 'Section code effective on the date (e.g. 194IB, or 393 from 1 Apr 2026)' })
  section?: string;
  @ApiPropertyOptional() legacySection?: string;
  @ApiPropertyOptional({ example: 200 }) rateBps?: number;
  @ApiPropertyOptional() panSurchargeApplied?: boolean;
  @ApiPropertyOptional({ type: MoneyDto }) base?: MoneyDto;
  @ApiPropertyOptional({ type: MoneyDto }) amount?: MoneyDto;
  @ApiPropertyOptional({ example: '26QC' }) returnForm?: string;
  @ApiPropertyOptional({ example: '16C' }) certificateForm?: string;
  @ApiPropertyOptional() filingDueDays?: number;
  @ApiPropertyOptional() deductionTiming?: string;
}
