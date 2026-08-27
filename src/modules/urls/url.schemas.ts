import { z } from 'zod';

const RESERVED_ALIASES = new Set([
  'api',
  'auth',
  'admin',
  'health',
  'metrics',
  'swagger',
  'docs',
  'login',
  'register',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_URL_LENGTH = 2048;
const MAX_ALIAS_LENGTH = 50;
const MIN_ALIAS_LENGTH = 3;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export const createUrlSchema = z.object({
  body: z.object({
    originalUrl: z
      .string()
      .min(1, 'URL is required')
      .max(MAX_URL_LENGTH, `URL must be at most ${MAX_URL_LENGTH} characters`)
      .refine(isValidUrl, {
        message: 'Invalid URL. Only http:// and https:// protocols are allowed.',
      }),
    customAlias: z
      .string()
      .min(MIN_ALIAS_LENGTH, `Alias must be at least ${MIN_ALIAS_LENGTH} characters`)
      .max(MAX_ALIAS_LENGTH, `Alias must be at most ${MAX_ALIAS_LENGTH} characters`)
      .regex(ALIAS_REGEX, 'Alias may only contain letters, numbers, hyphens, and underscores')
      .refine((alias) => !RESERVED_ALIASES.has(alias.toLowerCase()), {
        message: 'This alias is reserved and cannot be used',
      })
      .optional(),
    expiresAt: z
      .string()
      .datetime({ message: 'Invalid date format. Use ISO 8601.' })
      .refine((date) => new Date(date) > new Date(), {
        message: 'Expiration date must be in the future',
      })
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateUrlSchema = z.object({
  body: z.object({
    originalUrl: z
      .string()
      .min(1, 'URL is required')
      .max(MAX_URL_LENGTH, `URL must be at most ${MAX_URL_LENGTH} characters`)
      .refine(isValidUrl, {
        message: 'Invalid URL. Only http:// and https:// protocols are allowed.',
      })
      .optional(),
    isActive: z.boolean().optional(),
    expiresAt: z
      .string()
      .datetime({ message: 'Invalid date format. Use ISO 8601.' })
      .nullable()
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid('Invalid URL ID'),
  }),
});

export const getUrlSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid('Invalid URL ID'),
  }),
});

export const listUrlsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['createdAt', 'updatedAt', 'shortCode']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(200).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    expired: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  }),
  params: z.object({}).optional(),
});

export const redirectSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    shortCode: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid short code format'),
  }),
});

export type CreateUrlInput = z.infer<typeof createUrlSchema>['body'];
export type UpdateUrlInput = z.infer<typeof updateUrlSchema>['body'];
export type ListUrlsQuery = z.infer<typeof listUrlsSchema>['query'];

export { RESERVED_ALIASES, ALIAS_REGEX, MAX_URL_LENGTH, MAX_ALIAS_LENGTH, MIN_ALIAS_LENGTH };
