// ─────────────────────────────────────────────────────────────
// Shared Test Constants
// Provides consistent UUIDs and test constants across all test files.
// Reduces duplication and ensures deterministic test data.
// ─────────────────────────────────────────────────────────────

// ─── UUIDs ─────────────────────────────────────────────────

export const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const SECONDARY_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
export const ADMIN_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
export const OTHER_USER_UUID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
export const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
export const COMPANY_UUID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
export const STUDENT_UUID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
export const SCHOOL_UUID = 'a7b8c9d0-e1f2-3456-abcd-567890123456';

// ─── Emails ────────────────────────────────────────────────

export const TEST_EMAIL = 'test@example.com';
export const SECONDARY_EMAIL = 'other@example.com';
export const ADMIN_EMAIL = 'admin@example.com';

// ─── Token ─────────────────────────────────────────────────

export const VALID_ACCESS_TOKEN = 'valid-access-token';
export const VALID_REFRESH_TOKEN = 'valid-refresh-token';
export const EXPIRED_TOKEN = 'expired-token';
export const INVALID_TOKEN = 'invalid-token';
export const RESET_TOKEN = 'reset-token-value';

// ─── Redis keys ────────────────────────────────────────────

export const MOCK_REDIS_SESSION_DATA = JSON.stringify({
  userId: VALID_UUID,
  role: 'STUDENT',
  createdAt: '2025-01-01T00:00:00.000Z',
});
