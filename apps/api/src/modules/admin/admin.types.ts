// ─────────────────────────────────────────────────────────────
// Admin — Type Definitions
// Defines all types used across the Admin module.
// ─────────────────────────────────────────────────────────────

import type { OffsetPaginationMeta } from '../../shared/utils/pagination.js';

// ─── Dashboard ──────────────────────────────────────────────

/** Overview counts for the admin dashboard, including active user stats. */
export interface DashboardOverview {
  totalUsers: number;
  totalStudents: number;
  totalCompanies: number;
  totalSchools: number;
  totalInternships: number;
  totalApplications: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
}

/** Recent-activity counters scoped to today. */
export interface RecentActivity {
  newUsersToday: number;
  newInternshipsToday: number;
  newApplicationsToday: number;
}

/** Platform-wide derived metrics. */
export interface PlatformMetrics {
  applicationsPerInternship: number;
  fillRate: number;
  averageTimeToHire: number;
}

/** A single data point for user growth over time. */
export interface UserGrowthPoint {
  date: string;
  count: number;
}

/** Complete admin dashboard response per ADMIN_ROUTES.md. */
export interface AdminDashboard {
  overview: DashboardOverview;
  recentActivity: RecentActivity;
  platformMetrics: PlatformMetrics;
  userGrowth: UserGrowthPoint[];
}

// ─── User List ──────────────────────────────────────────────

/** Filters for the admin users list endpoint. */
export interface AdminUserListFilters {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  status?: string;
  isVerified?: boolean;
  sort: string;
  order: 'asc' | 'desc';
}

/** User list entry as returned by the admin endpoint. */
export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/** Paginated users response. */
export interface AdminUserListResponse {
  data: UserListItem[];
  meta: OffsetPaginationMeta;
}

// ─── User Status Update ─────────────────────────────────────

/** Result of a user status update. */
export interface UserStatusUpdateResult {
  userId: string;
  status: string;
  updatedAt: Date;
}

// ─── Audit Log ──────────────────────────────────────────────

/** Filters for the admin audit log list endpoint. */
export interface AuditLogListFilters {
  page: number;
  pageSize: number;
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
}

/** A single audit log entry. Includes userEmail from the related user. */
export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
  createdAt: Date;
}

/** Paginated audit log response. */
export interface AuditLogListResponse {
  data: AuditLogEntry[];
  meta: OffsetPaginationMeta;
}

// ─── Reports ────────────────────────────────────────────────

/** Supported report types. */
export type ReportType = 'users' | 'internships' | 'applications' | 'companies' | 'schools';

/** Supported report output formats. */
export type ReportFormat = 'json' | 'csv';

/** Structure of a generated JSON report per ADMIN_ROUTES.md. */
export interface ReportResult {
  reportType: ReportType;
  generatedAt: string;
  parameters: { from: string | null; to: string | null };
  data: Record<string, unknown>[];
}

/** CSV report response shape — the route handles Content-Type/Diposition. */
export interface CsvReportResult {
  csv: string;
  filename: string;
}

// ─── Dashboard Query Parameters ─────────────────────────────

/** Parsed dashboard filter params passed to service. */
export interface DashboardFilters {
  from?: string;
  to?: string;
}
