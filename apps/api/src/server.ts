// ─────────────────────────────────────────────────────────────
// Server Lifecycle
// Starts the HTTP server, handles graceful shutdown, and
// disconnects from Prisma and Redis on termination.
// ─────────────────────────────────────────────────────────────

import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import logger from './shared/lib/logger.js';
import { prisma } from './shared/lib/prisma.js';
import { disconnectRedis } from './shared/lib/redis.js';

const app = createApp();
const server = http.createServer(app);

/**
 * Gracefully shuts down the server, Prisma, and Redis connections.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Disconnect Prisma
    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Prisma');
    }

    // Disconnect Redis
    try {
      await disconnectRedis();
      logger.info('Redis disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Redis');
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
server.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      apiPrefix: config.apiPrefix,
    },
    `Server started on port ${config.port}`,
  );
});

export default server;
