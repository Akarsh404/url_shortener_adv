import { analyticsRepository, AnalyticsRepository } from './analytics.repository';
import { ForbiddenError, NotFoundError, ErrorCode } from '../../utils/errors';

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getAnalytics(urlId: string, userId: string) {
    await this.verifyOwnership(urlId, userId);
    return this.repo.getAnalyticsSummary(urlId);
  }

  async getDailyAnalytics(urlId: string, userId: string, days = 30) {
    await this.verifyOwnership(urlId, userId);
    return this.repo.getDailyAnalytics(urlId, days);
  }

  private async verifyOwnership(urlId: string, userId: string): Promise<void> {
    const ownerId = await this.repo.getUrlOwnerId(urlId);
    if (!ownerId) {
      throw new NotFoundError('URL not found', ErrorCode.URL_NOT_FOUND);
    }
    if (ownerId !== userId) {
      throw new ForbiddenError('You do not have permission to view analytics for this URL');
    }
  }
}

export const analyticsService = new AnalyticsService(analyticsRepository);
