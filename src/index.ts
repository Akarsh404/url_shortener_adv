/**
 * Vercel Serverless Function entry point.
 *
 * Exports the Express app for Vercel's serverless environment.
 * Infrastructure connections are lazily initialized on first request.
 *
 * Limitations vs. traditional server (server.ts):
 * - No persistent RabbitMQ consumer (no long-running process)
 * - Redis/RabbitMQ are optional — app degrades gracefully without them
 * - Each request is a cold/warm function invocation
 */

import { createApp } from './app';
import { connectDatabase } from './infrastructure/database/prisma.client';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { urlRouter } from './modules/urls/url.routes';
import { redirectRouter } from './modules/urls/redirect.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { setupSwagger } from './config/swagger';
import { logger } from './config/logger';
import { env } from './config/env';
import { Request, Response, NextFunction } from 'express';

const app = createApp();

// Lazy initialization middleware — only connect to DB
let initialized = false;

app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  if (!initialized) {
    try {
      await connectDatabase();
      logger.info('Database connected (serverless)');
    } catch (err) {
      logger.error({ err }, 'DB connect failed');
    }

    // Only connect Redis if a real URL is provided (not a placeholder)
    if (env.REDIS_URL && !env.REDIS_URL.includes('placeholder')) {
      try {
        const { redisClient } = await import('./infrastructure/redis/redis.client');
        await Promise.race([
          redisClient.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
        ]);
      } catch {
        logger.warn('Redis unavailable — running without cache');
      }
    }

    // Skip RabbitMQ in serverless — no persistent consumer possible
    initialized = true;
  }
  next();
});

// Set up Swagger docs
setupSwagger(app);

// Register API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/urls', urlRouter);
app.use('/api/v1/urls', analyticsRouter);

// Public redirect
app.use('/', redirectRouter);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
