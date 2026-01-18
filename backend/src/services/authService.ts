/**
 * Authentication Service
 * Handles user authentication, JWT tokens, sessions, and MFA
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { logAuditEvent } from '../middleware/audit';

// Types
interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions?: string[];
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    mfaEnabled: boolean;
  };
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'doctor' | 'nurse';
  organizationId?: string;
}

// Constants
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ userId: string }> {
    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        organizationId: data.organizationId,
        status: 'pending_verification',
      },
    });

    // Create role-specific record
    if (data.role === 'patient') {
      await prisma.patient.create({
        data: {
          userId: user.id,
          dateOfBirth: new Date(), // Should be provided in registration
        },
      });
    } else if (data.role === 'doctor' || data.role === 'nurse') {
      await prisma.doctor.create({
        data: {
          userId: user.id,
        },
      });
    }

    logger.info({ message: 'User registered', userId: user.id, email: data.email });

    return { userId: user.id };
  }

  /**
   * Authenticate user and return tokens
   */
  async login(
    email: string,
    password: string,
    mfaCode?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        admin: true,
        doctor: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw ApiError.tooManyRequests(
        `Account locked. Try again in ${remainingMinutes} minutes`
      );
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw ApiError.forbidden(`Account is ${user.status}`);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updates: any = { failedLoginAttempts: failedAttempts };

      // Lock account if too many attempts
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        updates.lockedUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60000
        );
        logger.warn({
          message: 'Account locked due to failed attempts',
          userId: user.id,
          attempts: failedAttempts,
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });

      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw ApiError.badRequest('MFA code required', 'MFA_REQUIRED');
      }

      if (!user.mfaSecret) {
        throw ApiError.internal('MFA misconfigured');
      }

      const isValidMfa = authenticator.verify({
        token: mfaCode,
        secret: user.mfaSecret,
      });

      if (!isValidMfa) {
        throw ApiError.unauthorized('Invalid MFA code', 'INVALID_MFA');
      }
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Get permissions
    const permissions = this.getUserPermissions(user);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId || undefined,
      permissions,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Create session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info({ message: 'User logged in', userId: user.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        env.REFRESH_TOKEN_SECRET
      ) as TokenPayload;

      // Verify session exists and is valid
      const session = await prisma.userSession.findFirst({
        where: {
          userId: decoded.userId,
          refreshTokenHash: this.hashToken(refreshToken),
          isActive: true,
          refreshExpiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      // Get fresh user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { admin: true, doctor: true },
      });

      if (!user || user.status !== 'active') {
        throw ApiError.unauthorized('User not found or inactive');
      }

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || undefined,
        permissions: this.getUserPermissions(user),
      };

      const accessToken = this.generateAccessToken(tokenPayload);

      // Update session
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          tokenHash: this.hashToken(accessToken),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          lastActivityAt: new Date(),
        },
      });

      return {
        accessToken,
        expiresIn: 900,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, tokenHash?: string): Promise<void> {
    if (tokenHash) {
      // Revoke specific session
      await prisma.userSession.updateMany({
        where: {
          userId,
          tokenHash,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });
    } else {
      // Revoke all sessions
      await prisma.userSession.updateMany({
        where: { userId },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });
    }

    logger.info({ message: 'User logged out', userId });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      logger.info({ message: 'Password reset requested for unknown email', email });
      return;
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    // Store token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // TODO: Send email with reset link
    logger.info({ message: 'Password reset token created', userId: user.id });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all sessions
      prisma.userSession.updateMany({
        where: { userId: resetToken.userId },
        data: { isActive: false, revokedAt: new Date() },
      }),
    ]);

    logger.info({ message: 'Password reset successful', userId: resetToken.userId });
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info({ message: 'Password changed', userId });
  }

  /**
   * Enable MFA
   */
  async enableMfa(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'CardioWatch', secret);

    // Store secret (will be confirmed on first use)
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return {
      secret,
      qrCode: otpauth,
    };
  }

  /**
   * Confirm and activate MFA
   */
  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw ApiError.badRequest('MFA not setup');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw ApiError.badRequest('Invalid MFA code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await logAuditEvent('MFA_ENABLED', { userId });
    logger.info({ message: 'MFA enabled', userId });
  }

  /**
   * Disable MFA
   */
  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.badRequest('Invalid password');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await logAuditEvent('MFA_DISABLED', { userId });
    logger.info({ message: 'MFA disabled', userId });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(
      { userId: payload.userId, email: payload.email },
      env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getUserPermissions(user: any): string[] {
    const permissions: string[] = [];

    if (user.role === 'super_admin') {
      permissions.push('*'); // All permissions
    } else if (user.role === 'admin' && user.admin) {
      if (user.admin.canManageDoctors) permissions.push('doctors:manage');
      if (user.admin.canManagePatients) permissions.push('patients:manage');
      if (user.admin.canManageAdmins) permissions.push('admins:manage');
      if (user.admin.canViewAnalytics) permissions.push('analytics:view');
      if (user.admin.canManageSettings) permissions.push('settings:manage');
    } else if (user.role === 'doctor') {
      permissions.push('patients:view', 'patients:update', 'alerts:manage', 'appointments:manage');
    } else if (user.role === 'nurse') {
      permissions.push('patients:view', 'alerts:view', 'checkins:manage');
    } else if (user.role === 'patient') {
      permissions.push('self:view', 'self:update', 'checkins:create');
    }

    return permissions;
  }
}

export const authService = new AuthService();
export default authService;
