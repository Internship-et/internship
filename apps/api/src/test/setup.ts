// ─────────────────────────────────────────────────────────────
// Test Database Setup/Teardown
// Provides database lifecycle helpers for repository tests.
// - getPrisma(): Returns a shared PrismaClient connected to the test DB
// - truncateAllTables(): Clears all user tables without dropping migrations
// - disconnectPrisma(): Cleanly disconnects the Prisma client
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Cannot create test Prisma client.');
}

let _prisma: PrismaClient | null = null;

/**
 * Returns a shared PrismaClient instance connected to the test database.
 * Creates the client on first call; reuses it thereafter.
 */
export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    });
  }
  return _prisma;
}

/**
 * Truncates all public database tables and resets their identity sequences.
 * Excludes the `_prisma_migrations` table so migration state persists.
 * MUST be called wrapped in a transaction because TRUNCATE cannot run
 * inside Prisma's interactive transaction (DDL).
 *
 * Call this in `beforeEach()` or `beforeAll()` of repository test suites
 * that need a clean slate.
 */
export async function truncateAllTables(): Promise<void> {
  const prisma = getPrisma();

  // Use raw SQL to list all user tables (exclude Prisma's migration tracking)
  const tableNames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`;

  if (tableNames.length === 0) {
    return;
  }

  // Build a single TRUNCATE statement that handles FK dependencies via CASCADE
  const tables = tableNames.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Disconnects the shared PrismaClient if it exists.
 * Call this in `afterAll()` of the top-level test suite.
 */
export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
