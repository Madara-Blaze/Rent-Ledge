import { Module } from '@nestjs/common';
import { TenancyRepository } from './tenancy.repository';

@Module({
  providers: [TenancyRepository],
  exports: [TenancyRepository],
})
export class TenancyModule {}
