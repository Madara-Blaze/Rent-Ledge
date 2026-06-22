import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PolicyModule } from '../policy/policy.module';
import { RbacModule } from '../rbac/rbac.module';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { ESIGN_PROVIDER } from './esign.adapter';
import { IndiaStampDutyProvider } from './mock-stamp-duty.adapter';
import { MockESignProvider } from './mock-esign.adapter';
import { STAMP_DUTY_PROVIDER } from './stamp-duty.adapter';

@Module({
  imports: [RbacModule, AuditModule, PolicyModule],
  controllers: [AgreementsController],
  providers: [
    AgreementsService,
    // Swap these for live providers (Aadhaar eSign / e-stamp) in production.
    { provide: ESIGN_PROVIDER, useClass: MockESignProvider },
    { provide: STAMP_DUTY_PROVIDER, useClass: IndiaStampDutyProvider },
  ],
  exports: [AgreementsService],
})
export class AgreementsModule {}
