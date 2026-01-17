/**
 * 404 Not Found Handler
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.warn({
    message: 'Route not found',
    method: req.method,
    path: req.path,
    requestId: req.requestId,
  });

  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    requestId: req.requestId,
  });
};
