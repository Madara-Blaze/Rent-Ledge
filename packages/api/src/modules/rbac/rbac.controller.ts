import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from './access.service';
import { GrantRoleDto } from './rbac.dto';
import { OWNER_ROLES, READ_ROLES, ScopeType } from './roles';

@ApiTags('Access control')
@Controller('workspaces/:landlordId/roles')
export class RbacController {
  constructor(private readonly access: AccessService) {}

  @Get()
  @ApiOperation({ summary: 'List role assignments in a workspace' })
  async list(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.access.listForLandlord(landlordId);
  }

  @Post()
  @ApiOperation({ summary: 'Delegate a role to a user (owner/co-owner only)' })
  async grant(
    @Param('landlordId') landlordId: string,
    @Body() dto: GrantRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, OWNER_ROLES);
    const id = await this.access.grant({
      userId: dto.userId,
      role: dto.role,
      scopeType: (dto.scopeType ?? 'LANDLORD') as ScopeType,
      scopeId: dto.scopeId ?? landlordId,
      grantedBy: user.userId,
    });
    return { id };
  }

  @Delete(':assignmentId')
  @ApiOperation({ summary: 'Revoke a role assignment (owner/co-owner only)' })
  async revoke(
    @Param('landlordId') landlordId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, OWNER_ROLES);
    await this.access.revoke(landlordId, assignmentId);
    return { revoked: true };
  }
}
