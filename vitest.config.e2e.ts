import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Node.js loads graphql's CommonJS build for @nestjs/graphql and Apollo Server; without this,
    // Vite would give the tested code its ES module build, a second copy that rejects the schema.
    alias: [{ find: /^graphql$/, replacement: 'graphql/index.js' }],
  },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // The files share one test database, which each one empties first.
    fileParallelism: false,
    env: {
      // Validated at startup; the tests replace the connection with their own.
      DATABASE_URL: 'postgres://unused-in-tests',
      JWT_SECRET: 'test-only-jwt-secret-of-at-least-32-bytes',
    },
  },
});
