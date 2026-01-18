/**
 * Encryption Service
 * AES-256-GCM encryption for PII fields
 */

import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

class EncryptionService {
  private key: Buffer;

  constructor() {
    // Derive key from environment variable
    this.key = this.deriveKey(env.ENCRYPTION_KEY);
  }

  /**
   * Derive a 256-bit key from password using PBKDF2
   */
  private deriveKey(password: string): Buffer {
    // Use a fixed salt for deterministic key derivation
    // In production, you might want to use a separate salt per installation
    const salt = crypto.scryptSync(password, 'cardiowatch-salt', 32);
    return salt;
  }

  /**
   * Encrypt a string value
   * Returns: iv:authTag:encryptedData (base64 encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    try {
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine: iv:authTag:encrypted
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      logger.error({
        message: 'Encryption failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt an encrypted string
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    // Check if data is encrypted (has our format)
    if (!encryptedData.includes(':')) {
      return encryptedData; // Not encrypted, return as-is
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error({
        message: 'Decryption failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash a value (one-way, for comparisons)
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomBytes = crypto.randomBytes(length);
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

  /**
   * Encrypt an object's sensitive fields
   */
  encryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[]
  ): T {
    const encrypted = { ...obj };

    for (const field of fieldsToEncrypt) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field] as string) as any;
      }
    }

    return encrypted;
  }

  /**
   * Decrypt an object's encrypted fields
   */
  decryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToDecrypt: (keyof T)[]
  ): T {
    const decrypted = { ...obj };

    for (const field of fieldsToDecrypt) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decrypt(decrypted[field] as string) as any;
        } catch {
          // Field might not be encrypted, keep original value
        }
      }
    }

    return decrypted;
  }

  /**
   * Mask a value for display (e.g., NHS number)
   * "1234567890" -> "123****890"
   */
  mask(value: string, visibleStart = 3, visibleEnd = 3): string {
    if (!value || value.length <= visibleStart + visibleEnd) {
      return value;
    }

    const start = value.substring(0, visibleStart);
    const end = value.substring(value.length - visibleEnd);
    const masked = '*'.repeat(value.length - visibleStart - visibleEnd);

    return `${start}${masked}${end}`;
  }

  /**
   * Constant-time string comparison (timing-attack safe)
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
