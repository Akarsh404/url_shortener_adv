import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';
import { UnauthorizedError } from '../utils/errors';

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches userId to the request.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed authorization header');
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    if (!token) {
      throw new UnauthorizedError('Access token is required');
    }

    const payload = authService.verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}
