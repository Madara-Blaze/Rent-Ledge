import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { AcknowledgeHouseRulesDto, CreateHouseRulesDto } from './house-rules.dto';
import { HouseRulesService } from './house-rules.service';

@ApiTags('House rules')
@ApiBearerAuth()
@Controller()
export class HouseRulesController {
  constructor(
    private readonly svc: HouseRulesService,
    private readonly access: AccessService,
  ) {}

  @Post('workspaces/:landlordId/house-rules')
  @ApiOperation({ summary: 'Publish a new house-rules version' })
  async create(@Param('landlordId') landlordId: string, @Body() dto: CreateHouseRulesDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createVersion(landlordId, dto.propertyId, dto.body, user.userId);
  }

  @Get('workspaces/:landlordId/house-rules')
  async list(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listVersions(landlordId);
  }

  @Get('tenancies/:tenancyId/house-rules')
  @ApiOperation({ summary: 'Current house rules + acknowledgement status for a tenancy' })
  async current(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.currentForTenancy(tenancyId);
  }

  @Post('house-rules/:versionId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a house-rules version (tenant)' })
  async acknowledge(@Param('versionId') versionId: string, @Body() dto: AcknowledgeHouseRulesDto, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.acknowledge(versionId, dto.tenancyId, user.userId);
  }
}
