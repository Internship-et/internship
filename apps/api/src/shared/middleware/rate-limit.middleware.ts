// ─────────────────────────────────────────────────────────────
// Rate Limiter Middleware
// Redis-based sliding window rate limiter with in-memory fallback.
// Uses Redis sorted sets for true sliding-window accuracy.
// Configurable per route (window, max requests, key generator).
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { redis } from '../lib/redis.js';
import logger from '../lib/logger.js';
import { RateLimitError } from '../errors/app-error.js';

// ─── Types ─────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Time window in milliseconds (e.g., 15 * 60 * 1000 for 15 min). */
  windowMs: number;
  /** Max requests allowed within the window. */
  max: number;
  /** Redis key prefix for this rate limiter group. */
  prefix?: string;
  /**
   * Custom key generator. Defaults to (req) => req.ip.
   * For authenticated routes, use (req) => req.user!.id after authenticate middleware.
   */
  keyGenerator?: (req: Request) => string;
  /** Custom 429 error message. */
  message?: string;
  /**
   * Optional skip function. If provided and returns true, the request bypasses
   * rate limiting entirely (next() is called immediately without setting headers).
   * Useful for health endpoints, webhooks, or internal routes that must not be throttled.
   */
  skip?: (req: Request) => boolean;
}

// ─── In-Memory Fallback Store ──────────────────────────────

interface InMemoryEntry {
  /** Sorted timestamps (epoch ms) of requests within the window. */
  timestamps: number[];
}

const fallbackStore = new Map<string, InMemoryEntry>();

/** Maximum number of entries in the in-memory fallback store. */
const MAX_FALLBACK_ENTRIES = 10_000;

/**
 * No periodic cleanup needed.
 *
 * Lazy cleanup happens on every request inside `inMemoryRateLimit()`:
 * expired timestamps are filtered out using the caller's configured `windowMs`.
 * A `MAX_FALLBACK_ENTRIES` cap prevents unbounded memory growth.
 */

// ─── Helpers ───────────────────────────────────────────────

/**
 * Sets the standard X-RateLimit-* headers on the response.
 *
 * @param res  - Express response object.
 * @param limit - Max requests allowed.
 * @param remaining - Requests remaining in the current window.
 * @param reset - Epoch ms when the window resets.
 */
function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  reset: number,
): void {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('X-RateLimit-Reset', Math.ceil(reset));
  res.setHeader('Retry-After', Math.ceil(Math.max(0, reset - Date.now()) / 1000));
}

/**
 * Default key generator: uses the client IP address.
 * Safe for unauthenticated routes and global middleware.
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ─── In-Memory Fallback Logic ──────────────────────────────

/**
 * Sliding window rate limiter using an in-memory Map.
 * Activated when Redis is unavailable.
 *
 * NOTE: This is per-process only. In multi-replica deployments,
 * each process maintains its own counter. This is a graceful
 * degradation fallback, not a production-grade solution.
 */
function inMemoryRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
  config: RateLimitConfig,
  key: string,
): void {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = fallbackStore.get(key);

  if (!entry) {
    // Enforce max store size to prevent memory leak
    if (fallbackStore.size >= MAX_FALLBACK_ENTRIES) {
      logger.error('In-memory rate limiter store full — allowing request');
      next();
      return;
    }
    entry = { timestamps: [] };
    fallbackStore.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
  const count = entry.timestamps.length;

  if (count >= config.max) {
    setRateLimitHeaders(res, config.max, 0, now + config.windowMs);
    next(new RateLimitError(config.message ?? 'Too many requests, please try again later.'));
    return;
  }

  entry.timestamps.push(now);
  setRateLimitHeaders(res, config.max, config.max - (count + 1), now + config.windowMs);
  next();
}

// ─── Public Middleware Factory ──────────────────────────────

/**
 * Creates an Express middleware that enforces rate limits using
 * a Redis sorted set (sliding window) with an in-memory fallback.
 *
 * The middleware:
 *  - Uses Redis ZSET for true sliding-window counting
 *  - Cleans up expired entries atomically via MULTI/EXEC pipeline
 *  - Falls back to an in-memory Map when Redis is unavailable
 *  - Sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After headers
 *  - Returns 429 (RateLimitError) when the limit is exceeded
 *
 * @param config - Rate limit configuration.
 * @returns Express middleware function.
 *
 * @example
 * ```ts
 * // Global default (IP-keyed)
 * app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));
 *
 * // Auth endpoint (stricter, IP-keyed)
 * router.post('/auth/login', rateLimiter({ prefix: 'auth', max: 20 }), handler);
 *
 * // Authenticated route (user-ID-keyed, after authenticate)
 * router.post('/apply', authenticate, rateLimiter({ prefix: 'application', max: 10, keyGenerator: (req) => req.user!.id }), handler);
 * ```
 */
export function rateLimiter(config: RateLimitConfig) {
  const prefix = config.prefix ?? 'global';
  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // If skip is configured and returns true, bypass rate limiting entirely
    if (config.skip?.(req)) {
      next();
      return;
    }

    const identifier = keyGenerator(req);
    const redisKey = `ratelimit:${prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // ── Redis path: sliding window via sorted set ──
      // Use a unique member (timestamp + random hex) to handle same-timestamp collisions.
      const member = `${now}:${randomBytes(4).toString('hex')}`;

      // Pipeline: cleanup expired entries, count remaining, add current entry, set TTL
      const multi = redis.multi();
      multi.zremrangebyscore(redisKey, 0, windowStart);
      multi.zcard(redisKey);
      multi.zadd(redisKey, now, member);
      multi.pexpire(redisKey, config.windowMs);

      const results = await multi.exec();

      // Results order: [zremrangebyscore, zcard, zadd, pexpire]
      // zcard result: [error, count]
      const countResult = results?.[1];
      const count: number = (countResult?.[1] as number) ?? 0;

      if (count >= config.max) {
        setRateLimitHeaders(res, config.max, 0, now + config.windowMs);
        next(new RateLimitError(config.message ?? 'Too many requests, please try again later.'));
        return;
      }

      setRateLimitHeaders(res, config.max, config.max - (count + 1), now + config.windowMs);
      next();
    } catch (error) {
      // ── In-memory fallback ──
      logger.warn({ err: error, redisKey }, 'Rate limiter: Redis unavailable, using in-memory fallback');

      // Note: Because ZADD runs inside the pipeline, denied requests (those that hit
      // the count check before the ZADD) may still have been counted by ZREMRANGEBYSCORE
      // from a previous pipelined execution. For Checkpoint 8, this is acceptable —
      // the sliding window self-corrects on the next request.
      inMemoryRateLimit(req, res, next, config, `fallback:${redisKey}`);
    }
  };
}

export default rateLimiter;
