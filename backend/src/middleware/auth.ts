/**
 * Authentication Middleware
 * JWT verification and user context injection
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// User payload in JWT
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'patient' | 'doctor' | 'nurse' | 'admin' | 'super_admin';
  organizationId?: string;
  permissions?: string[];
  iat: number;
  exp: number;
}

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    user?: JWTPayload;
    requestId?: string;
  }
}

/**
 * Verify JWT token from Authorization header
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Check token expiration
    if (decoded.exp * 1000 < Date.now()) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      });
      return;
    }

    // Attach user to request
    req.user = decoded;

    // Log authentication
    logger.debug({
      message: 'User authenticated',
      userId: decoded.userId,
      role: decoded.role,
      requestId: req.requestId,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      });
      return;
    }

    logger.error({
      message: 'Authentication error',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
    });

    res.status(500).json({
      status: 'error',
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
};

/**
 * Role-based access control
 */
export const requireRole = (...allowedRoles: JWTPayload['role'][]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        message: 'Access denied - insufficient role',
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        requestId: req.requestId,
      });

      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based access control
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((p) =>
      userPermissions.includes(p)
    );

    if (!hasPermission) {
      logger.warn({
        message: 'Access denied - missing permission',
        userId: req.user.userId,
        userPermissions,
        requiredPermissions,
        requestId: req.requestId,
      });

      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'You do not have the required permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Verify refresh token from httpOnly cookie
 */
export const verifyRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.signedCookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        status: 'error',
        code: 'NO_REFRESH_TOKEN',
        message: 'No refresh token provided',
      });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      env.REFRESH_TOKEN_SECRET
    ) as JWTPayload;

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid or expired refresh token',
    });
  }
};
