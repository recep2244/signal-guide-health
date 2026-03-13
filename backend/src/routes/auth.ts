/**
 * Authentication Routes
 * Login, register, logout, token refresh, password management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { logAuditEvent } from '../middleware/audit';
import { authService } from '../services/authService';
import { prisma } from '../config/database';

const router: Router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mfaCode: z.string().length(6).optional(),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['patient', 'doctor', 'nurse']).default('patient'),
  organizationId: z.string().uuid().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
});

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await authService.login(
      data.email,
      data.password,
      data.mfaCode,
      req.ip,
      req.get('User-Agent')
    );

    // Set refresh token in signed httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    res.json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          permissions: [],
          createdAt: new Date().toISOString(),
        },
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          tokenType: 'Bearer',
        },
      },
    });
  } catch (error) {
    void logAuditEvent('LOGIN_FAILED', {
      userEmail: typeof req.body?.email === 'string' ? req.body.email : undefined,
      ipAddress: req.ip,
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    next(error);
  }
});

/**
 * POST /auth/register
 * Register new user and issue tokens
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    await authService.register({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      organizationId: data.organizationId,
    });

    // Auto-login newly registered user for pilot readiness.
    const loginResult = await authService.login(
      data.email,
      data.password,
      undefined,
      req.ip,
      req.get('User-Agent')
    );

    res.cookie('refreshToken', loginResult.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      status: 'success',
      data: {
        accessToken: loginResult.accessToken,
        expiresIn: loginResult.expiresIn,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          role: loginResult.user.role,
          firstName: loginResult.user.firstName,
          lastName: loginResult.user.lastName,
          name: `${loginResult.user.firstName} ${loginResult.user.lastName}`.trim(),
          permissions: [],
          createdAt: new Date().toISOString(),
        },
        tokens: {
          accessToken: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          expiresIn: loginResult.expiresIn,
          tokenType: 'Bearer',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token (cookie or body)
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const bodyToken = typeof body['refreshToken'] === 'string' ? body['refreshToken'] : null;
    const cookieToken = req.signedCookies?.['refreshToken'];
    const refreshToken = cookieToken || bodyToken;

    if (!refreshToken) {
      res.status(401).json({
        status: 'error',
        code: 'NO_REFRESH_TOKEN',
        message: 'No refresh token provided',
      });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user and invalidate sessions
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Revoke all active sessions for the user.
    await authService.logout(req.user.userId);

    await logAuditEvent('LOGOUT', {
      userId: req.user.userId,
      ipAddress: req.ip,
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      signed: true,
    });
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(data.email);

    res.json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    await authService.resetPassword(data.token, data.password);

    await logAuditEvent('PASSWORD_RESET', {
      ipAddress: req.ip,
      status: 'success',
    });

    res.json({
      status: 'success',
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    if (!req.user?.userId) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    await authService.changePassword(req.user.userId, data.currentPassword, data.newPassword);

    await logAuditEvent('PASSWORD_CHANGE', {
      userId: req.user.userId,
      ipAddress: req.ip,
      status: 'success',
    });

    res.json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'User not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        permissions: [],
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/password/reset
 * Compatibility endpoint for frontend auth client.
 */
router.post('/password/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(data.email);

    res.json({
      status: 'success',
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/password/confirm
 * Compatibility endpoint for frontend auth client.
 */
router.post('/password/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(data.token, data.password);

    res.json({
      status: 'success',
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/password/change
 * Compatibility endpoint for frontend auth client.
 */
router.post('/password/change', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    if (!req.user?.userId) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    await authService.changePassword(req.user.userId, data.currentPassword, data.newPassword);
    res.json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/session
 * Lightweight session info endpoint for frontend.
 */
router.get('/session', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'User not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`.trim(),
          permissions: [],
          createdAt: user.createdAt.toISOString(),
        },
        expiresAt: new Date((req.user.exp || 0) * 1000).toISOString(),
        isValid: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
