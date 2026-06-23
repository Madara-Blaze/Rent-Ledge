import { z } from 'zod';

// SECURITY: known dev/example secret values that must never reach production.
const FORBIDDEN_PROD_SECRETS = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'dev-field-encryption-key-change-me',
  'Y2hhbmdlLW1lLXRoaXMtaXMtbm90LWEtcmVhbC1rZXkhIQ==', // .env.example placeholder
  'change-me',
  'changeme',
  'secret',
]);

function looksWeak(value: string): boolean {
  return FORBIDDEN_PROD_SECRETS.has(value) || /change[-_]?me/i.test(value);
}

/** Validated environment. Fail fast (and fail closed) at boot if misconfigured. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().default('postgresql://rentledger:rentledger@localhost:5432/rentledger'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

    JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-me'),
    JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
    FIELD_ENCRYPTION_KEY: z.string().default('dev-field-encryption-key-change-me'),

    // Optional knobs for hardened deployments.
    ALLOW_SEED: z.string().optional(),

    DEFAULT_JURISDICTION: z.string().default('IN'),
    DEFAULT_CURRENCY: z.string().default('INR'),
    DEFAULT_LOCALE: z.string().default('en-IN'),
    DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  })
  // SECURITY (§1.4): in production, refuse to boot with missing/weak/default secrets,
  // identical access+refresh secrets, or a database connection that doesn't require TLS.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FIELD_ENCRYPTION_KEY'] as const) {
      const value = env[key];
      if (looksWeak(value)) fail(key, `${key} must not be a default/example value in production`);
      if (value.length < 32) fail(key, `${key} must be at least 32 characters of high entropy in production`);
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      fail('JWT_REFRESH_SECRET', 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
    }
    const tlsOk = /sslmode=(require|verify-ca|verify-full)/.test(env.DATABASE_URL) || /supabase\.(co|com|net)/.test(env.DATABASE_URL);
    if (!tlsOk) {
      fail('DATABASE_URL', 'DATABASE_URL must require TLS in production (append ?sslmode=require, ideally verify-full)');
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw);
}
