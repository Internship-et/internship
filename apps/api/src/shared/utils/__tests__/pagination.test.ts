// ─────────────────────────────────────────────────────────────
// Pagination — Unit Tests
// Tests offset-based and cursor-based pagination utilities.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  parseOffsetPagination,
  getOffsetPaginationInput,
  buildOffsetPaginationMeta,
  parseCursorPagination,
  getCursorPaginationInput,
  buildCursorPaginationMeta,
  buildPaginationMeta,
} from '../pagination.js';

describe('Pagination', () => {
  describe('parseOffsetPagination', () => {
    it('returns defaults when no query params', () => {
      const result = parseOffsetPagination({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('parses valid page and pageSize', () => {
      const result = parseOffsetPagination({ page: '3', pageSize: '10' });
      expect(result).toEqual({ page: 3, pageSize: 10 });
    });

    it('caps pageSize at 100', () => {
      const result = parseOffsetPagination({ pageSize: '200' });
      expect(result.pageSize).toBe(100);
    });

    it('falls back to default when pageSize is 0 (falsy)', () => {
      const result = parseOffsetPagination({ pageSize: '0' });
      // parseInt('0') = 0, which is falsy, so the fallback 20 is used
      expect(result.pageSize).toBe(20);
    });

    it('enforces minimum page of 1', () => {
      const result = parseOffsetPagination({ page: '-5' });
      expect(result.page).toBe(1);
    });

    it('falls back to defaults for NaN values', () => {
      const result = parseOffsetPagination({ page: 'abc', pageSize: 'xyz' });
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('handles missing page parameter', () => {
      const result = parseOffsetPagination({ pageSize: '50' });
      expect(result).toEqual({ page: 1, pageSize: 50 });
    });

    it('handles missing pageSize parameter', () => {
      const result = parseOffsetPagination({ page: '2' });
      expect(result).toEqual({ page: 2, pageSize: 20 });
    });
  });

  describe('getOffsetPaginationInput', () => {
    it('computes skip and take for page 1', () => {
      const result = getOffsetPaginationInput({ page: 1, pageSize: 20 });
      expect(result).toEqual({ skip: 0, take: 20 });
    });

    it('computes skip and take for page 3', () => {
      const result = getOffsetPaginationInput({ page: 3, pageSize: 10 });
      expect(result).toEqual({ skip: 20, take: 10 });
    });

    it('handles pageSize of 1', () => {
      const result = getOffsetPaginationInput({ page: 5, pageSize: 1 });
      expect(result).toEqual({ skip: 4, take: 1 });
    });
  });

  describe('buildOffsetPaginationMeta', () => {
    it('builds meta for first page with more results', () => {
      const result = buildOffsetPaginationMeta({ page: 1, pageSize: 10 }, 25);
      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        total: 25,
        hasMore: true,
      });
    });

    it('hasMore is false when page is last', () => {
      const result = buildOffsetPaginationMeta({ page: 3, pageSize: 10 }, 25);
      expect(result.hasMore).toBe(false);
    });

    it('hasMore is false when total is 0', () => {
      const result = buildOffsetPaginationMeta({ page: 1, pageSize: 20 }, 0);
      expect(result.hasMore).toBe(false);
    });

    it('works with exact page boundary', () => {
      const result = buildOffsetPaginationMeta({ page: 2, pageSize: 10 }, 20);
      expect(result.hasMore).toBe(false);
    });

    it('works with single result', () => {
      const result = buildOffsetPaginationMeta({ page: 1, pageSize: 20 }, 1);
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(1);
    });
  });

  describe('parseCursorPagination', () => {
    it('returns defaults when no query params', () => {
      const result = parseCursorPagination({});
      expect(result).toEqual({ cursor: null, limit: 20 });
    });

    it('parses cursor and limit', () => {
      const result = parseCursorPagination({ cursor: 'abc-123', limit: '10' });
      expect(result).toEqual({ cursor: 'abc-123', limit: 10 });
    });

    it('caps limit at 100', () => {
      const result = parseCursorPagination({ limit: '200' });
      expect(result.limit).toBe(100);
    });

    it('falls back to default when limit is 0 (falsy)', () => {
      const result = parseCursorPagination({ limit: '0' });
      // parseInt('0') = 0, which is falsy, so the fallback 20 is used
      expect(result.limit).toBe(20);
    });

    it('falls back to default for NaN limit', () => {
      const result = parseCursorPagination({ limit: 'abc' });
      expect(result.limit).toBe(20);
    });

    it('empty cursor string is not converted to null by ?? operator', () => {
      const result = parseCursorPagination({ cursor: '', limit: '10' });
      // '' ?? null returns '' because ?? only checks null/undefined
      expect(result.cursor).toBe('');
    });
  });

  describe('getCursorPaginationInput', () => {
    it('returns take+1 without cursor for first page', () => {
      const result = getCursorPaginationInput({ cursor: null, limit: 20 });
      expect(result).toEqual({ take: 21 });
    });

    it('returns take+1 with cursor and skip', () => {
      const result = getCursorPaginationInput({ cursor: 'abc-123', limit: 10 });
      expect(result).toEqual({ take: 11, skip: 1, cursor: { id: 'abc-123' } });
    });

    it('handles limit of 1', () => {
      const result = getCursorPaginationInput({ cursor: 'xyz', limit: 1 });
      expect(result).toEqual({ take: 2, skip: 1, cursor: { id: 'xyz' } });
    });
  });

  describe('buildCursorPaginationMeta', () => {
    it('returns data and meta when hasMore is true', () => {
      const items = [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
        { id: '3', name: 'C' },
      ];
      const result = buildCursorPaginationMeta(items, 2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.data[1].id).toBe('2');
      expect(result.meta).toEqual({
        cursor: '2',
        hasMore: true,
      });
    });

    it('returns all data and hasMore false when results <= limit', () => {
      const items = [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ];
      const result = buildCursorPaginationMeta(items, 5);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        cursor: '2',
        hasMore: false,
      });
    });

    it('returns null cursor for empty results', () => {
      const items: { id: string }[] = [];
      const result = buildCursorPaginationMeta(items, 20);
      expect(result.data).toHaveLength(0);
      expect(result.meta).toEqual({
        cursor: null,
        hasMore: false,
      });
    });

    it('cursor points to the last item in returned data', () => {
      const items = [
        { id: 'first', value: 1 },
        { id: 'second', value: 2 },
        { id: 'third', value: 3 },
      ];
      const result = buildCursorPaginationMeta(items, 2);
      expect(result.meta.cursor).toBe('second');
    });

    it('works with single-element result', () => {
      const items = [{ id: 'only', value: 1 }];
      const result = buildCursorPaginationMeta(items, 1);
      expect(result.data).toHaveLength(1);
      expect(result.meta.cursor).toBe('only');
      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('buildPaginationMeta', () => {
    it('builds meta from partial inputs', () => {
      const result = buildPaginationMeta({
        page: 1,
        pageSize: 20,
        total: 50,
        hasMore: true,
      });
      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        total: 50,
        hasMore: true,
        cursor: undefined,
      });
    });

    it('defaults hasMore to false', () => {
      const result = buildPaginationMeta({});
      expect(result.hasMore).toBe(false);
    });

    it('includes cursor when provided', () => {
      const result = buildPaginationMeta({ cursor: 'abc', hasMore: false });
      expect(result.cursor).toBe('abc');
    });
  });
});
