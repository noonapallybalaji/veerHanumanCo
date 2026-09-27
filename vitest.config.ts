import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Every suite shares the one Postgres test database and truncates tables
    // between cases, so they must not run concurrently.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: ['server/tests/global-setup.ts'],
    // Runs before each test module is imported, so the server reads the test
    // configuration rather than .env. Import hoisting makes doing this inside
    // a test file too late.
    setupFiles: ['server/tests/setup-env.ts'],
  },
})
