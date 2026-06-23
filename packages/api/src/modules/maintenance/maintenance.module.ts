import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [RbacModule, AuditModule, LedgerModule, TenancyModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
