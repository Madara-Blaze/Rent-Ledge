import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES } from '../rbac/roles';
import { RemindersService } from './reminders.service';

@ApiTags('Reminders')
@ApiBearerAuth()
@Controller()
export class RemindersController {
  constructor(
    private readonly svc: RemindersService,
    private readonly access: AccessService,
  ) {}

  @Get('workspaces/:landlordId/reminders/preview')
  @ApiOperation({ summary: 'Dry-run: rent overdue / due-soon and who would be reminded' })
  @ApiQuery({ name: 'windowDays', required: false, description: 'Days ahead to include as due-soon (default 3)' })
  async preview(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('windowDays') windowDays?: string,
  ) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.preview(landlordId, { windowDays: windowDays ? Number(windowDays) : undefined });
  }

  @Post('workspaces/:landlordId/reminders/send')
  @ApiOperation({ summary: 'Send rent reminders for everything due (idempotent per invoice/day)' })
  async send(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.sendDue(landlordId, user.userId);
  }

  @Post('tenancies/:tenancyId/reminders/send')
  @ApiOperation({ summary: 'Send rent reminders for a single tenancy (idempotent per invoice/day)' })
  async sendForTenancy(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.sendDue(landlordId, user.userId, tenancyId);
  }
}
