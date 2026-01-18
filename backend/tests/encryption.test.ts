/**
 * Encryption Service Tests
 */

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

// Mock environment
vi.mock('../src/config/env', () => ({
  env: {
    ENCRYPTION_KEY: 'test_encryption_key_32_characters!',
  },
}));

describe('Encryption Service', () => {
  const ALGORITHM = 'aes-256-gcm';
  const key = crypto.scryptSync('test_encryption_key_32_characters!', 'cardiowatch-salt', 32);

  describe('encrypt', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'sensitive data';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

      expect(result).not.toBe(plaintext);
      expect(result.split(':').length).toBe(3);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'sensitive data';

      const encrypt = (text: string) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
      };

      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      expect(result1).not.toBe(result2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext correctly', () => {
      const plaintext = 'sensitive data';

      // Encrypt
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();
      const encryptedData = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

      // Decrypt
      const parts = encryptedData.split(':');
      const decIv = Buffer.from(parts[0], 'base64');
      const decAuthTag = Buffer.from(parts[1], 'base64');
      const decEncrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, key, decIv);
      decipher.setAuthTag(decAuthTag);
      let decrypted = decipher.update(decEncrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with tampered data', () => {
      const plaintext = 'sensitive data';

      // Encrypt
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      // Tamper with encrypted data
      const tamperedEncrypted = encrypted.slice(0, -2) + 'XX';

      // Attempt decrypt
      const decIv = iv;
      const decipher = crypto.createDecipheriv(ALGORITHM, key, decIv);
      decipher.setAuthTag(authTag);

      expect(() => {
        decipher.update(tamperedEncrypted, 'base64', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });
  });

  describe('hashing', () => {
    it('should produce consistent hash for same input', () => {
      const value = 'test_value';
      const hash1 = crypto.createHash('sha256').update(value).digest('hex');
      const hash2 = crypto.createHash('sha256').update(value).digest('hex');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = crypto.createHash('sha256').update('value1').digest('hex');
      const hash2 = crypto.createHash('sha256').update('value2').digest('hex');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('masking', () => {
    it('should mask NHS number correctly', () => {
      const nhsNumber = '9876543210';
      const mask = (value: string, visibleStart = 3, visibleEnd = 3) => {
        const start = value.substring(0, visibleStart);
        const end = value.substring(value.length - visibleEnd);
        const masked = '*'.repeat(value.length - visibleStart - visibleEnd);
        return `${start}${masked}${end}`;
      };

      const masked = mask(nhsNumber);
      expect(masked).toBe('987****210');
    });

    it('should not mask short values', () => {
      const shortValue = '123';
      const mask = (value: string, visibleStart = 3, visibleEnd = 3) => {
        if (value.length <= visibleStart + visibleEnd) return value;
        const start = value.substring(0, visibleStart);
        const end = value.substring(value.length - visibleEnd);
        const masked = '*'.repeat(value.length - visibleStart - visibleEnd);
        return `${start}${masked}${end}`;
      };

      const masked = mask(shortValue);
      expect(masked).toBe('123');
    });
  });

  describe('secure comparison', () => {
    it('should return true for equal strings', () => {
      const a = 'test_string';
      const b = 'test_string';

      const result = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      expect(result).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      const a = 'test_string1';
      const b = 'test_string2';

      const result = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      expect(result).toBe(false);
    });
  });
});
