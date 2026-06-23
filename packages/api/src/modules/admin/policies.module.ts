import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [RbacModule],
  controllers: [PoliciesController],
  providers: [PoliciesService],
})
export class PoliciesAdminModule {}
