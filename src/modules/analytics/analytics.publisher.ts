import { rabbitmqClient, ANALYTICS_QUEUE } from '../../infrastructure/rabbitmq/rabbitmq.client';
import { logger } from '../../config/logger';

export interface ClickEventMessage {
  urlId: string;
  clickedAt: string;
  userAgent: string | null;
  referrer: string | null;
  ipHash: string | null;
}

class AnalyticsPublisher {
  /**
   * Publish a click event to RabbitMQ for async processing.
   * Returns false if RabbitMQ is unavailable — the redirect still succeeds.
   */
  async publishClickEvent(event: ClickEventMessage): Promise<boolean> {
    const published = await rabbitmqClient.publish(ANALYTICS_QUEUE, event);

    if (!published) {
      logger.warn(
        { urlId: event.urlId },
        'Analytics event not published — RabbitMQ unavailable. Event will be lost.',
      );
    }

    return published;
  }
}

export const analyticsPublisher = new AnalyticsPublisher();
