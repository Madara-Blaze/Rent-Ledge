import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from './schema';

export type Db = NodePgDatabase<typeof schema>;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
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
