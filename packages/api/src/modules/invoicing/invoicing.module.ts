import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PolicyModule } from '../policy/policy.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';

@Module({
  imports: [LedgerModule, PolicyModule, TenancyModule, RbacModule],
  controllers: [InvoicingController],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
