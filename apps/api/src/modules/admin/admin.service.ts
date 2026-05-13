// ─────────────────────────────────────────────────────────────
// Admin Service
// Business logic for all Admin module operations.
// Must not import Prisma directly — all DB access goes through repository.
// Must not import HTTP modules (req, res, next).
// ─────────────────────────────────────────────────────────────

import { NotFoundError, ForbiddenError } from '../../shared/errors/app-error.js';
import { buildOffsetPaginationMeta } from '../../shared/utils/pagination.js';
import * as adminRepository from './admin.repository.js';
import type {
  AdminDashboard,
  DashboardOverview,
  RecentActivity,
  PlatformMetrics,
  AdminUserListFilters,
  AdminUserListResponse,
  UserStatusUpdateResult,
  AuditLogListFilters,
  AuditLogListResponse,
  ReportType,
  ReportFormat,
  ReportResult,
  DashboardFilters,
} from './admin.types.js';

// ─── Dashboard ──────────────────────────────────────────────

/**
 * Returns the admin dashboard: overview counts, recent activity,
 * platform metrics, and user growth.
 *
 * All async queries are parallelized using Promise.all for optimal performance.
 * `applicationsPerInternship` is computed in-service from overview totals.
 * `fillRate` and `averageTimeToHire` are placeholders (see KNOWN_GAPS_REGISTER.md).
 *
 * @param filters - Optional date range filter (defaults to last 30 days).
 * @returns AdminDashboard per ADMIN_ROUTES.md shape.
 */
export async function getDashboard(filters: DashboardFilters = {}): Promise<AdminDashboard> {
  const { from, to } = filters;

  const [overviewData, metricsData, growth] = await Promise.all([
    adminRepository.getDashboardOverview(),
    adminRepository.getPlatformMetrics(from, to),
    adminRepository.getUserGrowth(from, to),
  ]);

  // Compose overview with active-user counts from platform metrics
  const overview: DashboardOverview = {
    ...overviewData,
    activeUsersToday: metricsData.activeUsersToday,
    activeUsersThisWeek: metricsData.activeUsersThisWeek,
  };

  // Recent activity — scoped to today (from platform metrics)
  const recentActivity: RecentActivity = {
    newUsersToday: metricsData.newUsersToday,
    newInternshipsToday: metricsData.newInternshipsToday,
    newApplicationsToday: metricsData.newApplicationsToday,
  };

  // Platform metrics — compute applicationsPerInternship from totals
  const applicationsPerInternship =
    overviewData.totalInternships > 0
      ? Math.round((overviewData.totalApplications / overviewData.totalInternships) * 10) / 10
      : 0;

  const platformMetrics: PlatformMetrics = {
    applicationsPerInternship,
    fillRate: 0.65, // Placeholder — pending analytics infrastructure
    averageTimeToHire: 14.5, // Placeholder — pending analytics infrastructure
  };

  return { overview, recentActivity, platformMetrics, userGrowth: growth };
}

// ─── List Users ─────────────────────────────────────────────

/**
 * Paginated listing of all platform users with search, filter, and sort.
 * Excludes soft-deleted users. Password hash is never returned.
 *
 * @param filters - Pagination, search, role/status/isVerified filters, sort/order.
 * @returns Paginated list of user records.
 */
export async function listUsers(filters: AdminUserListFilters): Promise<AdminUserListResponse> {
  const [users, total] = await Promise.all([
    adminRepository.findUsers(filters),
    adminRepository.countUsers(filters),
  ]);

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data: users, meta };
}

// ─── Update User Status ─────────────────────────────────────

/**
 * Updates a user's status (ACTIVE or SUSPENDED).
 *
 * Business rules:
 * - Admin cannot suspend themselves (self-suspension guard).
 * - Creates an AuditLog entry with the previous and new status.
 * - notifyUser is accepted but no email is sent (documented gap — no email provider).
 *
 * @param userId - The target user's UUID.
 * @param status - New status: 'ACTIVE' or 'SUSPENDED'.
 * @param reason - Reason for the status change.
 * @param notifyUser - Whether to notify the user (accepted but not implemented).
 * @param adminId - The admin user's UUID performing the action.
 * @param ipAddress - The IP address of the admin (for audit log).
 * @param userAgent - The user agent of the admin (for audit log).
 * @returns The updated user's id, status, and updatedAt timestamp.
 *
 * @throws {ForbiddenError} If the admin tries to change their own status.
 * @throws {NotFoundError} If the target user is not found.
 */
export async function updateUserStatus(
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
  notifyUser: boolean,
  adminId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserStatusUpdateResult> {
  // Self-suspension guard
  if (adminId === userId) {
    throw new ForbiddenError('Admin cannot change their own status');
  }

  // Fetch the target user
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const previousStatus = user.status;

  // Update status
  const updated = await adminRepository.updateUserStatus(userId, status);

  // Create audit log entry including notifyUser in newValue
  await adminRepository.createAuditLog({
    userId: adminId,
    action: 'USER_STATUS_CHANGE',
    entity: 'USER',
    entityId: userId,
    oldValue: { status: previousStatus },
    newValue: { status: updated.status, reason, notifyUser },
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  // notifyUser is accepted but no email is sent (documented gap)
  // See KNOWN_GAPS_REGISTER.md — "Admin User Status Change Email Notification Unavailable"
  void notifyUser;

  return {
    userId: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt,
  };
}

// ─── List Audit Logs ────────────────────────────────────────

/**
 * Paginated listing of audit log entries with filters.
 * Does not expose raw user-agent or ipAddress in the response.
 *
 * @param filters - Pagination, user/action/entity/date range filters.
 * @returns Paginated list of audit log entries.
 */
export async function listAuditLogs(filters: AuditLogListFilters): Promise<AuditLogListResponse> {
  const [logs, total] = await Promise.all([
    adminRepository.findAuditLogs(filters),
    adminRepository.countAuditLogs(filters),
  ]);

  // Map to include userEmail (from included user relation) and
  // strip ipAddress and userAgent from the response
  const data = logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    userEmail: (log as Record<string, unknown>).user
      ? ((log as { user: { email: string } }).user.email)
      : '',
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    oldValue: log.oldValue,
    newValue: log.newValue,
    createdAt: log.createdAt,
  }));

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data, meta };
}

// ─── Generate Report ────────────────────────────────────────

/**
 * Generates a report of the specified type and format.
 * CSV serialization is done in-service without external dependencies.
 * Reports are synchronous only (async generation deferred — see KNOWN_GAPS_REGISTER.md).
 *
 * @param query - Report configuration: type, format, optional date range.
 * @returns The report data, either as a JSON object or CSV string.
 */
export async function generateReport(query: {
  type: ReportType;
  format: ReportFormat;
  from?: string;
  to?: string;
}): Promise<ReportResult | { csv: string; filename: string }> {
  const data = await adminRepository.getReportData(query.type, query.from, query.to);

  if (query.format === 'csv') {
    const csv = serializeToCsv(data);
    const filename = `${query.type}-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { csv, filename };
  }

  return {
    reportType: query.type,
    generatedAt: new Date().toISOString(),
    parameters: { from: query.from ?? null, to: query.to ?? null },
    data,
  };
}

// ─── CSV Serialization ─────────────────────────────────────

/**
 * Serializes an array of records to CSV format.
 * Handles null values, nested objects (JSON.stringify), and headers from keys.
 *
 * @param records - Array of flat record objects.
 * @returns CSV string with header row and data rows.
 */
function serializeToCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) {
    return '';
  }

  const headers = Object.keys(records[0]);
  const headerRow = headers.map(escapeCsvField).join(',');

  const dataRows = records.map((record) => {
    return headers
      .map((header) => escapeCsvField(formatCsvValue(record[header])))
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Formats a single value for CSV output.
 *
 * @param value - The value to format.
 * @returns A string representation safe for CSV.
 */
function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Escapes a CSV field value (wraps in quotes if contains comma, quote, or newline).
 *
 * @param value - The field value to escape.
 * @returns The escaped field value.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
