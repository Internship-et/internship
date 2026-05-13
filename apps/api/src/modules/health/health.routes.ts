// ─────────────────────────────────────────────────────────────
// Health Check Routes
// Provides health check endpoints for monitoring, liveness probes,
// and readiness probes. Dependency checks are honest — they report
// actual DB and Redis connectivity status.
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../../shared/lib/prisma.js';
import { redis } from '../../shared/lib/redis.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import logger from '../../shared/lib/logger.js';

const router = Router();

// ─── Dynamic Version Resolution ────────────────────────────
// Read version from package.json at module load time.
// Uses ESM-safe __dirname via import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');

let appVersion: string;
try {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  appVersion = pkg.version ?? '0.0.0';
} catch {
  logger.warn('Could not read package.json for version; falling back to 0.0.0');
  appVersion = '0.0.0';
}

// ─── Types ─────────────────────────────────────────────────

interface DependencyStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  version: string;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
  memory: {
    used: number;
    total: number;
    percentUsed: number;
    /** Human-readable used memory (e.g. "45MB") */
    usedFormatted?: string;
    /** Human-readable total memory (e.g. "128MB") */
    totalFormatted?: string;
  };
  timestamp: string;
}

const DB_ERROR_MESSAGE = 'Database connectivity check failed';
const REDIS_ERROR_MESSAGE = 'Redis connectivity check failed';

// ─── Helpers ───────────────────────────────────────────────

/**
 * Checks database connectivity by executing SELECT 1.
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latency: Date.now() - start };
  } catch (err) {
    logger.error({ err }, 'Health check: database unhealthy');
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: DB_ERROR_MESSAGE,
    };
  }
}

/**
 * Checks Redis connectivity by sending a PING command.
 */
async function checkRedis(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'healthy', latency: Date.now() - start };
    }
    logger.warn({ pong }, 'Health check: unexpected redis ping response');
    return {
      status: 'degraded',
      latency: Date.now() - start,
      error: REDIS_ERROR_MESSAGE,
    };
  } catch (err) {
    logger.error({ err }, 'Health check: redis unhealthy');
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: REDIS_ERROR_MESSAGE,
    };
  }
}

// ─── Routes ────────────────────────────────────────────────

/**
 * GET /health
 * Returns overall system health, including dependency status,
 * uptime, and memory usage.
 * - 200 if all dependencies healthy or only Redis is degraded/unhealthy
 * - 503 if database is unhealthy (critical dependency)
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const [database, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    let overallStatus: HealthResponse['status'];
    if (database.status === 'healthy' && redisStatus.status === 'healthy') {
      overallStatus = 'ok';
    } else if (database.status === 'healthy') {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'down';
    }

    const memoryUsage = process.memoryUsage();
    const percentUsed =
      memoryUsage.heapTotal > 0
        ? Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        : 0;

    const response: HealthResponse = {
      status: overallStatus,
      uptime: Math.floor(process.uptime()),
      version: appVersion,
      dependencies: {
        database,
        redis: redisStatus,
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentUsed,
        usedFormatted: `${Math.round(memoryUsage.heapUsed / (1024 * 1024))}MB`,
        totalFormatted: `${Math.round(memoryUsage.heapTotal / (1024 * 1024))}MB`,
      },
      timestamp: new Date().toISOString(),
    };

    const httpStatus = overallStatus === 'down' ? 503 : 200;
    res.status(httpStatus).json(response);
  }),
);

/**
 * GET /health/ready
 * Readiness probe — indicates whether the service is ready to accept traffic.
 * Database is the critical dependency for readiness.
 * - 200 if database is healthy
 * - 503 if database is unhealthy
 */
router.get(
  '/health/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    const database = await checkDatabase();

    if (database.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        database: database.status,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        database: database.status,
        error: DB_ERROR_MESSAGE,
        timestamp: new Date().toISOString(),
      });
    }
  }),
);

/**
 * GET /health/live
 * Liveness probe — simple check that the process is alive.
 * Always returns 200 with uptime.
 */
router.get(
  '/health/live',
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  },
);

export default router;
