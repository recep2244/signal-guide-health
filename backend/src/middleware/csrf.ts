/**
 * CSRF Protection Middleware
 * Double-submit cookie pattern for CSRF prevention
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that require CSRF validation
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paths exempt from CSRF (webhooks, public APIs)
const CSRF_EXEMPT_PATHS = [
  '/webhooks/',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/health',
  '/ready',
];

/**
 * Generate a cryptographically secure CSRF token
 */
const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * Constant-time string comparison to prevent timing attacks
 */
const secureCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip for exempt paths
  if (CSRF_EXEMPT_PATHS.some((path) => req.path.startsWith(path))) {
    next();
    return;
  }

  // Skip for non-protected methods (GET, HEAD, OPTIONS)
  if (!CSRF_PROTECTED_METHODS.includes(req.method)) {
    // Set CSRF token cookie for subsequent requests
    if (!req.cookies[CSRF_COOKIE_NAME]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
    }
    next();
    return;
  }

  // Validate CSRF token for protected methods
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken) {
    logger.warn({
      message: 'CSRF token missing',
      method: req.method,
      path: req.path,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      requestId: req.requestId,
    });

    res.status(403).json({
      status: 'error',
      code: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token is required for this request',
    });
    return;
  }

  if (!secureCompare(cookieToken, headerToken)) {
    logger.warn({
      message: 'CSRF token mismatch',
      method: req.method,
      path: req.path,
      ip: req.ip,
      requestId: req.requestId,
    });

    res.status(403).json({
      status: 'error',
      code: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token',
    });
    return;
  }

  // Rotate token after successful validation
  const newToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, newToken, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  next();
};

/**
 * Get CSRF token endpoint
 * GET /api/v1/csrf-token
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  let token = req.cookies[CSRF_COOKIE_NAME];

  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.json({
    status: 'success',
    data: { csrfToken: token },
  });
};
