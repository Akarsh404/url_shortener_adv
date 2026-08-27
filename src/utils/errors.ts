export enum ErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  REFRESH_TOKEN_REQUIRED = 'REFRESH_TOKEN_REQUIRED',

  // URL errors
  URL_NOT_FOUND = 'URL_NOT_FOUND',
  URL_EXPIRED = 'URL_EXPIRED',
  URL_INACTIVE = 'URL_INACTIVE',
  ALIAS_ALREADY_EXISTS = 'ALIAS_ALREADY_EXISTS',
  ALIAS_RESERVED = 'ALIAS_RESERVED',
  SHORT_CODE_GENERATION_FAILED = 'SHORT_CODE_GENERATION_FAILED',
  INVALID_URL = 'INVALID_URL',
  UNSAFE_URL_PROTOCOL = 'UNSAFE_URL_PROTOCOL',

  // General errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = ErrorCode.VALIDATION_ERROR, details?: unknown) {
    super(message, 400, code, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = ErrorCode.UNAUTHORIZED) {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, ErrorCode.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = ErrorCode.NOT_FOUND) {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = ErrorCode.CONFLICT) {
    super(message, 409, code);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, ErrorCode.INTERNAL_ERROR, false);
  }
}
