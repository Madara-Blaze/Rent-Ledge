import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  url?: string;
  originalUrl?: string;
  user?: { userId: string };
}

interface Bucket {
  name: string;
  windowMs: number;
  max: number;
  byIp: boolean; // key by IP (true) or by user/IP (false)
  test: (path: string) => boolean;
}

// SECURITY (§6/§7): layered rate limits — a generous global ceiling plus much
// tighter buckets on auth, OTP, money-moving and expensive export endpoints.
// In-memory + fixed-window: fine for a single instance / defense-in-depth. A
// production deployment MUST also rate-limit at the edge (CDN/WAF) and/or move
// this to a shared Redis store so limits hold across instances. See SECURITY.md.
const BUCKETS: Bucket[] = [
  { name: 'auth', windowMs: 60_000, max: 10, byIp: true, test: (p) => /\/auth\/(login|signup|otp\/(request|verify)|invitations\/accept|refresh)/.test(p) },
  { name: 'payments', windowMs: 60_000, max: 30, byIp: false, test: (p) => /\/payments(\/|$)/.test(p) },
  { name: 'exports', windowMs: 60_000, max: 10, byIp: false, test: (p) => /(ca-pack|data-export|evidence\/bundle|reports\/)/.test(p) },
];
const DEFAULT_BUCKET: Bucket = { name: 'global', windowMs: 60_000, max: 300, byIp: false, test: () => true };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestLike>();
    const path = req.originalUrl ?? req.url ?? '';
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() ?? req.ip ?? 'anon';

    const bucket = BUCKETS.find((b) => b.test(path)) ?? DEFAULT_BUCKET;
    const principal = bucket.byIp ? ip : (req.user?.userId ?? ip);
    const key = `${bucket.name}:${principal}`;
    const now = Date.now();

    this.sweep(now);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + bucket.windowMs });
      return true;
    }
    entry.count += 1;
    if (entry.count > bucket.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message: 'Rate limit exceeded — slow down', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  // Opportunistic cleanup so the map can't grow unbounded.
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, v] of this.hits) if (v.resetAt < now) this.hits.delete(k);
  }
}
