import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

interface AuditReq {
  method: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { userId: string };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Blanket who/what/when/where trail for every state-changing request. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuditReq>();
    if (!MUTATING.has(req.method)) return next.handle();

    const path = req.originalUrl ?? req.url ?? '';
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip ?? null;

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          actorUserId: req.user?.userId ?? null,
          action: `${req.method} ${path}`,
          ip,
        });
      }),
    );
  }
}
