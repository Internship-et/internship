// ─────────────────────────────────────────────────────────────
// Config Module
// Loads and validates environment variables at startup.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';

export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  logLevel: string;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  apiPrefix: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function env(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function envInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer`);
  }
  return parsed;
}

// ─── CORS Origin Resolution ───────────────────────────────
// CORS_ORIGINS is the preferred variable name. If set, it takes priority.
// CORS_ORIGIN is the legacy/deprecated name. Falls back to '*' if neither is set.
function resolveCorsOrigin(): string {
  const origins = process.env['CORS_ORIGINS'];
  if (origins && origins.trim().length > 0) {
    return origins.trim();
  }
  return env('CORS_ORIGIN', '*');
}

// ─── JWT Secret Validation ───────────────────────────────
const jwtSecret = requiredEnv('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error(
    `JWT_SECRET must be at least 32 characters long (current length: ${jwtSecret.length})`,
  );
}

export const config: Config = {
  nodeEnv: env('NODE_ENV', 'development'),
  port: envInt('PORT', 3000),
  databaseUrl: requiredEnv('DATABASE_URL'),
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret,
  jwtAccessExpiresIn: env('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
  logLevel: env('LOG_LEVEL', 'debug'),
  corsOrigin: resolveCorsOrigin(),
  rateLimitWindowMs: envInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMax: envInt('RATE_LIMIT_MAX', 100),
  apiPrefix: env('API_PREFIX', '/api/v1'),
};

export default config;
