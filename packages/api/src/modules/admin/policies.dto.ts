import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ example: 'IN-MH' }) @IsString() jurisdiction!: string;
  @ApiProperty({ example: 1 }) @IsInt() version!: number;
  @ApiProperty({ example: '2026-04-01' }) @IsDateString() effectiveFrom!: string;
  @ApiPropertyOptional({ example: '2027-03-31' }) @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reviewedByCounsel?: boolean;
  @ApiProperty({ description: 'Full JurisdictionPolicy JSON (tds, lateFee, deposit, registration, …)' })
  @IsObject()
  body!: Record<string, unknown>;
}
