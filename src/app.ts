import path from 'path';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pinoHttp = require('pino-http');
import { env } from './config/env';
import { logger } from './config/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { healthRouter } from './modules/health/health.routes';

export function createApp(): Express {
  const app = express();

  // Security — disable CSP for /docs and static frontend (dev mode)
  app.use('/docs', helmet({ contentSecurityPolicy: false }));
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );

  // Request ID — must come before logging
  app.use(requestIdMiddleware);

  // Structured logging
  const httpLogger = pinoHttp({
    logger,
    genReqId: (req: Request) => req.id,
    customLogLevel: (_req: Request, res: Response, err: Error | undefined) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: Record<string, unknown>) => ({
        method: req.method,
        url: req.url,
        requestId: req.id,
      }),
      res: (res: Record<string, unknown>) => ({
        statusCode: res.statusCode,
      }),
    },
  });
  app.use(httpLogger);

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false }));

  // Serve static frontend
  app.use('/app', express.static(path.join(__dirname, '..', 'public')));

  // Health check (no auth required)
  app.use('/health', healthRouter);

  return app;
}
