import { Url } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { urlRepository, UrlRepository, PaginatedResult } from './url.repository';
import { generateShortCode, MAX_RETRIES } from './shortCode.service';
import { redisClient } from '../../infrastructure/redis/redis.client';
import { CreateUrlInput, UpdateUrlInput, ListUrlsQuery, RESERVED_ALIASES } from './url.schemas';
import {
  NotFoundError,
  ConflictError,
  AppError,
  ErrorCode,
} from '../../utils/errors';

const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_PREFIX = 'url:';

interface UrlResponse {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  customAlias: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
}

interface CachedUrl {
  originalUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  id: string;
}

export class UrlService {
  constructor(private readonly repo: UrlRepository) {}

  /**
   * Create a new shortened URL with collision-safe short code generation.
   *
   * Strategy:
   * 1. Generate a random Base62 short code
   * 2. Attempt database INSERT
   * 3. If UNIQUE constraint violation, generate a new code and retry
   * 4. After MAX_RETRIES failures, return an error
   *
   * The database UNIQUE constraint is the ultimate source of truth for uniqueness.
   * This handles concurrent requests safely — if two requests generate the same code,
   * only one INSERT will succeed, and the other will retry with a new code.
   */
  async createUrl(userId: string, input: CreateUrlInput): Promise<UrlResponse> {
    // Check custom alias availability
    if (input.customAlias) {
      if (RESERVED_ALIASES.has(input.customAlias.toLowerCase())) {
        throw new ConflictError(
          'This alias is reserved and cannot be used',
          ErrorCode.ALIAS_RESERVED,
        );
      }

      const existingAlias = await this.repo.findByCustomAlias(input.customAlias);
      if (existingAlias) {
        throw new ConflictError('This alias is already in use', ErrorCode.ALIAS_ALREADY_EXISTS);
      }

      // Also check if alias conflicts with an existing short code
      const existingCode = await this.repo.findByShortCode(input.customAlias);
      if (existingCode) {
        throw new ConflictError('This alias conflicts with an existing short code', ErrorCode.ALIAS_ALREADY_EXISTS);
      }
    }

    // Generate short code with collision retry
    let url: Url | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const shortCode = generateShortCode();

      try {
        url = await this.repo.create({
          userId,
          shortCode,
          originalUrl: input.originalUrl,
          customAlias: input.customAlias,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        });
        break; // Success
      } catch (error: unknown) {
        lastError = error;
        // Check if it's a unique constraint violation (Prisma P2002)
        if (this.isUniqueConstraintError(error)) {
          logger.warn(
            { attempt: attempt + 1, shortCode },
            'Short code collision — retrying with new code',
          );
          continue;
        }
        throw error; // Non-collision error, rethrow
      }
    }

    if (!url) {
      logger.error({ lastError }, 'Failed to generate unique short code after max retries');
      throw new AppError(
        'Unable to generate a unique short code. Please try again.',
        500,
        ErrorCode.SHORT_CODE_GENERATION_FAILED,
        true,
      );
    }

    return this.toResponse(url);
  }

  async getUrl(id: string, userId: string): Promise<UrlResponse> {
    const url = await this.repo.findByIdAndUserId(id, userId);
    if (!url) {
      throw new NotFoundError('URL not found', ErrorCode.URL_NOT_FOUND);
    }
    return this.toResponse(url);
  }

  async listUrls(userId: string, query: ListUrlsQuery): Promise<PaginatedResult<UrlResponse>> {
    const result = await this.repo.listByUser({
      userId,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
      search: query.search,
      isActive: query.isActive,
      expired: query.expired,
    });

    return {
      data: result.data.map((url) => this.toResponse(url)),
      pagination: result.pagination,
    };
  }

  async updateUrl(id: string, userId: string, input: UpdateUrlInput): Promise<UrlResponse> {
    const url = await this.repo.findByIdAndUserId(id, userId);
    if (!url) {
      throw new NotFoundError('URL not found', ErrorCode.URL_NOT_FOUND);
    }

    const updateData: Partial<Pick<Url, 'originalUrl' | 'isActive' | 'expiresAt'>> = {};

    if (input.originalUrl !== undefined) {
      updateData.originalUrl = input.originalUrl;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }
    if (input.expiresAt !== undefined) {
      updateData.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    const updated = await this.repo.update(id, updateData);

    // Invalidate cache for both shortCode and customAlias
    await this.invalidateCache(url.shortCode);
    if (url.customAlias) {
      await this.invalidateCache(url.customAlias);
    }

    return this.toResponse(updated);
  }

  async deleteUrl(id: string, userId: string): Promise<void> {
    const url = await this.repo.findByIdAndUserId(id, userId);
    if (!url) {
      throw new NotFoundError('URL not found', ErrorCode.URL_NOT_FOUND);
    }

    await this.repo.delete(id);

    // Invalidate cache
    await this.invalidateCache(url.shortCode);
    if (url.customAlias) {
      await this.invalidateCache(url.customAlias);
    }
  }

  /**
   * Resolve a short code to the original URL for redirect.
   * Uses cache-aside pattern:
   * 1. Check Redis cache
   * 2. On miss, query PostgreSQL
   * 3. Populate cache on miss
   * 4. Validate active/expiration state
   *
   * If Redis is unavailable, gracefully falls back to PostgreSQL.
   */
  async resolveUrl(code: string): Promise<{ id: string; originalUrl: string }> {
    // Try cache first
    const cached = await this.getFromCache(code);
    if (cached) {
      // Validate state even from cache — don't trust cache TTL alone
      if (!cached.isActive) {
        throw new NotFoundError('This URL has been deactivated', ErrorCode.URL_INACTIVE);
      }
      if (cached.expiresAt && new Date(cached.expiresAt) <= new Date()) {
        // Expired — invalidate cache and return error
        await this.invalidateCache(code);
        throw new NotFoundError('This URL has expired', ErrorCode.URL_EXPIRED);
      }
      return { id: cached.id, originalUrl: cached.originalUrl };
    }

    // Cache miss — query database
    const url = await this.repo.findByCodeOrAlias(code);
    if (!url) {
      throw new NotFoundError('The requested short URL does not exist', ErrorCode.URL_NOT_FOUND);
    }

    if (!url.isActive) {
      throw new NotFoundError('This URL has been deactivated', ErrorCode.URL_INACTIVE);
    }

    if (url.expiresAt && url.expiresAt <= new Date()) {
      throw new NotFoundError('This URL has expired', ErrorCode.URL_EXPIRED);
    }

    // Populate cache
    await this.setInCache(code, {
      originalUrl: url.originalUrl,
      isActive: url.isActive,
      expiresAt: url.expiresAt ? url.expiresAt.toISOString() : null,
      id: url.id,
    });

    return { id: url.id, originalUrl: url.originalUrl };
  }

  private async getFromCache(code: string): Promise<CachedUrl | null> {
    const data = await redisClient.get(`${CACHE_PREFIX}${code}`);
    if (!data) return null;

    try {
      return JSON.parse(data) as CachedUrl;
    } catch {
      return null;
    }
  }

  private async setInCache(code: string, data: CachedUrl): Promise<void> {
    // If the URL has an expiry, set cache TTL to whichever is shorter:
    // the standard TTL or the time until expiry
    let ttl = CACHE_TTL_SECONDS;
    if (data.expiresAt) {
      const timeUntilExpiry = Math.floor(
        (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
      );
      if (timeUntilExpiry > 0) {
        ttl = Math.min(ttl, timeUntilExpiry);
      }
    }

    await redisClient.set(`${CACHE_PREFIX}${code}`, JSON.stringify(data), ttl);
  }

  private async invalidateCache(code: string): Promise<void> {
    await redisClient.del(`${CACHE_PREFIX}${code}`);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    // Prisma unique constraint violation code
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  private toResponse(url: Url): UrlResponse {
    const shortUrl = url.customAlias
      ? `${env.BASE_URL}/${url.customAlias}`
      : `${env.BASE_URL}/${url.shortCode}`;

    return {
      id: url.id,
      shortCode: url.shortCode,
      shortUrl,
      originalUrl: url.originalUrl,
      customAlias: url.customAlias,
      createdAt: url.createdAt,
      updatedAt: url.updatedAt,
      expiresAt: url.expiresAt,
      isActive: url.isActive,
    };
  }
}

export const urlService = new UrlService(urlRepository);
