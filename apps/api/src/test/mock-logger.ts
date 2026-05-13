// ─────────────────────────────────────────────────────────────
// Mock Logger
// A shared mock logger for use across all test files.
// Prevents log noise during test runs and enables assertion on log calls.
// ─────────────────────────────────────────────────────────────

import { vi } from 'vitest';

/**
 * Creates a mock logger object with all standard pino methods.
 * Each method is a `vi.fn()` that spies on calls.
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(() => createMockLogger()),
    level: 'silent',
  };
}
