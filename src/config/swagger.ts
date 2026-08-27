import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Shortify — URL Shortener API',
    description:
      'A production-quality URL shortening service built with Node.js, TypeScript, Express, PostgreSQL, Redis, and RabbitMQ.',
    version: '1.0.0',
    contact: {
      name: 'Shortify API',
    },
  },
  servers: [
    {
      url: 'http://localhost:8080',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /api/v1/auth/login',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: {
            type: 'string',
            minLength: 8,
            example: 'StrongPassword123!',
            description: 'Must contain uppercase, lowercase, and digit',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'StrongPassword123!' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'integer', example: 900, description: 'Seconds until access token expires' },
            },
          },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      CreateUrlRequest: {
        type: 'object',
        required: ['originalUrl'],
        properties: {
          originalUrl: { type: 'string', format: 'uri', example: 'https://example.com/very/long/path' },
          customAlias: { type: 'string', example: 'my-link', description: 'Optional custom alias (3-50 chars, alphanumeric with - and _)' },
          expiresAt: { type: 'string', format: 'date-time', description: 'Optional expiration date (ISO 8601)' },
        },
      },
      UrlResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shortCode: { type: 'string', example: 'aB82xQ7' },
              shortUrl: { type: 'string', example: 'http://localhost:8080/aB82xQ7' },
              originalUrl: { type: 'string', format: 'uri' },
              customAlias: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
      UpdateUrlRequest: {
        type: 'object',
        properties: {
          originalUrl: { type: 'string', format: 'uri' },
          isActive: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      UrlListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/UrlResponse/properties/data' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 150 },
              totalPages: { type: 'integer', example: 8 },
            },
          },
        },
      },
      AnalyticsSummary: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              totalClicks: { type: 'integer', example: 1240 },
              clicksLast24Hours: { type: 'integer', example: 87 },
              clicksLast7Days: { type: 'integer', example: 430 },
              clicksLast30Days: { type: 'integer', example: 1102 },
            },
          },
        },
      },
      DailyAnalytics: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date', example: '2026-08-20' },
                clicks: { type: 'integer', example: 42 },
              },
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          version: { type: 'string' },
          checks: {
            type: 'object',
            properties: {
              database: { type: 'object', properties: { status: { type: 'string' }, latencyMs: { type: 'number' } } },
              redis: { type: 'object', properties: { status: { type: 'string' }, latencyMs: { type: 'number' } } },
              rabbitmq: { type: 'object', properties: { status: { type: 'string' } } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the health status of the application and its dependencies.',
        responses: {
          '200': { description: 'Service is healthy or degraded', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
          '503': { description: 'Service is unhealthy' },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Create a new user account with email and password.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          '201': { description: 'User created successfully' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Email already exists' },
          '429': { description: 'Too many requests' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login',
        description: 'Authenticate with email and password. Returns JWT access and refresh tokens.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } } },
          '401': { description: 'Invalid credentials' },
          '429': { description: 'Too many requests' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Exchange a valid refresh token for a new access/refresh token pair. The old refresh token is revoked (rotation).',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } } },
        responses: {
          '200': { description: 'Tokens refreshed', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } } },
          '401': { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout',
        description: 'Revoke the provided refresh token.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } } },
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/api/v1/urls': {
      post: {
        tags: ['URLs'],
        summary: 'Create a short URL',
        description: 'Shorten a URL with an optional custom alias and expiration date.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUrlRequest' } } } },
        responses: {
          '201': { description: 'URL created', content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlResponse' } } } },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '409': { description: 'Alias already exists' },
          '429': { description: 'Too many requests' },
        },
      },
      get: {
        tags: ['URLs'],
        summary: 'List your URLs',
        description: 'Get a paginated list of your shortened URLs with filtering, sorting, and search.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'shortCode'], default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in URL, short code, or alias' },
          { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'expired', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: {
          '200': { description: 'URL list', content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlListResponse' } } } },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/urls/{id}': {
      get: {
        tags: ['URLs'],
        summary: 'Get URL details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'URL details', content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlResponse' } } } },
          '401': { description: 'Unauthorized' },
          '404': { description: 'URL not found' },
        },
      },
      put: {
        tags: ['URLs'],
        summary: 'Update a URL',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUrlRequest' } } } },
        responses: {
          '200': { description: 'URL updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlResponse' } } } },
          '401': { description: 'Unauthorized' },
          '404': { description: 'URL not found' },
        },
      },
      delete: {
        tags: ['URLs'],
        summary: 'Delete a URL',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'URL deleted' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'URL not found' },
        },
      },
    },
    '/{shortCode}': {
      get: {
        tags: ['Redirect'],
        summary: 'Redirect to original URL',
        description: 'Resolves a short code and redirects to the original URL. This is the public-facing endpoint.',
        parameters: [{ name: 'shortCode', in: 'path', required: true, schema: { type: 'string' }, example: 'aB82xQ7' }],
        responses: {
          '302': { description: 'Redirect to original URL' },
          '404': { description: 'Short URL not found, expired, or inactive' },
        },
      },
    },
    '/api/v1/urls/{id}/analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'Get URL analytics summary',
        description: 'Returns click count aggregations for the last 24 hours, 7 days, and 30 days.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Analytics summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/AnalyticsSummary' } } } },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Not the URL owner' },
          '404': { description: 'URL not found' },
        },
      },
    },
    '/api/v1/urls/{id}/analytics/daily': {
      get: {
        tags: ['Analytics'],
        summary: 'Get daily click breakdown',
        description: 'Returns daily click counts for the specified number of days.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30, maximum: 365 } },
        ],
        responses: {
          '200': { description: 'Daily analytics', content: { 'application/json': { schema: { $ref: '#/components/schemas/DailyAnalytics' } } } },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Not the URL owner' },
          '404': { description: 'URL not found' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express): void {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Shortify API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
}
