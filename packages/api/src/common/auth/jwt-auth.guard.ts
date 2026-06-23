import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyJwt } from '../crypto/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  user?: { userId: string };
}

/** Global guard: requires a valid access JWT unless the route is @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestLike>();
    const raw = req.headers['authorization'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = verifyJwt(header.slice(7), this.config.getOrThrow<string>('JWT_ACCESS_SECRET'));
      req.user = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
