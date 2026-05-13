// ─────────────────────────────────────────────────────────────
// Vitest Configuration — @internship/api
// Provides test runner settings for the API workspace.
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Use Node.js environment (no browser/DOM)
    environment: 'node',

    // Global test timeout (10 seconds for integration tests)
    testTimeout: 10_000,

    // Include all test files in __tests__ directories
    include: ['src/**/__tests__/**/*.test.ts'],

    // Exclude build output and node_modules
    exclude: ['node_modules', 'dist'],

    // Verbose reporter for CI clarity
    reporters: ['verbose'],

    // Ensure isolated environment per file
    globals: false,

    // Global setup runs once before all tests (applies migrations to test DB)
    globalSetup: ['src/test/global-setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/test/**',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/server.ts',
      ],
      reporters: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },

    // Set required env vars before tests run
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-for-testing-32chars-minimum!!',
      LOG_LEVEL: 'silent',
      CORS_ORIGIN: '*',
    },

    // Repository tests share the same test database and must not run concurrently
    // to avoid race conditions during truncation between test files.
    // fileParallelism: false ensures all test files run serially in a single process
    // against the same database, preventing cross-file data races.
    fileParallelism: false,
  },

  // Resolve @/ path alias to src/ (matching tsconfig paths)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
