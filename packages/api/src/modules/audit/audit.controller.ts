import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { READ_ROLES } from '../rbac/roles';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('workspaces/:landlordId/audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Recent audit-log entries for a workspace' })
  async list(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.audit.listForLandlord(landlordId, limit ? Number(limit) : 100);
  }
}
