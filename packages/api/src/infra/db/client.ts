import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from './schema';

export type Db = NodePgDatabase<typeof schema>;

export function createPool(connectionString: string): Pool {
  // Supabase (and any sslmode=require URL) requires TLS. node-postgres does not
  // reliably infer SSL from the URL alone, so enable it explicitly when the
  // target looks like a TLS/Supabase endpoint; localhost stays plaintext for dev.
  // SECURITY: rejectUnauthorized:false trusts the pooler cert without chain
  // verification — for full hardening, pin Supabase's CA and set it to true.
  const wantsTls =
    /sslmode=(require|verify-ca|verify-full)/.test(connectionString) ||
    /supabase\.(co|com|net)/.test(connectionString);
  return new Pool({
    connectionString,
    ...(wantsTls ? { ssl: { rejectUnauthorized: false } } : {}),
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema });
}

/**
 * Best-effort .env loader for standalone scripts (migrate/seed). The Nest app
 * uses @nestjs/config instead. Node 20+ provides process.loadEnvFile.
 */
export function loadEnv(): void {
  const candidates = ['.env', '../../.env', '../../../.env'];
  const loader = (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void }).loadEnvFile;
  if (!loader) return;
  for (const path of candidates) {
    try {
      loader.call(process, path);
      return;
    } catch {
      // try next candidate
    }
  }
}

export function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ?? 'postgresql://rentledger:rentledger@localhost:5432/rentledger'
  );
}
