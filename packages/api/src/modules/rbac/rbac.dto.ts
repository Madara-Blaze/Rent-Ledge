import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ALL_ROLES, Role, ScopeType } from './roles';

const DELEGATABLE_SCOPES = ['LANDLORD', 'PORTFOLIO', 'PROPERTY', 'TENANCY'] as const;

export class GrantRoleDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty({ enum: ALL_ROLES }) @IsIn(ALL_ROLES as string[]) role!: Role;
  @ApiPropertyOptional({ enum: DELEGATABLE_SCOPES, description: 'Defaults to LANDLORD (whole workspace)' })
  @IsOptional()
  @IsIn(DELEGATABLE_SCOPES as unknown as string[])
  scopeType?: ScopeType;
  @ApiPropertyOptional({ description: 'Defaults to the workspace (landlord) id in the path' })
  @IsOptional()
  @IsUUID()
  scopeId?: string;
}
