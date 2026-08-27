import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const REQUEST_ID_HEADER = 'x-request-id';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to attach a unique request ID to each request.
 * Reuses client-supplied ID if it's a valid UUID, otherwise generates one.
 * Returns the ID in the X-Request-ID response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.headers[REQUEST_ID_HEADER] as string | undefined;
  const requestId = clientId && UUID_REGEX.test(clientId) ? clientId : uuidv4();

  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
