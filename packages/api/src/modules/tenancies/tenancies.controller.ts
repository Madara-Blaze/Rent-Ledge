import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, OWNER_ROLES, READ_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import {
  CreateInspectionDto,
  CreateTenancyDto,
  InviteTenantDto,
  TransitionTenancyDto,
} from './tenancies.dto';
import { TenanciesService } from './tenancies.service';

const OWNERSHIP_ACTIONS = new Set(['TERMINATE', 'EVICT']);

@ApiTags('Tenancies')
@ApiBearerAuth()
@Controller()
export class TenanciesController {
  constructor(
    private readonly svc: TenanciesService,
    private readonly access: AccessService,
  ) {}

  @Post('workspaces/:landlordId/tenancies')
  @ApiOperation({ summary: 'Create a tenancy (with primary tenant party)' })
  async create(@Param('landlordId') landlordId: string, @Body() dto: CreateTenancyDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createTenancy(landlordId, dto, user.userId);
  }

  @Get('workspaces/:landlordId/tenancies')
  async list(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listTenancies(landlordId);
  }

  @Get('tenancies/:tenancyId')
  async get(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.getTenancy(tenancyId);
  }

  @Post('tenancies/:tenancyId/transition')
  @ApiOperation({ summary: 'Advance the tenancy lifecycle (activate/notice/renew/terminate/end/evict)' })
  async transition(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: TransitionTenancyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const allowed = OWNERSHIP_ACTIONS.has(dto.action) ? OWNER_ROLES : MANAGE_ROLES;
    await this.access.assertTenancyAccess(user.userId, tenancyId, allowed);
    return this.svc.transition(tenancyId, dto.action, dto.reason, user.userId);
  }

  @Post('tenancies/:tenancyId/inspections')
  @ApiOperation({ summary: 'Record a move-in / move-out inspection' })
  async createInspection(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: CreateInspectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.createInspection(tenancyId, dto, user.userId);
  }

  @Get('tenancies/:tenancyId/inspections')
  async listInspections(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.listInspections(tenancyId);
  }

  @Post('tenancies/:tenancyId/invitations')
  @ApiOperation({ summary: 'Invite a tenant to claim this tenancy' })
  async invite(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: InviteTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.inviteTenant(landlordId, tenancyId, dto, user.userId);
  }

  @Get('workspaces/:landlordId/invitations')
  async listInvitations(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listInvitations(landlordId);
  }
}
