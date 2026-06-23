import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PolicyModule } from '../policy/policy.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [RbacModule, AuditModule, PolicyModule, TenancyModule, EvidenceModule, NotificationsModule],
  controllers: [NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
