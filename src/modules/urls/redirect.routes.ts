import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { urlService } from './url.service';
import { analyticsPublisher } from '../analytics/analytics.publisher';
import { logger } from '../../config/logger';
import { redirectSchema } from './url.schemas';
import { validate } from '../../middleware/validate.middleware';

export const redirectRouter = Router();

/**
 * GET /:shortCode
 *
 * The most performance-critical endpoint.
 *
 * Flow:
 * 1. Validate short code format
 * 2. Resolve URL (Redis cache → PostgreSQL fallback)
 * 3. Send 302 redirect immediately
 * 4. Publish analytics event asynchronously (fire-and-forget)
 *
 * Uses HTTP 302 (Found) instead of 301 (Moved Permanently) because:
 * - 301 is cached by browsers, preventing future analytics tracking
 * - 302 allows URL updates to take effect immediately
 * - 302 allows expired/deactivated URLs to stop redirecting
 * - For SEO use cases, 301 could be offered as an option in the future
 */
redirectRouter.get(
  '/:shortCode',
  validate(redirectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shortCode = req.params.shortCode as string;
      const resolved = await urlService.resolveUrl(shortCode);

      // Send redirect immediately — do NOT wait for analytics
      res.redirect(302, resolved.originalUrl);

      // Publish analytics event asynchronously (fire-and-forget)
      // Errors here must NOT affect the redirect response
      const userAgent = req.headers['user-agent'];
      const referrer = req.headers['referer'] || req.headers['referrer'];

      analyticsPublisher
        .publishClickEvent({
          urlId: resolved.id,
          userAgent: typeof userAgent === 'string' ? userAgent : null,
          referrer: typeof referrer === 'string' ? referrer : null,
          ipHash: hashIp(req.ip || req.socket.remoteAddress || ''),
          clickedAt: new Date().toISOString(),
        })
        .catch((err) => {
          logger.error({ err, urlId: resolved.id }, 'Failed to publish analytics event');
        });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Hash the IP address for privacy.
 * We store a SHA-256 hash instead of the raw IP to enable
 * unique visitor counting without storing personally identifiable information.
 */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}
