import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';

export const analyticsRouter = Router();

const analyticsParamsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid URL ID'),
  }),
});

analyticsRouter.use(authMiddleware);

analyticsRouter.get(
  '/:id/analytics',
  validate(analyticsParamsSchema),
  (req, res, next) => analyticsController.getAnalytics(req, res, next),
);

analyticsRouter.get(
  '/:id/analytics/daily',
  validate(analyticsParamsSchema),
  (req, res, next) => analyticsController.getDailyAnalytics(req, res, next),
);
