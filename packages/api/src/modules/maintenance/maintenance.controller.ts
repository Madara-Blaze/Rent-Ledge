import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { CreateTicketDto, CreateVendorDto, UpdateTicketDto } from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  constructor(
    private readonly svc: MaintenanceService,
    private readonly access: AccessService,
  ) {}

  @Post('workspaces/:landlordId/vendors')
  async createVendor(@Param('landlordId') landlordId: string, @Body() dto: CreateVendorDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createVendor(landlordId, dto, user.userId);
  }

  @Get('workspaces/:landlordId/vendors')
  async listVendors(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listVendors(landlordId);
  }

  @Post('tenancies/:tenancyId/maintenance/tickets')
  @ApiOperation({ summary: 'Raise a maintenance ticket (tenant or staff)' })
  async createTicket(@Param('tenancyId') tenancyId: string, @Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.createTicket(tenancyId, dto, user.userId);
  }

  @Get('workspaces/:landlordId/maintenance/tickets')
  async listTickets(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listTickets(landlordId);
  }

  @Get('maintenance/tickets/:id')
  async getTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const landlordId = await this.svc.landlordIdForTicket(id);
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.getTicket(id);
  }

  @Post('maintenance/tickets/:id')
  @ApiOperation({ summary: 'Update a ticket (status/cost/assignment); tenant-borne cost charges back to the ledger' })
  async updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: AuthUser) {
    const landlordId = await this.svc.landlordIdForTicket(id);
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.updateTicket(id, dto, user.userId);
  }
}
