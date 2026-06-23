import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { DpdpService } from './dpdp.service';

class SetConsentDto {
  @IsString() purpose!: string;
  @IsOptional() @IsBoolean() granted?: boolean;
}
class ErasureDto {
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('Privacy (DPDP)')
@ApiBearerAuth()
@Controller('me')
export class DpdpController {
  constructor(private readonly svc: DpdpService) {}

  @Post('consents')
  @ApiOperation({ summary: 'Grant or withdraw consent for a purpose' })
  setConsent(@CurrentUser() user: AuthUser, @Body() dto: SetConsentDto) {
    return this.svc.setConsent(user.userId, dto.purpose, dto.granted ?? true);
  }

  @Get('consents')
  listConsents(@CurrentUser() user: AuthUser) {
    return this.svc.listConsents(user.userId);
  }

  @Get('data-export')
  @ApiOperation({ summary: 'Right to access — export all data held about you' })
  exportData(@CurrentUser() user: AuthUser) {
    return this.svc.exportData(user.userId);
  }

  @Post('erasure-request')
  @ApiOperation({ summary: 'Right to erasure — request deletion (subject to legal retention)' })
  requestErasure(@CurrentUser() user: AuthUser, @Body() dto: ErasureDto) {
    return this.svc.requestErasure(user.userId, dto.reason);
  }

  @Get('requests')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.svc.listRequests(user.userId);
  }
}
