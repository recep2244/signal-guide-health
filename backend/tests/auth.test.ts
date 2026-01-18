/**
 * Authentication Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock Prisma
vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      create: vi.fn(),
    },
    doctor: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      user: { update: vi.fn() },
      passwordResetToken: { update: vi.fn() },
      userSession: { updateMany: vi.fn() },
    })),
  },
}));

// Mock environment
vi.mock('../src/config/env', () => ({
  env: {
    JWT_SECRET: 'test_jwt_secret_32_characters_long!',
    REFRESH_TOKEN_SECRET: 'test_refresh_secret_32_chars_long!',
    NODE_ENV: 'test',
  },
}));

describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'SecurePass123!';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should verify correct password', async () => {
      const password = 'SecurePass123!';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare('WrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    const secret = 'test_jwt_secret_32_characters_long!';
    const payload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'doctor',
    };

    it('should generate valid JWT token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '15m' });

      expect(token).toBeTruthy();
      expect(token.split('.').length).toBe(3);
    });

    it('should verify valid token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '15m' });
      const decoded = jwt.verify(token, secret) as typeof payload;

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject expired token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '-1s' });

      expect(() => jwt.verify(token, secret)).toThrow(jwt.TokenExpiredError);
    });

    it('should reject invalid token', () => {
      expect(() => jwt.verify('invalid.token.here', secret)).toThrow(jwt.JsonWebTokenError);
    });

    it('should reject token with wrong secret', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '15m' });

      expect(() => jwt.verify(token, 'wrong_secret')).toThrow(jwt.JsonWebTokenError);
    });
  });

  describe('Password Validation', () => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    it('should accept valid password', () => {
      expect(passwordRegex.test('SecurePass1!')).toBe(true);
      expect(passwordRegex.test('MyP@ssw0rd')).toBe(true);
    });

    it('should reject password without uppercase', () => {
      expect(passwordRegex.test('securepass1!')).toBe(false);
    });

    it('should reject password without lowercase', () => {
      expect(passwordRegex.test('SECUREPASS1!')).toBe(false);
    });

    it('should reject password without number', () => {
      expect(passwordRegex.test('SecurePass!')).toBe(false);
    });

    it('should reject password without special character', () => {
      expect(passwordRegex.test('SecurePass1')).toBe(false);
    });

    it('should reject password under 8 characters', () => {
      expect(passwordRegex.test('Pass1!')).toBe(false);
    });
  });
});

describe('Session Management', () => {
  it('should generate unique session tokens', () => {
    const crypto = require('crypto');
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64);
  });

  it('should hash tokens for storage', () => {
    const crypto = require('crypto');
    const token = 'test_token_value';
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    expect(hash).not.toBe(token);
    expect(hash.length).toBe(64);
  });
});
