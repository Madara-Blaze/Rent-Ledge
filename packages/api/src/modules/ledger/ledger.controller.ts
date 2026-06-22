import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { AccountBalanceDto, ArrearsAgeingDto } from './ledger.dto';
import { LedgerService } from './ledger.service';

@ApiTags('Ledger')
@ApiBearerAuth()
@Controller('tenancies/:tenancyId')
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly access: AccessService,
  ) {}

  @Get('ledger')
  @ApiOperation({ summary: 'Per-account ledger balances for a tenancy (computed from postings)' })
  async getLedger(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AccountBalanceDto[]> {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.ledger.getTenancyBalances(landlordId, tenancyId);
  }

  @Get('arrears')
  @ApiOperation({ summary: 'Arrears ageing (0–30 / 31–60 / 61–90 / 90+) for a tenancy' })
  @ApiQuery({ name: 'asOf', required: false, description: 'ISO date; defaults to today' })
  async getArrears(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user: AuthUser,
    @Query('asOf') asOf?: string,
  ): Promise<ArrearsAgeingDto> {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.ledger.getArrears(landlordId, tenancyId, asOf ? new Date(asOf) : new Date());
  }
}
