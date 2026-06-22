import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { LedgerController } from './ledger.controller';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({
  imports: [RbacModule],
  controllers: [LedgerController],
  providers: [LedgerRepository, LedgerService],
  exports: [LedgerRepository, LedgerService],
})
export class LedgerModule {}
