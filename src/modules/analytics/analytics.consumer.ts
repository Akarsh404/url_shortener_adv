import { ConsumeMessage } from 'amqplib';
import { rabbitmqClient, ANALYTICS_QUEUE } from '../../infrastructure/rabbitmq/rabbitmq.client';
import { analyticsRepository } from './analytics.repository';
import { ClickEventMessage } from './analytics.publisher';
import { logger } from '../../config/logger';

class AnalyticsConsumer {
  /**
   * Start consuming click events from RabbitMQ.
   * Each message is persisted to the ClickEvent table in PostgreSQL.
   *
   * Error handling:
   * - Parse errors: message is nacked (sent to DLQ after retries)
   * - Database errors: message is nacked and requeued for retry
   * - After 3 failed retries, message goes to dead-letter queue
   */
  async start(): Promise<void> {
    await rabbitmqClient.consume(
      ANALYTICS_QUEUE,
      async (msg: ConsumeMessage) => {
        const content = msg.content.toString();
        let event: ClickEventMessage;

        try {
          event = JSON.parse(content) as ClickEventMessage;
        } catch (parseError) {
          logger.error({ err: parseError, content }, 'Failed to parse analytics message');
          throw parseError; // Will be nacked
        }

        await analyticsRepository.createClickEvent({
          urlId: event.urlId,
          clickedAt: new Date(event.clickedAt),
          userAgent: event.userAgent,
          referrer: event.referrer,
          ipHash: event.ipHash,
        });

        logger.debug({ urlId: event.urlId }, 'Click event persisted');
      },
      { prefetch: 20 },
    );
  }
}

export const analyticsConsumer = new AnalyticsConsumer();
