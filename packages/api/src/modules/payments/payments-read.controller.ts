import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsReadController {
  constructor(
    private readonly svc: PaymentsService,
    private readonly access: AccessService,
  ) {}

  @Get('tenancies/:tenancyId/payments')
  @ApiOperation({ summary: 'Payment history for a tenancy (tenant-visible)' })
  async history(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.listPayments(tenancyId);
  }

  @Get('payments/:paymentId/receipt.pdf')
  @ApiOperation({ summary: 'Download an HRA-ready rent receipt (PDF)' })
  async receipt(@Param('paymentId') paymentId: string, @CurrentUser() user: AuthUser): Promise<StreamableFile> {
    const pay = await this.svc.getPaymentRow(paymentId);
    await this.access.assertTenancyAccess(user.userId, pay.tenancyId, READ_ROLES_WITH_TENANT);
    const { bytes, fileName } = await this.svc.buildReceipt(paymentId);
    return new StreamableFile(bytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
      length: bytes.length,
    });
  }
}
