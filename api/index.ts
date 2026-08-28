// Minimal Vercel serverless entry — debug-friendly
import express from 'express';

let app: express.Express | null = null;

async function getApp(): Promise<express.Express> {
  if (app) return app;

  // Import dynamically to catch import-time errors
  try {
    const { createApp } = await import('../src/app');
    const { connectDatabase } = await import('../src/infrastructure/database/prisma.client');
    const { errorMiddleware, notFoundMiddleware } = await import('../src/middleware/error.middleware');
    const { authRouter } = await import('../src/modules/auth/auth.routes');
    const { urlRouter } = await import('../src/modules/urls/url.routes');
    const { redirectRouter } = await import('../src/modules/urls/redirect.routes');
    const { analyticsRouter } = await import('../src/modules/analytics/analytics.routes');
    const { setupSwagger } = await import('../src/config/swagger');

    app = createApp();

    // Connect to database
    try {
      await connectDatabase();
    } catch (err) {
      console.error('DB connect failed:', err);
    }

    // Set up routes
    setupSwagger(app);
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/urls', urlRouter);
    app.use('/api/v1/urls', analyticsRouter);
    app.use('/', redirectRouter);
    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
  } catch (err) {
    console.error('FATAL: App initialization failed:', err);
    // Return a minimal error app
    const errorApp = express();
    errorApp.use((_req, res) => {
      res.status(500).json({
        error: 'App initialization failed',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });
    return errorApp;
  }
}

export default async function handler(req: express.Request, res: express.Response) {
  const application = await getApp();
  return application(req, res);
}
