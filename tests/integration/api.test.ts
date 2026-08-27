import request from 'supertest';
import { setupTestApp, teardownTestApp, cleanDatabase, isDatabaseAvailable } from './setup';
import { Express } from 'express';

let app: Express;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await cleanDatabase();
  await teardownTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
});

const conditionIt = (name: string, fn: () => Promise<void>) => {
  if (isDatabaseAvailable()) {
    it(name, fn);
  } else {
    it.skip(`[DB unavailable] ${name}`, fn);
  }
};

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    conditionIt('should register a new user', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.createdAt).toBeDefined();
      // Should NOT return password hash
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    conditionIt('should reject duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'AnotherPassword123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    conditionIt('should reject weak password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'weak',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    conditionIt('should reject invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'not-an-email',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    conditionIt('should login with valid credentials', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.expiresIn).toBeGreaterThan(0);
    });

    conditionIt('should reject invalid password', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    conditionIt('should reject non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    conditionIt('should refresh tokens', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: loginRes.body.data.refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // New refresh token should be different (rotation)
      expect(res.body.data.refreshToken).not.toBe(loginRes.body.data.refreshToken);
    });

    conditionIt('should reject reused refresh token (rotation detection)', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const oldRefreshToken = loginRes.body.data.refreshToken;

      // Use the refresh token once
      await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: oldRefreshToken,
      });

      // Try to reuse the old refresh token (should fail — it's been rotated)
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: oldRefreshToken,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    conditionIt('should revoke refresh token', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      const logoutRes = await request(app).post('/api/v1/auth/logout').send({
        refreshToken: loginRes.body.data.refreshToken,
      });

      expect(logoutRes.status).toBe(200);

      // Refresh token should no longer work
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: loginRes.body.data.refreshToken,
      });

      expect(refreshRes.status).toBe(401);
    });
  });
});

describe('URL API', () => {
  let accessToken: string;

  async function registerAndLogin(): Promise<string> {
    await request(app).post('/api/v1/auth/register').send({
      email: 'urltest@example.com',
      password: 'StrongPassword123!',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'urltest@example.com',
      password: 'StrongPassword123!',
    });

    return loginRes.body.data.accessToken;
  }

  beforeEach(async () => {
    if (isDatabaseAvailable()) {
      accessToken = await registerAndLogin();
    }
  });

  describe('POST /api/v1/urls', () => {
    conditionIt('should create a short URL', async () => {
      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com/very/long/path' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shortCode).toBeDefined();
      expect(res.body.data.shortUrl).toContain(res.body.data.shortCode);
      expect(res.body.data.originalUrl).toBe('https://example.com/very/long/path');
      expect(res.body.data.isActive).toBe(true);
    });

    conditionIt('should create a URL with custom alias', async () => {
      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://github.com',
          customAlias: 'my-github',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.customAlias).toBe('my-github');
      expect(res.body.data.shortUrl).toContain('my-github');
    });

    conditionIt('should reject duplicate alias', async () => {
      await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com', customAlias: 'my-link' });

      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://other.com', customAlias: 'my-link' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALIAS_ALREADY_EXISTS');
    });

    conditionIt('should reject reserved alias', async () => {
      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com', customAlias: 'api' });

      expect(res.status).toBe(400);
    });

    conditionIt('should reject invalid URL protocol', async () => {
      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'javascript:alert(1)' });

      expect(res.status).toBe(400);
    });

    conditionIt('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com' });

      expect(res.status).toBe(401);
    });

    conditionIt('should create a URL with expiration', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
      const res = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          expiresAt: futureDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.expiresAt).toBeDefined();
    });
  });

  describe('GET /api/v1/urls', () => {
    conditionIt('should list user URLs with pagination', async () => {
      // Create 3 URLs
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/urls')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ originalUrl: `https://example.com/${i}` });
      }

      const res = await request(app)
        .get('/api/v1/urls?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });
  });

  describe('GET /api/v1/urls/:id', () => {
    conditionIt('should get URL details', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      const res = await request(app)
        .get(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createRes.body.data.id);
    });

    conditionIt('should return 404 for non-existent URL', async () => {
      const res = await request(app)
        .get('/api/v1/urls/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/urls/:id', () => {
    conditionIt('should update a URL', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      const res = await request(app)
        .put(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://updated.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.originalUrl).toBe('https://updated.com');
    });

    conditionIt('should deactivate a URL', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      const res = await request(app)
        .put(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/urls/:id', () => {
    conditionIt('should delete a URL', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      const res = await request(app)
        .delete(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('Authorization', () => {
    conditionIt('should not allow access to other user\'s URLs', async () => {
      // Create URL as first user
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      // Register and login as second user
      await request(app).post('/api/v1/auth/register').send({
        email: 'other@example.com',
        password: 'StrongPassword123!',
      });

      const otherLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'other@example.com',
        password: 'StrongPassword123!',
      });

      // Try to access first user's URL
      const res = await request(app)
        .get(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${otherLogin.body.data.accessToken}`);

      expect(res.status).toBe(404); // Returns 404, not 403, to avoid leaking existence
    });
  });
});

describe('Redirect API', () => {
  let accessToken: string;

  async function registerAndLogin(): Promise<string> {
    await request(app).post('/api/v1/auth/register').send({
      email: 'redirect@example.com',
      password: 'StrongPassword123!',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'redirect@example.com',
      password: 'StrongPassword123!',
    });

    return loginRes.body.data.accessToken;
  }

  beforeEach(async () => {
    if (isDatabaseAvailable()) {
      accessToken = await registerAndLogin();
    }
  });

  describe('GET /:shortCode', () => {
    conditionIt('should redirect to original URL', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      const res = await request(app)
        .get(`/${createRes.body.data.shortCode}`)
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://example.com');
    });

    conditionIt('should redirect via custom alias', async () => {
      await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://github.com',
          customAlias: 'gh-redirect',
        });

      const res = await request(app).get('/gh-redirect').redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://github.com');
    });

    conditionIt('should return 404 for non-existent short code', async () => {
      const res = await request(app).get('/nonexistent123');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('URL_NOT_FOUND');
    });

    conditionIt('should not redirect deactivated URLs', async () => {
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://example.com' });

      // Deactivate
      await request(app)
        .put(`/api/v1/urls/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false });

      const res = await request(app)
        .get(`/${createRes.body.data.shortCode}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('URL_INACTIVE');
    });

    conditionIt('should not redirect expired URLs', async () => {
      // Create URL with past expiration by directly setting it in the database
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });

      // Manually set expiration to the past
      const { prisma } = await import('./setup');
      await prisma.url.update({
        where: { id: createRes.body.data.id },
        data: { expiresAt: new Date('2020-01-01') },
      });

      const res = await request(app)
        .get(`/${createRes.body.data.shortCode}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('URL_EXPIRED');
    });
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.redis).toBeDefined();
    expect(res.body.checks.rabbitmq).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should include request ID in error responses', async () => {
    const res = await request(app)
      .get('/api/v1/nonexistent')
      .set('X-Request-ID', '550e8400-e29b-41d4-a716-446655440000');

    expect(res.headers['x-request-id']).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(res.body.requestId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('Swagger', () => {
  it('should serve swagger UI', async () => {
    const res = await request(app).get('/docs/').redirects(1);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger');
  });
});
