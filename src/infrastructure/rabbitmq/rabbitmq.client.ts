import amqplib, { ConsumeMessage } from 'amqplib';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface QueueConfig {
  queue: string;
  exchange: string;
  routingKey: string;
  deadLetterExchange?: string;
  deadLetterQueue?: string;
}

export const ANALYTICS_QUEUE: QueueConfig = {
  queue: 'analytics.clicks',
  exchange: 'analytics',
  routingKey: 'click.created',
  deadLetterExchange: 'analytics.dlx',
  deadLetterQueue: 'analytics.clicks.dlq',
};

class RabbitMQClient {
  private connection: amqplib.ChannelModel | null = null;
  private publishChannel: amqplib.Channel | null = null;
  private consumeChannel: amqplib.Channel | null = null;
  private connected = false;
  private reconnectAttempts = 0;

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(env.RABBITMQ_URL);
      this.connected = true;
      this.reconnectAttempts = 0;

      this.connection.on('error', (err: Error) => {
        logger.error({ err }, 'RabbitMQ connection error');
        this.connected = false;
      });

      this.connection.on('close', () => {
        this.connected = false;
        logger.warn('RabbitMQ connection closed');
        this.scheduleReconnect();
      });

      // Create channels
      this.publishChannel = await this.connection.createChannel();
      this.consumeChannel = await this.connection.createChannel();

      // Set up exchanges and queues
      await this.setupTopology();

      logger.info('Connected to RabbitMQ');
    } catch (error) {
      this.connected = false;
      logger.error({ err: error }, 'Failed to connect to RabbitMQ — analytics will be unavailable');
      this.scheduleReconnect();
    }
  }

  private async setupTopology(): Promise<void> {
    if (!this.publishChannel) return;

    const config = ANALYTICS_QUEUE;

    // Dead letter exchange and queue
    if (config.deadLetterExchange && config.deadLetterQueue) {
      await this.publishChannel.assertExchange(config.deadLetterExchange, 'direct', {
        durable: true,
      });
      await this.publishChannel.assertQueue(config.deadLetterQueue, { durable: true });
      await this.publishChannel.bindQueue(
        config.deadLetterQueue,
        config.deadLetterExchange,
        config.routingKey,
      );
    }

    // Main exchange and queue
    await this.publishChannel.assertExchange(config.exchange, 'direct', { durable: true });
    await this.publishChannel.assertQueue(config.queue, {
      durable: true,
      arguments: {
        ...(config.deadLetterExchange
          ? { 'x-dead-letter-exchange': config.deadLetterExchange }
          : {}),
        ...(config.deadLetterExchange
          ? { 'x-dead-letter-routing-key': config.routingKey }
          : {}),
        'x-message-ttl': 86_400_000, // 24 hours
      },
    });
    await this.publishChannel.bindQueue(config.queue, config.exchange, config.routingKey);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max RabbitMQ reconnect attempts reached — giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    logger.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling RabbitMQ reconnect');

    setTimeout(() => {
      this.connect().catch((err) => {
        logger.error({ err }, 'RabbitMQ reconnect failed');
      });
    }, delay);
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Publish a message to an exchange. Returns false if RabbitMQ is unavailable.
   */
  async publish(config: QueueConfig, message: object): Promise<boolean> {
    if (!this.connected || !this.publishChannel) {
      logger.warn('RabbitMQ unavailable — message not published');
      return false;
    }

    try {
      const buffer = Buffer.from(JSON.stringify(message));
      this.publishChannel.publish(config.exchange, config.routingKey, buffer, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Math.floor(Date.now() / 1000),
      });
      return true;
    } catch (error) {
      logger.error({ err: error }, 'Failed to publish message to RabbitMQ');
      return false;
    }
  }

  /**
   * Consume messages from a queue.
   */
  async consume(
    config: QueueConfig,
    handler: (msg: ConsumeMessage) => Promise<void>,
    options: { prefetch?: number } = {},
  ): Promise<void> {
    if (!this.consumeChannel) {
      logger.warn('RabbitMQ consume channel not available');
      return;
    }

    const { prefetch = 10 } = options;
    await this.consumeChannel.prefetch(prefetch);

    await this.consumeChannel.consume(config.queue, async (msg) => {
      if (!msg) return;

      try {
        await handler(msg);
        this.consumeChannel?.ack(msg);
      } catch (error) {
        logger.error({ err: error }, 'Failed to process message');

        // Check retry count from headers
        const headers = msg.properties.headers as Record<string, unknown> | undefined;
        const retryCount = (headers?.['x-retry-count'] as number) || 0;

        if (retryCount >= 3) {
          // Send to DLQ after 3 retries
          logger.warn({ retryCount }, 'Max retries reached — sending to DLQ');
          this.consumeChannel?.nack(msg, false, false);
        } else {
          // Requeue with incremented retry count
          this.consumeChannel?.nack(msg, false, true);
        }
      }
    });

    logger.info({ queue: config.queue }, 'Started consuming messages');
  }

  async disconnect(): Promise<void> {
    try {
      if (this.publishChannel) await this.publishChannel.close();
      if (this.consumeChannel) await this.consumeChannel.close();
      if (this.connection) await this.connection.close();
      this.connected = false;
      logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      logger.error({ err: error }, 'Error disconnecting from RabbitMQ');
    }
  }
}

export const rabbitmqClient = new RabbitMQClient();
