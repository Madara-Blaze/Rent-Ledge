import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES } from '../rbac/roles';
import { PaymentDto, RecordPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly svc: PaymentsService,
    private readonly access: AccessService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a payment (manual or gateway), allocate to invoices, post to ledger' })
  async record(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthUser): Promise<PaymentDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.recordPayment(dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound gateway webhook (no auth; verified by signature, idempotent on event id)' })
  webhook(
    @Body() body: unknown,
    @Headers('x-webhook-signature') signature?: string,
  ): Promise<{ received: boolean; paymentId?: string }> {
    // A live integration verifies the signature against the RAW request body.
    return this.svc.handleWebhook(JSON.stringify(body), signature);
  }
}
