import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { HouseRulesController } from './house-rules.controller';
import { HouseRulesService } from './house-rules.service';

@Module({
  imports: [RbacModule, AuditModule, TenancyModule],
  controllers: [HouseRulesController],
  providers: [HouseRulesService],
  exports: [HouseRulesService],
})
export class HouseRulesModule {}
