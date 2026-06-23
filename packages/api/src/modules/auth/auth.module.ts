import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [RbacModule],
  controllers: [AuthController],
  providers: [AuthService, UsersRepository],
  exports: [AuthService, UsersRepository],
})
export class AuthModule {}
