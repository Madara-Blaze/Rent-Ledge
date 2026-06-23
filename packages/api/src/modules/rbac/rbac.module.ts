import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { RbacController } from './rbac.controller';

@Module({
  controllers: [RbacController],
  providers: [AccessService],
  exports: [AccessService],
})
export class RbacModule {}
