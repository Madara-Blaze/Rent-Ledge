import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { NOTICE_TYPES } from '../../domain/notices/notice-rules';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];

export class CreateNoticeDto {
  @ApiProperty() @IsString() tenancyId!: string;
  @ApiProperty({ enum: NOTICE_TYPES }) @IsIn(NOTICE_TYPES as unknown as string[]) type!: string;
  @ApiProperty() @IsString() subject!: string;
  @ApiProperty() @IsString() body!: string;
  @ApiPropertyOptional({ example: '2026-08-01' }) @IsOptional() @IsDateString() effectiveDate?: string;
}

export class SendNoticeDto {
  @ApiPropertyOptional({ enum: CHANNELS, description: 'Defaults to EMAIL' })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: string;
}

// (kept for potential multi-channel sends)
export class MultiChannelDto {
  @ApiPropertyOptional({ isArray: true, enum: CHANNELS })
  @IsOptional()
  @IsArray()
  channels?: string[];
}
