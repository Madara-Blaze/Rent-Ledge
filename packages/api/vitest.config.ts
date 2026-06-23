import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Domain/rule-engine tests are pure TypeScript and run without a database.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@infra': resolve(__dirname, 'src/infra'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@common': resolve(__dirname, 'src/common'),
    },
  },
});
