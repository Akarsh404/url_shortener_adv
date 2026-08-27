import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message, target: e.target }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ message: e.message, target: e.target }, 'Prisma warning');
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to connect to PostgreSQL');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Disconnected from PostgreSQL');
}
