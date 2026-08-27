import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Express middleware factory that validates request body, query, and params
 * against a Zod schema. Passes validated & typed data forward.
 *
 * Note: In Express v5, req.query and req.params are read-only getters.
 * We only reassign req.body (which is still writable).
 * Query and params are validated but not reassigned.
 */
export function validate(schema: z.ZodType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      const result = parsed as { body?: unknown; query?: unknown; params?: unknown };
      // Only reassign body — Express v5 makes query/params read-only
      if (result.body) req.body = result.body;
      next();
    } catch (error) {
      next(error);
    }
  };
}
