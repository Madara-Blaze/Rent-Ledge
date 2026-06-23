import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHouseRulesDto {
  @ApiPropertyOptional({ description: 'Scope to a property; omit for workspace-wide rules' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;
  @ApiProperty() @IsString() body!: string;
}

export class AcknowledgeHouseRulesDto {
  @ApiProperty() @IsUUID() tenancyId!: string;
}
