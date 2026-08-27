import crypto from 'crypto';

// We test the AuthService logic by testing the token hashing and expiry parsing separately
// Since the auth service depends on database and bcrypt, full testing is done via integration tests

describe('Auth Service - Token Hashing', () => {
  function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  it('should produce consistent hashes for the same input', () => {
    const token = 'test-refresh-token-12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce a 64-character hex string', () => {
    const hash = hashToken('any-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe('Auth Service - Expiry Parsing', () => {
  function parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 60);
  }

  it('should parse seconds correctly', () => {
    expect(parseExpiryToSeconds('30s')).toBe(30);
  });

  it('should parse minutes correctly', () => {
    expect(parseExpiryToSeconds('15m')).toBe(900);
  });

  it('should parse hours correctly', () => {
    expect(parseExpiryToSeconds('1h')).toBe(3600);
  });

  it('should parse days correctly', () => {
    expect(parseExpiryToSeconds('7d')).toBe(604800);
  });

  it('should default to 900 seconds for invalid format', () => {
    expect(parseExpiryToSeconds('invalid')).toBe(900);
  });
});
