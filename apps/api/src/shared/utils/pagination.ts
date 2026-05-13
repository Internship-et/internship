// ─────────────────────────────────────────────────────────────
// Pagination Helpers
// Provides cursor-based and offset-based pagination utilities.
// ─────────────────────────────────────────────────────────────

// ─── Types ──────────────────────────────────────────────────

export interface OffsetPaginationParams {
  page: number;
  pageSize: number;
}

export interface CursorPaginationParams {
  cursor?: string | null;
  limit: number;
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore: boolean;
  cursor?: string | null;
}

export interface OffsetPaginationMeta extends PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CursorPaginationMeta extends PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
}

// ─── Offset-Based Pagination ───────────────────────────────

/**
 * Parses and validates offset-based pagination query params.
 * Defaults: page=1, pageSize=20
 * Max pageSize: 100
 */
export function parseOffsetPagination(query: {
  page?: string;
  pageSize?: string;
}): OffsetPaginationParams {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10) || 20));
  return { page, pageSize };
}

/**
 * Computes the Prisma skip/take values for offset-based pagination.
 */
export function getOffsetPaginationInput(params: OffsetPaginationParams): {
  skip: number;
  take: number;
} {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

/**
 * Builds pagination meta for offset-based responses.
 */
export function buildOffsetPaginationMeta(
  params: OffsetPaginationParams,
  total: number,
): OffsetPaginationMeta {
  const totalPages = Math.ceil(total / params.pageSize);
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    hasMore: params.page < totalPages,
  };
}

// ─── Cursor-Based Pagination ───────────────────────────────

/**
 * Parses and validates cursor-based pagination query params.
 * Defaults: limit=20
 * Max limit: 100
 */
export function parseCursorPagination(query: {
  cursor?: string;
  limit?: string;
}): CursorPaginationParams {
  const cursor = query.cursor ?? null;
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  return { cursor, limit };
}

/**
 * Computes the Prisma take (+1 to determine hasMore) for cursor-based pagination.
 * Returns take + 1 so you can determine if there are more results.
 */
export function getCursorPaginationInput(params: CursorPaginationParams): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  const input: { take: number; skip?: number; cursor?: { id: string } } = {
    take: params.limit + 1, // Fetch one extra to detect hasMore
  };

  if (params.cursor) {
    input.skip = 1; // Skip the cursor itself
    input.cursor = { id: params.cursor };
  }

  return input;
}

/**
 * Builds pagination meta for cursor-based responses.
 * Pass the results array (which may contain the extra item) and the original limit.
 */
export function buildCursorPaginationMeta<T extends { id: string }>(
  results: T[],
  limit: number,
): { data: T[]; meta: CursorPaginationMeta } {
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const lastItem = data[data.length - 1];

  return {
    data,
    meta: {
      cursor: lastItem ? lastItem.id : null,
      hasMore,
    },
  };
}

// ─── Generic Pagination Meta ───────────────────────────────

/**
 * Builds a generic pagination meta object from partial inputs.
 */
export function buildPaginationMeta(partial: Partial<PaginationMeta>): PaginationMeta {
  return {
    page: partial.page,
    pageSize: partial.pageSize,
    total: partial.total,
    hasMore: partial.hasMore ?? false,
    cursor: partial.cursor,
  };
}
