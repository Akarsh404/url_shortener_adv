/**
 * Integration test setup.
 *
 * These tests require running PostgreSQL, Redis, and RabbitMQ instances.
 * Use docker compose to start infrastructure before running:
 *
 *   docker compose up -d postgres redis rabbitmq
 *   npm run test:integration
 *
 * For CI or environments without Docker, these tests will be skipped
 * if the database is not available.
 */

import { createApp } from '../../src/app';
import { Express } from 'express';
import { prisma, connectDatabase, disconnectDatabase } from '../../src/infrastructure/database/prisma.client';
import { redisClient } from '../../src/infrastructure/redis/redis.client';
import { rabbitmqClient } from '../../src/infrastructure/rabbitmq/rabbitmq.client';
import { errorMiddleware, notFoundMiddleware } from '../../src/middleware/error.middleware';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { urlRouter } from '../../src/modules/urls/url.routes';
import { redirectRouter } from '../../src/modules/urls/redirect.routes';
import { analyticsRouter } from '../../src/modules/analytics/analytics.routes';
import { setupSwagger } from '../../src/config/swagger';

let app: Express;
let isDbAvailable = false;

export async function setupTestApp(): Promise<Express> {
  if (app) return app;

  try {
    await connectDatabase();
    isDbAvailable = true;
  } catch {
    isDbAvailable = false;
  }

  // Redis and RabbitMQ connections are optional for tests
  try {
    await redisClient.connect();
  } catch {
    // Redis unavailable — tests will run without cache
  }

  try {
    await rabbitmqClient.connect();
  } catch {
    // RabbitMQ unavailable — analytics tests may be limited
  }

  app = createApp();
  setupSwagger(app);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/urls', urlRouter);
  app.use('/api/v1/urls', analyticsRouter);
  app.use('/', redirectRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export async function teardownTestApp(): Promise<void> {
  await disconnectDatabase();
  await redisClient.disconnect();
  await rabbitmqClient.disconnect();
}

export function isDatabaseAvailable(): boolean {
  return isDbAvailable;
}

export async function cleanDatabase(): Promise<void> {
  if (!isDbAvailable) return;
  // Delete in order respecting foreign keys
  await prisma.clickEvent.deleteMany();
  await prisma.url.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
