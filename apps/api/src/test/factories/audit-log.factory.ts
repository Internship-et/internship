// ─────────────────────────────────────────────────────────────
// Audit Log Factory
// Creates AuditLog records in the test database.
// Requires an existing User (creator of the action).
// Each call generates unique entity IDs and timestamps.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestUser } from './user.factory.js';
import type { Prisma } from '../../generated/prisma/client.js';

let _counter = 0;

/**
 * Input for creating a test audit log entry.
 */
export interface CreateTestAuditLogInput {
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Creates an AuditLog record in the test database.
 * Also creates a parent User if no userId provided.
 *
 * @param overrides - Optional fields to customize the audit log.
 * @returns The created audit log entry with user relation.
 */
export async function createTestAuditLog(
  overrides: CreateTestAuditLogInput = {},
) {
  _counter++;
  const suffix = _counter;

  // Create or use provided User
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser({ role: 'ADMIN' });
    userId = user.id;
  }

  return getPrisma().auditLog.create({
    data: {
      userId,
      action: overrides.action ?? 'STATUS_CHANGE',
      entity: overrides.entity ?? 'USER',
      entityId: overrides.entityId ?? `entity-${suffix}`,
      oldValue: (overrides.oldValue as Prisma.InputJsonValue) ?? null,
      newValue: (overrides.newValue as Prisma.InputJsonValue) ?? null,
      ipAddress: overrides.ipAddress ?? null,
      userAgent: overrides.userAgent ?? null,
    },
    select: {
      id: true,
      userId: true,
      action: true,
      entity: true,
      entityId: true,
      oldValue: true,
      newValue: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });
}
