/**
 * MFA Middleware
 * Enforces a valid TOTP code for sensitive admin actions.
 */

import { Request, Response, NextFunction } from 'express';
import { authenticator } from 'otplib';
import { env } from '../config/env';
import { prisma } from '../config/database';

const readMfaCode = (req: Request): string | null => {
  const headerCode = req.headers['x-mfa-code'];
  if (typeof headerCode === 'string' && headerCode.trim() !== '') {
    return headerCode.trim();
  }

  const body = req.body as Record<string, unknown>;
  const bodyCode = body['mfaCode'];
  if (typeof bodyCode === 'string' && bodyCode.trim() !== '') {
    return bodyCode.trim();
  }

  return null;
};

export const requireMfaForSensitiveAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!env.ENABLE_MFA) {
    next();
    return;
  }

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
      mfaEnabled: true,
      mfaSecret: true,
    },
  });

  if (!user) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'User not found',
    });
    return;
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    if (env.NODE_ENV !== 'production') {
      next();
      return;
    }

    res.status(403).json({
      status: 'error',
      code: 'MFA_NOT_ENABLED',
      message: 'MFA must be enabled for your account before performing this action',
    });
    return;
  }

  const mfaCode = readMfaCode(req);
  if (!mfaCode) {
    res.status(403).json({
      status: 'error',
      code: 'MFA_REQUIRED',
      message: 'MFA code is required for this action',
    });
    return;
  }

  if (!/^\d{6}$/.test(mfaCode)) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_MFA_FORMAT',
      message: 'MFA code must be a 6-digit value',
    });
    return;
  }

  const isValid = authenticator.verify({
    token: mfaCode,
    secret: user.mfaSecret,
  });

  if (!isValid) {
    res.status(403).json({
      status: 'error',
      code: 'MFA_INVALID',
      message: 'Invalid MFA code',
    });
    return;
  }

  next();
};
