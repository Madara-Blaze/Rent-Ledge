import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiPropertyOptional({ description: 'Name for the owner workspace (defaults to "<name>\'s properties")' })
  @IsOptional()
  @IsString()
  workspaceName?: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email or phone' }) @IsString() identifier!: string;
  @ApiProperty() @IsString() password!: string;
}

export class RequestOtpDto {
  @ApiProperty({ description: 'Email or phone' }) @IsString() identifier!: string;
}

export class VerifyOtpDto {
  @ApiProperty() @IsString() identifier!: string;
  @ApiProperty() @IsString() code!: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() refreshToken!: string;
}

export class SetPanDto {
  @ApiProperty({ example: 'ABCDE1234F' }) @IsString() pan!: string;
}

export class AcceptInvitationDto {
  @ApiProperty() @IsString() token!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ minLength: 8 }) @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() panLast4?: string | null;
  @ApiProperty() panValid!: boolean;
  @ApiProperty() status!: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiPropertyOptional({ description: 'Owner workspace created on signup' }) landlordId?: string;
}
