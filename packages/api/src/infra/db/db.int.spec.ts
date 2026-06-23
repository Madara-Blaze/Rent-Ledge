import { describe, expect, it } from 'vitest';

/**
 * DB integration tests. They only run when DATABASE_URL is set (e.g. CI with a
 * Postgres service), and are skipped otherwise so the unit suite stays green
 * without a database. Run migrations first: `pnpm db:migrate`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

suite('DB integration (requires DATABASE_URL)', () => {
  it('connects and the append-only ledger trigger blocks updates', async () => {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const ping = await pool.query('SELECT 1 AS one');
      expect(ping.rows[0].one).toBe(1);

      // If the schema is migrated, journal_entries must reject UPDATE.
      const exists = await pool.query(
        `SELECT to_regclass('public.journal_entries') AS t`,
      );
      if (exists.rows[0].t) {
        await expect(
          pool.query(`UPDATE journal_entries SET description = 'x' WHERE false`),
        ).rejects.toBeTruthy();
      }
    } finally {
      await pool.end();
    }
  });
});
