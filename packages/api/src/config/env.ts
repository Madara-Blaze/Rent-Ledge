import { z } from 'zod';

/** Validated environment. Fail fast at boot if misconfigured. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .default('postgresql://rentledger:rentledger@localhost:5432/rentledger'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  FIELD_ENCRYPTION_KEY: z.string().default('dev-field-encryption-key-change-me'),

  DEFAULT_JURISDICTION: z.string().default('IN'),
  DEFAULT_CURRENCY: z.string().default('INR'),
  DEFAULT_LOCALE: z.string().default('en-IN'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw);
}
