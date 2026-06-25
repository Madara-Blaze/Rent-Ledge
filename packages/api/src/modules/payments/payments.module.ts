import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { MockPaymentGateway } from './mock-gateway.adapter';
import { PAYMENT_GATEWAY } from './payment-gateway.adapter';
import { PaymentsController } from './payments.controller';
import { PaymentsReadController } from './payments-read.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [LedgerModule, TenancyModule, RbacModule],
  controllers: [PaymentsController, PaymentsReadController],
  providers: [
    PaymentsService,
    // Swap MockPaymentGateway for a live adapter (Razorpay/Stripe) to go to production.
    { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
