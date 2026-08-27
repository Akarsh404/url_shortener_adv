import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../infrastructure/redis/redis.client';
import { RateLimitError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

/**
 * Redis-backed sliding window rate limiter.
 *
 * Strategy: Uses Redis INCR with PEXPIRE for a simple fixed-window counter.
 * The key includes the client IP and a time window identifier.
 *
 * If Redis is unavailable:
 * - Auth endpoints: DENY (fail closed) — protects against brute force
 * - Other endpoints: ALLOW (fail open) — graceful degradation
 */
function createRateLimiter(config: RateLimitConfig, failClosed = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = redisClient.getClient();

    if (!client) {
      if (failClosed) {
        logger.warn('Rate limiter: Redis unavailable, failing closed for security');
        next(new RateLimitError('Service temporarily unavailable. Please try again later.'));
        return;
      }
      // Fail open — allow the request through
      logger.warn('Rate limiter: Redis unavailable, failing open');
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const windowId = Math.floor(Date.now() / config.windowMs);
    const key = `ratelimit:${config.keyPrefix}:${ip}:${windowId}`;

    try {
      const count = await client.incr(key);

      if (count === 1) {
        // First request in this window — set expiry
        await client.pexpire(key, config.windowMs);
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
      res.setHeader(
        'X-RateLimit-Reset',
        new Date((windowId + 1) * config.windowMs).toISOString(),
      );

      if (count > config.maxRequests) {
        res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000));
        next(new RateLimitError('Too many requests. Please try again later.'));
        return;
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Rate limiter error');
      if (failClosed) {
        next(new RateLimitError('Service temporarily unavailable. Please try again later.'));
        return;
      }
      next(); // Fail open
    }
  };
}

// Auth endpoints — fail CLOSED (security-critical)
export const authRateLimiter = createRateLimiter(
  {
    windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_AUTH_MAX,
    keyPrefix: 'auth',
  },
  true,
);

// URL creation — fail OPEN
export const urlCreateRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_URL_CREATE_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_URL_CREATE_MAX,
  keyPrefix: 'url-create',
});

// General API — fail OPEN
export const generalRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_GENERAL_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_GENERAL_MAX,
  keyPrefix: 'general',
});
