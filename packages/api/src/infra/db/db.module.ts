import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { createDb, createPool, type Db } from './client';

/** DI tokens for the raw pg Pool (aggregate reads) and the Drizzle client (writes). */
export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE = Symbol('DRIZZLE');

export type { Db };

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createPool(config.getOrThrow<string>('DATABASE_URL')),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => createDb(pool),
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DbModule {}
