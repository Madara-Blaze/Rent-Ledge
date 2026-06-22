import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: { userId: string };
}

/**
 * Simple in-memory fixed-window rate limiter, keyed by user id (or IP for
 * unauthenticated routes). Swap for a Redis-backed limiter in production.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly windowMs = 60_000;
  private readonly max = 300;

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestLike>();
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip ?? 'anon';
    const key = req.user?.userId ?? ip;
    const now = Date.now();

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    if (entry.count > this.max) {
      throw new HttpException('Rate limit exceeded — try again shortly', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
