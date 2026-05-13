// ─────────────────────────────────────────────────────────────
// Admin Repository
// Database access layer for all Admin queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AdminUserListFilters, AuditLogListFilters, ReportType } from './admin.types.js';
import { getOffsetPaginationInput } from '../../shared/utils/pagination.js';

// ─── Types ──────────────────────────────────────────────────

/** Audit log creation data including IP and user agent. */
export interface CreateAuditLogData {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ─── Dashboard Overview ─────────────────────────────────────

/**
 * Returns total counts for all major entities on the platform.
 *
 * @returns Object containing total users, students, companies, schools, internships, and applications.
 */
export async function getDashboardOverview() {
  const [totalUsers, totalStudents, totalCompanies, totalSchools, totalInternships, totalApplications] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.student.count(),
      prisma.company.count({ where: { deletedAt: null } }),
      prisma.school.count({ where: { deletedAt: null } }),
      prisma.internship.count({ where: { deletedAt: null } }),
      prisma.application.count(),
    ]);

  return {
    totalUsers,
    totalStudents,
    totalCompanies,
    totalSchools,
    totalInternships,
    totalApplications,
  };
}

// ─── Platform Metrics ───────────────────────────────────────

/**
 * Returns platform metrics: active users, new registrations, etc.
 *
 * NOTE: The `from`/`to` parameters are accepted for API consistency but metrics
 * here are intentionally fixed to today/week boundaries (active users today/this
 * week, new registrations today, new internships/applications today). Date-range
 * filtering for platform metrics is deferred until a persistent analytics
 * infrastructure (daily stats table) is built. See KNOWN_GAPS_REGISTER.md.
 *
 * @param _from - Ignored (reserved for future analytics).
 * @param _to - Ignored (reserved for future analytics).
 * @returns Object containing various platform metrics.
 */
export async function getPlatformMetrics(_from?: string, _to?: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [
    activeUsersToday,
    activeUsersThisWeek,
    newUsersToday,
    newInternshipsToday,
    newApplicationsToday,
  ] = await Promise.all([
    // Active today: users who logged in since start of today
    prisma.user.count({
      where: {
        lastLoginAt: { gte: todayStart },
        deletedAt: null,
      },
    }),
    // Active this week: users who logged in since start of 7 days ago
    prisma.user.count({
      where: {
        lastLoginAt: { gte: weekStart },
        deletedAt: null,
      },
    }),
    // New users today
    prisma.user.count({
      where: {
        createdAt: { gte: todayStart },
        deletedAt: null,
      },
    }),
    // New internships today
    prisma.internship.count({
      where: {
        createdAt: { gte: todayStart },
        deletedAt: null,
      },
    }),
    // New applications today
    prisma.application.count({
      where: {
        appliedAt: { gte: todayStart },
      },
    }),
  ]);

  return {
    activeUsersToday,
    activeUsersThisWeek,
    newUsersToday,
    newInternshipsToday,
    newApplicationsToday,
    fillRate: 0.65, // Placeholder — pending analytics infrastructure
    averageTimeToHire: 14.5, // Placeholder — pending analytics infrastructure
  };
}

// ─── User Growth ────────────────────────────────────────────

/**
 * Returns user growth data grouped by day for a given date range.
 *
 * @param from - Start date string.
 * @param to - End date string.
 * @returns Array of { date, count } objects.
 */
export async function getUserGrowth(from?: string, to?: string) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (from) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter | undefined), gte: new Date(from) };
  }
  if (to) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter | undefined), lte: new Date(to) };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const growthMap = new Map<string, number>();
  for (const user of users) {
    const day = user.createdAt.toISOString().split('T')[0];
    growthMap.set(day, (growthMap.get(day) ?? 0) + 1);
  }

  return Array.from(growthMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

// ─── User Queries ──────────────────────────────────────────

/** Default select for user list items (excludes password hash). */
const userListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

/**
 * Finds users with offset pagination, search, and filters.
 *
 * @param filters - Pagination, search, role, status, sort, and order parameters.
 * @returns Paginated array of user list entries.
 */
export async function findUsers(filters: AdminUserListFilters) {
  const { page, pageSize, search, role, status, isVerified, sort, order } = filters;
  const { skip, take } = getOffsetPaginationInput({ page, pageSize });

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role as Prisma.EnumUserRoleFilter['equals'];
  }

  if (status) {
    where.status = status as Prisma.EnumUserStatusFilter['equals'];
  }

  if (isVerified !== undefined) {
    where.isVerified = isVerified;
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  switch (sort) {
    case 'email':
      orderBy.email = order;
      break;
    case 'firstName':
      orderBy.firstName = order;
      break;
    case 'lastName':
      orderBy.lastName = order;
      break;
    case 'role':
      orderBy.role = order;
      break;
    case 'status':
      orderBy.status = order;
      break;
    case 'updatedAt':
      orderBy.updatedAt = order;
      break;
    case 'lastLoginAt':
      orderBy.lastLoginAt = order;
      break;
    default:
      orderBy.createdAt = order;
      break;
  }

  return prisma.user.findMany({
    where,
    skip,
    take,
    orderBy,
    select: userListSelect,
  });
}

/**
 * Counts users matching the given filters.
 *
 * @param filters - Search, role, status, and isVerified filter parameters.
 * @returns The total count of matching users.
 */
export async function countUsers(filters: AdminUserListFilters) {
  const { search, role, status, isVerified } = filters;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role as Prisma.EnumUserRoleFilter['equals'];
  }

  if (status) {
    where.status = status as Prisma.EnumUserStatusFilter['equals'];
  }

  if (isVerified !== undefined) {
    where.isVerified = isVerified;
  }

  return prisma.user.count({ where });
}

/**
 * Finds a single user by ID. Excludes soft-deleted users.
 *
 * @param userId - The User UUID.
 * @returns The user record (without password hash) or null.
 */
export async function findUserById(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });
}

/**
 * Updates a user's status (ACTIVE or SUSPENDED).
 *
 * @param userId - The User UUID.
 * @param status - The new status value.
 * @returns The updated user record.
 */
export async function updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });
}

// ─── Audit Log Queries ─────────────────────────────────────

/**
 * Finds audit log entries with pagination and filters.
 *
 * @param filters - Pagination, user/action/entity/date range filters.
 * @returns Paginated array of audit log entries.
 */
export async function findAuditLogs(filters: AuditLogListFilters) {
  const { page, pageSize, userId, action, entity, from, to } = filters;
  const { skip, take } = getOffsetPaginationInput({ page, pageSize });

  const where: Prisma.AuditLogWhereInput = {};

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (entity) {
    where.entity = entity;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) {
      where.createdAt.gte = new Date(from);
    }
    if (to) {
      where.createdAt.lte = new Date(to);
    }
  }

  return prisma.auditLog.findMany({
    where,
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      action: true,
      entity: true,
      entityId: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      user: {
        select: { email: true },
      },
    },
  });
}

/**
 * Counts audit log entries matching the given filters.
 *
 * @param filters - Filter parameters matching findAuditLogs.
 * @returns The total count of matching entries.
 */
export async function countAuditLogs(filters: AuditLogListFilters) {
  const { userId, action, entity, from, to } = filters;

  const where: Prisma.AuditLogWhereInput = {};

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (entity) {
    where.entity = entity;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) {
      where.createdAt.gte = new Date(from);
    }
    if (to) {
      where.createdAt.lte = new Date(to);
    }
  }

  return prisma.auditLog.count({ where });
}

/**
 * Creates an audit log entry.
 *
 * @param data - Audit log data including userId, action, entity, entityId, oldValue, newValue, ipAddress, userAgent.
 * @returns The created audit log entry.
 */
export async function createAuditLog(data: CreateAuditLogData) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      oldValue: data.oldValue as Prisma.InputJsonValue | undefined,
      newValue: data.newValue as Prisma.InputJsonValue | undefined,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
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

// ─── Report Queries ─────────────────────────────────────────

/**
 * Generic date filter builder for report queries (createdAt field).
 *
 * @param from - Optional start date.
 * @param to - Optional end date.
 * @returns Where input with createdAt filters if from/to provided.
 */
function dateRangeFilter(from?: string, to?: string): { createdAt?: { gte?: Date; lte?: Date } } {
  if (!from && !to) {return {};}
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {filter.gte = new Date(from);}
  if (to) {filter.lte = new Date(to);}
  return { createdAt: filter };
}

/**
 * Date filter builder for Application queries (uses appliedAt field).
 *
 * @param from - Optional start date.
 * @param to - Optional end date.
 * @returns Where input with appliedAt filters if from/to provided.
 */
function appDateRangeFilter(from?: string, to?: string): { appliedAt?: { gte?: Date; lte?: Date } } {
  if (!from && !to) {return {};}
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {filter.gte = new Date(from);}
  if (to) {filter.lte = new Date(to);}
  return { appliedAt: filter };
}

/**
 * Generates a users report filtered by optional date range.
 *
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of user report records.
 */
export async function getUsersReport(from?: string, to?: string) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...dateRangeFilter(from, to),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    status: u.status,
    isVerified: u.isVerified,
    registeredAt: u.createdAt.toISOString(),
    lastLogin: u.lastLoginAt?.toISOString() ?? null,
  }));
}

/**
 * Generates an internships report filtered by optional date range.
 *
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of internship report records.
 */
export async function getInternshipsReport(from?: string, to?: string) {
  const internships = await prisma.internship.findMany({
    where: {
      deletedAt: null,
      ...dateRangeFilter(from, to),
    },
    select: {
      id: true,
      title: true,
      type: true,
      city: true,
      status: true,
      durationMonths: true,
      createdAt: true,
      company: {
        select: { name: true },
      },
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return internships.map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    city: i.city,
    status: i.status,
    durationMonths: i.durationMonths,
    companyName: i.company.name,
    applicationCount: i._count.applications,
    postedAt: i.createdAt.toISOString(),
  }));
}

/**
 * Generates an applications report filtered by optional date range.
 *
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of application report records.
 */
export async function getApplicationsReport(from?: string, to?: string) {
  const applications = await prisma.application.findMany({
    where: {
      ...appDateRangeFilter(from, to),
    },
    orderBy: { appliedAt: 'desc' },
    include: {
      internship: {
        select: { title: true, company: { select: { name: true } } },
      },
      student: {
        select: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
  });

  return applications.map((a) => ({
    id: a.id,
    internshipTitle: a.internship.title,
    companyName: a.internship.company.name,
    studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
    studentEmail: a.student.user.email,
    status: a.status,
    appliedAt: a.appliedAt.toISOString(),
  }));
}

/**
 * Generates a companies report filtered by optional date range.
 *
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of company report records.
 */
export async function getCompaniesReport(from?: string, to?: string) {
  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      ...dateRangeFilter(from, to),
    },
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      size: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: { internships: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    city: c.city,
    size: c.size,
    isVerified: c.isVerified,
    internshipCount: c._count.internships,
    registeredAt: c.createdAt.toISOString(),
  }));
}

/**
 * Generates a schools report filtered by optional date range.
 *
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of school report records.
 */
export async function getSchoolsReport(from?: string, to?: string) {
  const schools = await prisma.school.findMany({
    where: {
      deletedAt: null,
      ...dateRangeFilter(from, to),
    },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: { students: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return schools.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    city: s.city,
    isVerified: s.isVerified,
    studentCount: s._count.students,
    registeredAt: s.createdAt.toISOString(),
  }));
}

/**
 * Dispatches report generation to the appropriate report method based on type.
 *
 * @param type - Report type (users, internships, applications, companies, schools).
 * @param from - Optional start date string.
 * @param to - Optional end date string.
 * @returns Array of report records.
 */
export async function getReportData(type: ReportType, from?: string, to?: string) {
  switch (type) {
    case 'users':
      return getUsersReport(from, to);
    case 'internships':
      return getInternshipsReport(from, to);
    case 'applications':
      return getApplicationsReport(from, to);
    case 'companies':
      return getCompaniesReport(from, to);
    case 'schools':
      return getSchoolsReport(from, to);
    default:
      return [];
  }
}
