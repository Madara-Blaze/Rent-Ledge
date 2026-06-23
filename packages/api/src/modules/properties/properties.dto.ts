import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'PG', 'CO_LIVING'] as const;

export class CreatePortfolioDto {
  @ApiProperty() @IsString() name!: string;
}

export class CreatePropertyDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ enum: PROPERTY_TYPES }) @IsOptional() @IsIn(PROPERTY_TYPES as unknown as string[]) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() portfolioId?: string;
}

export class CreateUnitDto {
  @ApiProperty() @IsString() label!: string;
}
