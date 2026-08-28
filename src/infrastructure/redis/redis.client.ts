import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

class RedisClient {
  private client: Redis | null = null;
  private isAvailable = false;
  private everConnected = false;

  async connect(): Promise<void> {
    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 10) return null; // Stop retrying after 10 attempts
          return Math.min(times * 200, 5000);
        },
        lazyConnect: true,
        enableReadyCheck: true,
      });

      this.client.on('connect', () => {
        this.isAvailable = true;
        this.everConnected = true;
        logger.info('Connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isAvailable = false;
        logger.error({ err }, 'Redis connection error');
      });

      this.client.on('close', () => {
        this.isAvailable = false;
        logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        logger.info('Reconnecting to Redis...');
      });

      this.client.on('ready', () => {
        this.isAvailable = true;
      });

      await this.client.connect();
    } catch (error) {
      this.isAvailable = false;
      logger.error({ err: error }, 'Failed to connect to Redis — operating without cache');
    }
  }

  getClient(): Redis | null {
    return this.isAvailable ? this.client : null;
  }

  isReady(): boolean {
    return this.isAvailable;
  }

  wasEverConnected(): boolean {
    return this.everConnected;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isAvailable = false;
      logger.info('Disconnected from Redis');
    }
  }

  /**
   * Get a value from Redis. Returns null if Redis is unavailable or key doesn't exist.
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'Redis GET failed — falling back');
      return null;
    }
  }

  /**
   * Set a value in Redis with optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable || !this.client) return;
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.warn({ err: error, key }, 'Redis SET failed');
    }
  }

  /**
   * Delete a key from Redis.
   */
  async del(key: string): Promise<void> {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'Redis DEL failed');
    }
  }
}

export const redisClient = new RedisClient();
