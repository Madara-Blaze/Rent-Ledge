import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { READ_ROLES } from '../rbac/roles';
import { PeriodParams, ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@ApiQuery({ name: 'from', required: false, description: 'ISO date (inclusive); defaults to current FY' })
@ApiQuery({ name: 'to', required: false, description: 'ISO date (exclusive)' })
@ApiQuery({ name: 'propertyId', required: false })
@ApiQuery({ name: 'tenancyId', required: false })
@Controller('workspaces/:landlordId/reports')
export class ReportsController {
  constructor(
    private readonly svc: ReportsService,
    private readonly access: AccessService,
  ) {}

  private async guard(userId: string, landlordId: string): Promise<void> {
    await this.access.assertWorkspaceAccess(userId, landlordId, READ_ROLES);
  }

  private params(from?: string, to?: string, propertyId?: string, tenancyId?: string): PeriodParams {
    return { from, to, propertyId, tenancyId };
  }

  @Get('income-statement')
  @ApiOperation({ summary: 'Rental-income statement (per property/tenancy/period)' })
  async income(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyId') propertyId?: string,
    @Query('tenancyId') tenancyId?: string,
  ) {
    await this.guard(user.userId, landlordId);
    return this.svc.incomeStatement(landlordId, this.params(from, to, propertyId, tenancyId));
  }

  @Get('expense-report')
  @ApiOperation({ summary: 'Expense report' })
  async expenses(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyId') propertyId?: string,
    @Query('tenancyId') tenancyId?: string,
  ) {
    await this.guard(user.userId, landlordId);
    return this.svc.expenseReport(landlordId, this.params(from, to, propertyId, tenancyId));
  }

  @Get('pnl')
  @ApiOperation({ summary: 'Per-property profit & loss' })
  async pnl(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.guard(user.userId, landlordId);
    return this.svc.profitAndLoss(landlordId, this.params(from, to));
  }

  @Get('tds-summary')
  @ApiOperation({ summary: 'TDS summary (total + per tenancy)' })
  async tds(
    @Param('landlordId') landlordId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenancyId') tenancyId?: string,
  ) {
    await this.guard(user.userId, landlordId);
    return this.svc.tdsSummary(landlordId, this.params(from, to, undefined, tenancyId));
  }

  @Get('deposits-summary')
  @ApiOperation({ summary: 'Security deposits held, per tenancy' })
  async deposits(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.guard(user.userId, landlordId);
    return this.svc.depositsSummary(landlordId);
  }

  @Get('ca-pack')
  @ApiOperation({ summary: 'Year-end pack for the CA (income, expenses, TDS, deposits)' })
  @ApiQuery({ name: 'fy', required: false, description: "Financial year, e.g. '2025-26'; defaults to current" })
  async caPack(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser, @Query('fy') fy?: string) {
    await this.guard(user.userId, landlordId);
    return this.svc.caPack(landlordId, fy);
  }

  @Get('ca-pack.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rentledger-ca-pack.csv"')
  @ApiOperation({ summary: 'CA year-end pack as CSV' })
  @ApiQuery({ name: 'fy', required: false })
  async caPackCsv(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser, @Query('fy') fy?: string): Promise<string> {
    await this.guard(user.userId, landlordId);
    return this.svc.caPackCsv(landlordId, fy);
  }
}
