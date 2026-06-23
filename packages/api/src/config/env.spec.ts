import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

// SECURITY (§1.4): boot-time secret validation must fail closed in production.
const STRONG_A = 'a'.repeat(40);
const STRONG_B = 'b'.repeat(40);

describe('validateEnv — production secret hardening', () => {
  it('accepts development defaults (dev convenience)', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('rejects default/example secrets in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
        FIELD_ENCRYPTION_KEY: 'dev-field-encryption-key-change-me',
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x?sslmode=require',
      }),
    ).toThrow();
  });

  it('rejects short / low-entropy secrets in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short',
        JWT_REFRESH_SECRET: STRONG_B,
        FIELD_ENCRYPTION_KEY: STRONG_A,
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x?sslmode=require',
      }),
    ).toThrow();
  });

  it('rejects identical access and refresh secrets in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: STRONG_A,
        JWT_REFRESH_SECRET: STRONG_A,
        FIELD_ENCRYPTION_KEY: STRONG_B,
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x?sslmode=require',
      }),
    ).toThrow();
  });

  it('rejects a database URL without TLS in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: STRONG_A,
        JWT_REFRESH_SECRET: STRONG_B,
        FIELD_ENCRYPTION_KEY: 'c'.repeat(40),
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x',
      }),
    ).toThrow();
  });

  it('accepts strong, distinct secrets with TLS in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: STRONG_A,
        JWT_REFRESH_SECRET: STRONG_B,
        FIELD_ENCRYPTION_KEY: 'c'.repeat(40),
        DATABASE_URL: 'postgresql://u:p@db.supabase.co:5432/postgres?sslmode=require',
      }),
    ).not.toThrow();
  });
});
