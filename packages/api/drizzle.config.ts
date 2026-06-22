import { defineConfig } from 'drizzle-kit';

// drizzle-kit is available for future schema codegen / diffing.
// The authoritative initial migration is hand-written SQL in src/infra/db/migrations
// because the ledger requires append-only triggers and balance constraints that
// the diff engine does not generate.
export default defineConfig({
  schema: './src/infra/db/schema.ts',
  out: './src/infra/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://rentledger:rentledger@localhost:5432/rentledger',
  },
});
