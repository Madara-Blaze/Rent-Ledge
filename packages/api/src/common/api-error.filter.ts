import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface HttpRes {
  status(code: number): HttpRes;
  json(body: unknown): void;
  setHeader?(name: string, value: string): void;
}
interface HttpReq {
  headers: Record<string, string | string[] | undefined>;
}

/** Domain errors that map to client (4xx) rather than server (5xx) failures. */
const CLIENT_ERROR_STATUS: Record<string, number> = {
  InvalidMoneyError: 400,
  CurrencyMismatchError: 400,
  JournalCurrencyMismatchError: 400,
  NonPositivePostingError: 400,
  EmptyJournalEntryError: 400,
  UnbalancedJournalEntryError: 422,
  PolicyNotFoundError: 404,
  NotFoundError: 404,
  ConflictError: 409,
};

/** Uniform error envelope with a correlation id on every response. */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<HttpRes>();
    const req = ctx.getRequest<HttpReq>();

    const correlationId =
      (typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id']) ||
      randomUUID();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? message;
        details = b.details ?? b.errors;
      }
      code = httpStatusToCode(status);
    } else if (exception instanceof Error) {
      const mapped = CLIENT_ERROR_STATUS[exception.name];
      status = mapped ?? 500;
      code = mapped ? screamingCase(exception.name) : 'INTERNAL_ERROR';
      message = mapped ? exception.message : 'Internal server error';
      if (!mapped) this.logger.error(`Unhandled: ${exception.name}: ${exception.message}`, exception.stack);
    }

    res.status(status).json({ error: { code, message, details, correlationId } });
  }
}

function httpStatusToCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
  };
  return map[status] ?? 'ERROR';
}

function screamingCase(name: string): string {
  return name
    .replace(/Error$/, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
}
