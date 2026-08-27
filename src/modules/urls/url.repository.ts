import { prisma } from '../../infrastructure/database/prisma.client';
import { Url, Prisma } from '@prisma/client';

export interface UrlListOptions {
  userId: string;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
  isActive?: boolean;
  expired?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class UrlRepository {
  async create(data: {
    userId: string;
    shortCode: string;
    originalUrl: string;
    customAlias?: string;
    expiresAt?: Date;
  }): Promise<Url> {
    return prisma.url.create({ data });
  }

  async findByShortCode(shortCode: string): Promise<Url | null> {
    return prisma.url.findUnique({ where: { shortCode } });
  }

  async findByCustomAlias(customAlias: string): Promise<Url | null> {
    return prisma.url.findUnique({ where: { customAlias } });
  }

  async findById(id: string): Promise<Url | null> {
    return prisma.url.findUnique({ where: { id } });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Url | null> {
    return prisma.url.findFirst({ where: { id, userId } });
  }

  /**
   * Find a URL by short code OR custom alias.
   * Used by the redirect endpoint.
   */
  async findByCodeOrAlias(code: string): Promise<Url | null> {
    return prisma.url.findFirst({
      where: {
        OR: [{ shortCode: code }, { customAlias: code }],
      },
    });
  }

  async update(
    id: string,
    data: Partial<Pick<Url, 'originalUrl' | 'isActive' | 'expiresAt'>>,
  ): Promise<Url> {
    return prisma.url.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.url.delete({ where: { id } });
  }

  async listByUser(options: UrlListOptions): Promise<PaginatedResult<Url>> {
    const { userId, page, limit, sort, order, search, isActive, expired } = options;

    const where: Prisma.UrlWhereInput = { userId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (expired === true) {
      where.expiresAt = { lte: new Date() };
    } else if (expired === false) {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { originalUrl: { contains: search, mode: 'insensitive' } },
            { shortCode: { contains: search, mode: 'insensitive' } },
            { customAlias: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.url.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.url.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const urlRepository = new UrlRepository();
