import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const BEARERS = ['LANDLORD', 'TENANT', 'SPLIT'];

export class CreateVendorDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
}

export class CreateTicketDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedVendorId?: string;
  @ApiPropertyOptional({ description: 'Cost in minor units' }) @IsOptional() @Matches(/^[0-9]+$/) costMinor?: string;
  @ApiPropertyOptional({ enum: BEARERS }) @IsOptional() @IsIn(BEARERS) costBearer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
