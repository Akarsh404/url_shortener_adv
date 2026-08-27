import { prisma } from '../../infrastructure/database/prisma.client';

export interface DailyClickCount {
  date: string;
  clicks: number;
}

export interface AnalyticsSummary {
  totalClicks: number;
  clicksLast24Hours: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
}

export class AnalyticsRepository {
  async createClickEvent(data: {
    urlId: string;
    clickedAt: Date;
    userAgent: string | null;
    referrer: string | null;
    ipHash: string | null;
  }): Promise<void> {
    await prisma.clickEvent.create({ data });
  }

  /**
   * Get aggregated analytics summary using database-side aggregation.
   * Uses COUNT with date filtering — never loads raw events into Node.js.
   */
  async getAnalyticsSummary(urlId: string): Promise<AnalyticsSummary> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Execute all counts in a single query using raw SQL for efficiency
    const result = await prisma.$queryRaw<
      Array<{
        total_clicks: bigint;
        clicks_24h: bigint;
        clicks_7d: bigint;
        clicks_30d: bigint;
      }>
    >`
      SELECT
        COUNT(*) as total_clicks,
        COUNT(*) FILTER (WHERE clicked_at >= ${last24h}) as clicks_24h,
        COUNT(*) FILTER (WHERE clicked_at >= ${last7d}) as clicks_7d,
        COUNT(*) FILTER (WHERE clicked_at >= ${last30d}) as clicks_30d
      FROM click_events
      WHERE url_id = ${urlId}::uuid
    `;

    const row = result[0];
    return {
      totalClicks: Number(row.total_clicks),
      clicksLast24Hours: Number(row.clicks_24h),
      clicksLast7Days: Number(row.clicks_7d),
      clicksLast30Days: Number(row.clicks_30d),
    };
  }

  /**
   * Get daily click counts using PostgreSQL GROUP BY DATE aggregation.
   * Returns the last 30 days by default.
   */
  async getDailyAnalytics(urlId: string, days = 30): Promise<DailyClickCount[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.$queryRaw<Array<{ date: Date; clicks: bigint }>>`
      SELECT
        DATE(clicked_at) as date,
        COUNT(*) as clicks
      FROM click_events
      WHERE url_id = ${urlId}::uuid
        AND clicked_at >= ${since}
      GROUP BY DATE(clicked_at)
      ORDER BY date DESC
    `;

    return result.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      clicks: Number(row.clicks),
    }));
  }

  /**
   * Check if a URL exists (for authorization).
   */
  async getUrlOwnerId(urlId: string): Promise<string | null> {
    const url = await prisma.url.findUnique({
      where: { id: urlId },
      select: { userId: true },
    });
    return url?.userId ?? null;
  }
}

export const analyticsRepository = new AnalyticsRepository();
