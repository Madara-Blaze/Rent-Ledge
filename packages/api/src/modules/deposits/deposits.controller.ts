import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import {
  CollectDepositDto,
  DeductDepositDto,
  DepositStatementDto,
  RefundDepositDto,
} from './deposits.dto';
import { DepositsService } from './deposits.service';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('deposits')
export class DepositsController {
  constructor(
    private readonly svc: DepositsService,
    private readonly access: AccessService,
  ) {}

  @Post('collect')
  @ApiOperation({ summary: 'Collect a security deposit (held as a liability)' })
  async collect(@Body() dto: CollectDepositDto, @CurrentUser() user: AuthUser): Promise<DepositStatementDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.collect(dto);
  }

  @Post('deduct')
  @ApiOperation({ summary: 'Deduct from the deposit at move-out (tied to evidence)' })
  async deduct(@Body() dto: DeductDepositDto, @CurrentUser() user: AuthUser): Promise<DepositStatementDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.deduct(dto);
  }

  @Post('refund')
  @ApiOperation({ summary: 'Refund the remaining deposit balance' })
  async refund(@Body() dto: RefundDepositDto, @CurrentUser() user: AuthUser): Promise<DepositStatementDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.refund(dto);
  }

  @Get(':tenancyId/statement')
  @ApiOperation({ summary: 'Deposit settlement statement for a tenancy' })
  async statement(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser): Promise<DepositStatementDto> {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.getStatement(tenancyId);
  }
}
