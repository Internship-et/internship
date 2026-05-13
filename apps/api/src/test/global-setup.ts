// ─────────────────────────────────────────────────────────────
// Global Test Setup
// Runs ONCE per test session before any test files execute.
// Applies existing Prisma migrations to the test database.
// Does NOT create new migrations — only deploys existing ones.
// ─────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the project root (apps/api/) from this file's location. */
const PROJECT_ROOT = resolve(__dirname, '../..');

/**
 * Default test database URL.
 * globalSetup runs in a separate process from vitest test workers,
 * so the `env` config in vitest.config.ts does not apply here.
 * The user can override with DATABASE_URL env var at runtime.
 */
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://test:test@localhost:5433/test';

export async function setup(): Promise<void> {
  const migrationsDir = resolve(PROJECT_ROOT, 'prisma/migrations');

  if (!existsSync(migrationsDir)) {
    console.error('❌ No migrations directory found at', migrationsDir);
    process.exit(1);
  }

  const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

  if (!DATABASE_URL.includes('test')) {
    console.error(
      '❌ DATABASE_URL must point to a test database (URL must contain "test").\n' +
        `   Got: ${DATABASE_URL}`,
    );
    process.exit(1);
  }

  console.log('📦 Applying Prisma migrations to test database...');
  console.log(`   URL: ${DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@')}`);

  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL },
      stdio: 'pipe',
      cwd: PROJECT_ROOT,
    });
    console.log('✅ Migrations applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

export async function teardown(): Promise<void> {
  // No global teardown needed — the test-db container persists
  // across multiple test sessions during development.
  // Use `docker compose down` to destroy it.
  console.log('✅ Test session complete');
}
