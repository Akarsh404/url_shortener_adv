import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  RABBITMQ_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_URL_CREATE_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_URL_CREATE_MAX: z.coerce.number().default(20),
  RATE_LIMIT_REDIRECT_WINDOW_MS: z.coerce.number().default(1_000),
  RATE_LIMIT_REDIRECT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_GENERAL_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().default(100),

  CORS_ORIGIN: z.string().default('*'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const missing = Object.entries(formatted)
      .filter(([key, val]) => key !== '_errors' && val && typeof val === 'object' && '_errors' in val)
      .map(([key, val]) => {
        const errors = (val as { _errors: string[] })._errors;
        return `  ${key}: ${errors.join(', ')}`;
      })
      .join('\n');
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
