import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.schemas';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  (req, res, next) => authController.register(req, res, next),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  (req, res, next) => authController.login(req, res, next),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  (req, res, next) => authController.refresh(req, res, next),
);

authRouter.post(
  '/logout',
  validate(logoutSchema),
  (req, res, next) => authController.logout(req, res, next),
);
