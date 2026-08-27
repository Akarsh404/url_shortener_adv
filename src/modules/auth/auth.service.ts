import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { authRepository, AuthRepository } from './auth.repository';
import {
  ConflictError,
  UnauthorizedError,
  ErrorCode,
} from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schemas';

const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JwtPayload {
  userId: string;
  email: string;
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async register(input: RegisterInput): Promise<{ id: string; email: string; createdAt: Date }> {
    // Check if email already exists
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered', ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.repo.createUser(input.email, passwordHash);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  async login(input: LoginInput): Promise<TokenPair> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', ErrorCode.INVALID_CREDENTIALS);
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password', ErrorCode.INVALID_CREDENTIALS);
    }

    return this.generateTokenPair(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token', ErrorCode.TOKEN_INVALID);
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedError('Refresh token has been revoked', ErrorCode.TOKEN_REVOKED);
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired', ErrorCode.TOKEN_EXPIRED);
    }

    // Revoke the old refresh token (rotation)
    await this.repo.revokeRefreshToken(storedToken.id);

    // Get user info for new token pair
    const user = await this.repo.findUserById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedError('User not found', ErrorCode.TOKEN_INVALID);
    }

    return this.generateTokenPair(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.repo.findRefreshTokenByHash(tokenHash);

    if (storedToken) {
      await this.repo.revokeRefreshToken(storedToken.id);
    }
    // Silently succeed even if token not found — prevents token enumeration
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload & jwt.JwtPayload;
      return { userId: payload.userId, email: payload.email };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired', ErrorCode.TOKEN_EXPIRED);
      }
      throw new UnauthorizedError('Invalid access token', ErrorCode.TOKEN_INVALID);
    }
  }

  private async generateTokenPair(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = { userId, email };

    const accessExpirySeconds = this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY);

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: accessExpirySeconds,
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    // Calculate refresh token expiry
    const refreshExpiryMs = this.parseExpiryToSeconds(env.JWT_REFRESH_EXPIRY) * 1000;
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    await this.repo.createRefreshToken(userId, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpirySeconds,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // Default 15 minutes

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
}

export const authService = new AuthService(authRepository);
