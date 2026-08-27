import { Router } from 'express';
import { urlController } from './url.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { urlCreateRateLimiter } from '../../middleware/rateLimit.middleware';
import {
  createUrlSchema,
  updateUrlSchema,
  getUrlSchema,
  listUrlsSchema,
} from './url.schemas';

export const urlRouter = Router();

// All URL management routes require authentication
urlRouter.use(authMiddleware);

urlRouter.post(
  '/',
  urlCreateRateLimiter,
  validate(createUrlSchema),
  (req, res, next) => urlController.create(req, res, next),
);

urlRouter.get(
  '/',
  validate(listUrlsSchema),
  (req, res, next) => urlController.list(req, res, next),
);

urlRouter.get(
  '/:id',
  validate(getUrlSchema),
  (req, res, next) => urlController.getById(req, res, next),
);

urlRouter.put(
  '/:id',
  validate(updateUrlSchema),
  (req, res, next) => urlController.update(req, res, next),
);

urlRouter.delete(
  '/:id',
  validate(getUrlSchema),
  (req, res, next) => urlController.delete(req, res, next),
);
