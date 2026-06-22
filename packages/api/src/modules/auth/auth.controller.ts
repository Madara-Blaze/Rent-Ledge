import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import {
  AcceptInvitationDto,
  AuthResponseDto,
  LoginDto,
  RefreshDto,
  RequestOtpDto,
  SetPanDto,
  SignupDto,
  VerifyOtpDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Create an account; sets up an owner workspace' })
  signup(
    @Body() dto: SignupDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.signup(dto, { userAgent: ua, ip });
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Password login' })
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.login(dto, { userAgent: ua, ip });
  }

  @Public()
  @Post('otp/request')
  @ApiOperation({ summary: 'Request a one-time login code (mock delivery in dev)' })
  requestOtp(@Body() dto: RequestOtpDto): Promise<{ sent: boolean; devCode?: string }> {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify a one-time code and sign in' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.verifyOtp(dto, { userAgent: ua, ip });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair (rotating)' })
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken, { userAgent: ua, ip });
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() dto: RefreshDto): Promise<{ loggedOut: boolean }> {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post('invitations/accept')
  @ApiOperation({ summary: 'Claim a tenant invitation and sign in' })
  acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.acceptInvitation(dto, { userAgent: ua, ip });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user, workspaces and tenant tenancies' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  @Post('kyc/pan')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Capture & encrypt the PAN for TDS (KYC)' })
  setPan(@CurrentUser() user: AuthUser, @Body() dto: SetPanDto) {
    return this.auth.setPan(user.userId, dto.pan);
  }
}
