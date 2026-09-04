import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma.client';
import { redisClient } from './infrastructure/redis/redis.client';
import { rabbitmqClient } from './infrastructure/rabbitmq/rabbitmq.client';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { urlRouter } from './modules/urls/url.routes';
import { redirectRouter } from './modules/urls/redirect.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { analyticsConsumer } from './modules/analytics/analytics.consumer';
import { setupSwagger } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = createApp();

  // Connect infrastructure
  await connectDatabase();
  await redisClient.connect();
  await rabbitmqClient.connect();

  // Set up Swagger docs
  setupSwagger(app);

  // Register API routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/urls', urlRouter);
  app.use('/api/v1/urls', analyticsRouter);

  // Root route — API info
  app.get('/', (_req, res) => {
    res.json({
      name: 'Shortify',
      version: '1.0.0',
      description: 'Production-quality URL shortener API',
      docs: '/docs',
      app: '/app/',
      health: '/health',
      api: { auth: '/api/v1/auth', urls: '/api/v1/urls' },
    });
  });

  // Public redirect — MUST be after API routes to avoid conflicts
  app.use('/', redirectRouter);

  // Error handling — MUST be last
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  // Start analytics consumer
  await analyticsConsumer.start();

  // Start server
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `Shortify server started on port ${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      await redisClient.disconnect();
      await rabbitmqClient.disconnect();
      logger.info('All connections closed — shutting down');
      process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start application');
  process.exit(1);
});
