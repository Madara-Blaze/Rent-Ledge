import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DpdpController } from './dpdp.controller';
import { DpdpService } from './dpdp.service';

@Module({
  imports: [AuditModule],
  controllers: [DpdpController],
  providers: [DpdpService],
})
export class DpdpModule {}
