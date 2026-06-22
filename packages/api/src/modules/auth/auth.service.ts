import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { encryptField } from '../../common/crypto/field-encryption';
import { signJwt } from '../../common/crypto/jwt';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { isValidPan, normalizePan, numericOtp, panLast4, randomToken, sha256 } from '../../common/crypto/tokens';
import { PG_POOL } from '../../infra/db/db.module';
import { AccessService } from '../rbac/access.service';
import { Role, ScopeType } from '../rbac/roles';
import {
  AcceptInvitationDto,
  AuthResponseDto,
  LoginDto,
  RequestOtpDto,
  SignupDto,
  UserDto,
  VerifyOtpDto,
} from './auth.dto';
import { UserRow, UsersRepository } from './users.repository';

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
    private readonly access: AccessService,
  ) {}

  async signup(dto: SignupDto, meta?: RequestMeta): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) throw new BadRequestException('Provide an email or phone number');
    const existing = await this.users.findByIdentifier(dto.email ?? dto.phone!);
    if (existing) throw new ConflictException('An account with these details already exists');

    const user = await this.users.create({
      name: dto.name,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      passwordHash: hashPassword(dto.password),
    });

    const landlordId = await this.createWorkspace(
      user.id,
      dto.workspaceName ?? `${dto.name}'s properties`,
      user.email,
    );

    const tokens = await this.issueTokens(user.id, meta);
    return { ...tokens, user: this.toUserDto(user), landlordId };
  }

  async login(dto: LoginDto, meta?: RequestMeta): Promise<AuthResponseDto> {
    const user = await this.users.findByIdentifier(dto.identifier);
    if (!user || !user.passwordHash || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens(user.id, meta);
    return { ...tokens, user: this.toUserDto(user) };
  }

  async requestOtp(dto: RequestOtpDto): Promise<{ sent: boolean; devCode?: string }> {
    const code = numericOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.pool.query(
      `INSERT INTO otp_codes (identifier, code_hash, purpose, expires_at) VALUES ($1, $2, 'LOGIN', $3)`,
      [dto.identifier, sha256(code), expiresAt],
    );
    // Production: dispatch via the SMS/email adapter. Dev/sandbox: surface the code.
    this.logger.log(`OTP for ${dto.identifier}: ${code}`);
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return isProd ? { sent: true } : { sent: true, devCode: code };
  }

  async verifyOtp(dto: VerifyOtpDto, meta?: RequestMeta): Promise<AuthResponseDto> {
    const { rows } = await this.pool.query<{
      id: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
    }>(
      `SELECT id, code_hash, expires_at, consumed_at FROM otp_codes
        WHERE identifier = $1 AND purpose = 'LOGIN' ORDER BY created_at DESC LIMIT 1`,
      [dto.identifier],
    );
    const otp = rows[0];
    if (
      !otp ||
      otp.consumed_at ||
      new Date(otp.expires_at) < new Date() ||
      otp.code_hash !== sha256(dto.code)
    ) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.pool.query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [otp.id]);

    let user = await this.users.findByIdentifier(dto.identifier);
    if (!user) {
      const isEmail = dto.identifier.includes('@');
      user = await this.users.create({
        name: dto.identifier,
        email: isEmail ? dto.identifier : null,
        phone: isEmail ? null : dto.identifier,
        passwordHash: null,
      });
    }
    const tokens = await this.issueTokens(user.id, meta);
    return { ...tokens, user: this.toUserDto(user) };
  }

  async refresh(refreshToken: string, meta?: RequestMeta): Promise<AuthResponseDto> {
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>(`SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE refresh_token_hash = $1`, [
      sha256(refreshToken),
    ]);
    const session = rows[0];
    if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // rotate: revoke the presented token, issue a fresh pair
    await this.pool.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [session.id]);
    const tokens = await this.issueTokens(session.user_id, meta);
    const user = await this.users.findById(session.user_id);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return { ...tokens, user: this.toUserDto(user) };
  }

  async logout(refreshToken: string): Promise<{ loggedOut: boolean }> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [sha256(refreshToken)],
    );
    return { loggedOut: true };
  }

  async me(userId: string): Promise<{
    user: UserDto;
    workspaces: Array<{ landlordId: string; name: string; roles: string[] }>;
    tenancies: Array<{ tenancyId: string; status: string; propertyName: string }>;
  }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const ws = await this.pool.query<{ landlord_id: string; name: string; roles: string[] }>(
      `SELECT l.id AS landlord_id, l.name, array_agg(ra.role) AS roles
         FROM role_assignments ra JOIN landlords l ON l.id = ra.scope_id
        WHERE ra.user_id = $1 AND ra.scope_type = 'LANDLORD'
        GROUP BY l.id, l.name`,
      [userId],
    );
    const tn = await this.pool.query<{ tenancy_id: string; status: string; property_name: string }>(
      `SELECT t.id AS tenancy_id, t.status, p.name AS property_name
         FROM role_assignments ra
         JOIN tenancies t ON t.id = ra.scope_id
         JOIN properties p ON p.id = t.property_id
        WHERE ra.user_id = $1 AND ra.scope_type = 'TENANCY' AND ra.role = 'TENANT'`,
      [userId],
    );

    return {
      user: this.toUserDto(user),
      workspaces: ws.rows.map((r) => ({ landlordId: r.landlord_id, name: r.name, roles: r.roles })),
      tenancies: tn.rows.map((r) => ({
        tenancyId: r.tenancy_id,
        status: r.status,
        propertyName: r.property_name,
      })),
    };
  }

  async setPan(userId: string, pan: string): Promise<{ panValid: boolean; panLast4: string }> {
    if (!isValidPan(pan)) throw new BadRequestException('Invalid PAN format (expected AAAAA9999A)');
    const encrypted = encryptField(normalizePan(pan), this.config.getOrThrow<string>('FIELD_ENCRYPTION_KEY'));
    await this.users.setPan(userId, encrypted, panLast4(pan));
    return { panValid: true, panLast4: panLast4(pan) };
  }

  async acceptInvitation(dto: AcceptInvitationDto, meta?: RequestMeta): Promise<AuthResponseDto> {
    const { rows } = await this.pool.query<{
      id: string;
      tenancy_id: string | null;
      email: string | null;
      phone: string | null;
      status: string;
      expires_at: string;
      invited_by: string | null;
    }>(`SELECT id, tenancy_id, email, phone, status, expires_at, invited_by FROM tenant_invitations WHERE token_hash = $1`, [
      sha256(dto.token),
    ]);
    const inv = rows[0];
    if (!inv || inv.status !== 'PENDING' || new Date(inv.expires_at) < new Date()) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const identifier = inv.email ?? inv.phone;
    let user = identifier ? await this.users.findByIdentifier(identifier) : null;
    if (!user) {
      user = await this.users.create({
        name: dto.name ?? identifier ?? 'Tenant',
        email: inv.email,
        phone: inv.phone,
        passwordHash: dto.password ? hashPassword(dto.password) : null,
      });
    }

    if (inv.tenancy_id) {
      await this.pool.query(
        `UPDATE tenants SET user_id = $1 WHERE id = (SELECT primary_tenant_id FROM tenancies WHERE id = $2)`,
        [user.id, inv.tenancy_id],
      );
      await this.access.grant({
        userId: user.id,
        role: Role.TENANT,
        scopeType: ScopeType.TENANCY,
        scopeId: inv.tenancy_id,
        grantedBy: inv.invited_by,
      });
    }
    await this.pool.query(
      `UPDATE tenant_invitations SET status = 'ACCEPTED', accepted_user_id = $1 WHERE id = $2`,
      [user.id, inv.id],
    );

    const tokens = await this.issueTokens(user.id, meta);
    return { ...tokens, user: this.toUserDto(user) };
  }

  // --- internals -----------------------------------------------------------

  private async createWorkspace(ownerUserId: string, name: string, email: string | null): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO landlords (name, email, owner_user_id, jurisdiction) VALUES ($1, $2, $3, 'IN') RETURNING id`,
      [name, email, ownerUserId],
    );
    const landlordId = rows[0].id;
    await this.access.grant({
      userId: ownerUserId,
      role: Role.OWNER,
      scopeType: ScopeType.LANDLORD,
      scopeId: landlordId,
      grantedBy: ownerUserId,
    });
    return landlordId;
  }

  private async issueTokens(
    userId: string,
    meta?: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; tokenType: string; expiresIn: number }> {
    const accessTtl = Number(this.config.get<number>('JWT_ACCESS_TTL') ?? 900);
    const refreshTtl = Number(this.config.get<number>('JWT_REFRESH_TTL') ?? 2_592_000);
    const accessToken = signJwt({ sub: userId }, this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), accessTtl);
    const refreshToken = randomToken(32);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.pool.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [userId, sha256(refreshToken), meta?.userAgent ?? null, meta?.ip ?? null, expiresAt],
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessTtl };
  }

  private toUserDto(user: UserRow): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      panLast4: user.panLast4,
      panValid: user.panValid,
      status: user.status,
    };
  }
}
