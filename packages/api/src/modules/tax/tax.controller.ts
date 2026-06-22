import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { TaxService } from './tax.service';
import { TdsPreviewDto } from './tax.dto';

@ApiTags('Tax')
@ApiBearerAuth()
@Controller('tax')
export class TaxController {
  constructor(
    private readonly svc: TaxService,
    private readonly access: AccessService,
  ) {}

  @Get('tds/preview')
  @ApiOperation({ summary: 'Preview TDS (194-IB / 194-I) for a tenancy on a given date' })
  @ApiQuery({ name: 'tenancyId', required: true })
  @ApiQuery({ name: 'annualRentMinor', required: false, description: 'Defaults to monthly rent × 12' })
  @ApiQuery({ name: 'asOf', required: false, description: 'ISO date; drives section-code mapping' })
  async preview(
    @CurrentUser() user: AuthUser,
    @Query('tenancyId') tenancyId: string,
    @Query('annualRentMinor') annualRentMinor?: string,
    @Query('asOf') asOf?: string,
  ): Promise<TdsPreviewDto> {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.previewTds(tenancyId, annualRentMinor, asOf);
  }
}
