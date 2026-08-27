import { Router, Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { redisClient } from '../../infrastructure/redis/redis.client';
import { logger } from '../../config/logger';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    rabbitmq: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn({ err: error }, 'Database health check failed');
    return { status: 'down', message: 'Database connection failed' };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    const client = redisClient.getClient();
    if (!client) return { status: 'down', message: 'Redis client not initialized' };
    await client.ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn({ err: error }, 'Redis health check failed');
    return { status: 'down', message: 'Redis connection failed' };
  }
}

async function checkRabbitMQ(): Promise<ComponentHealth> {
  try {
    // RabbitMQ health is determined by whether the connection is open
    const { rabbitmqClient } = await import('../../infrastructure/rabbitmq/rabbitmq.client');
    const isConnected = rabbitmqClient.isConnected();
    return isConnected
      ? { status: 'up' }
      : { status: 'down', message: 'RabbitMQ not connected' };
  } catch (error) {
    logger.warn({ err: error }, 'RabbitMQ health check failed');
    return { status: 'down', message: 'RabbitMQ connection failed' };
  }
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  const [database, redis, rabbitmq] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkRabbitMQ(),
  ]);

  const allUp = database.status === 'up' && redis.status === 'up' && rabbitmq.status === 'up';
  const databaseUp = database.status === 'up';

  let overallStatus: HealthStatus['status'];
  if (allUp) {
    overallStatus = 'healthy';
  } else if (databaseUp) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database,
      redis,
      rabbitmq,
    },
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(health);
});
