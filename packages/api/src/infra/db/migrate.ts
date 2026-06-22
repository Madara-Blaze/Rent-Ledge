/**
 * Minimal forward-only migration runner. Applies every *.sql file in ./migrations
 * in lexical order inside a transaction, recording applied files in _migrations.
 * Pass --reset to drop and recreate the public schema first (DEV ONLY).
 *
 *   pnpm db:migrate           # apply pending migrations
 *   pnpm db:migrate --reset   # wipe + reapply (development)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { databaseUrl, loadEnv } from './client';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function main(): Promise<void> {
  loadEnv();
  const reset = process.argv.includes('--reset');
  const pool = new Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  try {
    if (reset) {
      await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
      console.log('• reset: dropped and recreated schema "public"');
    }

    await client.query(
      'CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (rows.length > 0) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`• apply  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
