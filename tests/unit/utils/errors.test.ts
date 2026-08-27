import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, RateLimitError, InternalError, ErrorCode } from '../../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError('Test error', 400, ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should support non-operational errors', () => {
      const error = new AppError('Fatal error', 500, ErrorCode.INTERNAL_ERROR, false);
      expect(error.isOperational).toBe(false);
    });

    it('should support details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new AppError('Error', 400, ErrorCode.VALIDATION_ERROR, true, details);
      expect(error.details).toEqual(details);
    });
  });

  describe('BadRequestError', () => {
    it('should have status 400', () => {
      const error = new BadRequestError('Bad request');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('UnauthorizedError', () => {
    it('should have status 401', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Authentication required');
    });

    it('should support custom message and code', () => {
      const error = new UnauthorizedError('Token expired', ErrorCode.TOKEN_EXPIRED);
      expect(error.message).toBe('Token expired');
      expect(error.code).toBe(ErrorCode.TOKEN_EXPIRED);
    });
  });

  describe('ForbiddenError', () => {
    it('should have status 403', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('NotFoundError', () => {
    it('should have status 404', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
    });

    it('should support custom error code', () => {
      const error = new NotFoundError('URL not found', ErrorCode.URL_NOT_FOUND);
      expect(error.code).toBe(ErrorCode.URL_NOT_FOUND);
    });
  });

  describe('ConflictError', () => {
    it('should have status 409', () => {
      const error = new ConflictError('Already exists');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RateLimitError', () => {
    it('should have status 429', () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    });
  });

  describe('InternalError', () => {
    it('should have status 500 and be non-operational', () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });
});
