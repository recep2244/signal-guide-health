/**
 * Input Sanitization Middleware
 * Prevents XSS and injection attacks
 */

import { Request, Response, NextFunction } from 'express';

// Characters that could be used for XSS attacks
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /<iframe/gi,
  /<embed/gi,
  /<object/gi,
  /<link/gi,
  /<style/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

// SQL injection patterns
const SQL_PATTERNS = [
  /(%27)|(')|(--)|(%23)|(#)/gi,
  /\b(union|select|insert|update|delete|drop|alter|create|truncate)\b/gi,
];

/**
 * Sanitize a string value
 */
const sanitizeString = (value: string): string => {
  let sanitized = value;

  // Remove XSS patterns
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
};

/**
 * Check for SQL injection patterns (for logging/alerting)
 */
const hasSqlInjection = (value: string): boolean => {
  return SQL_PATTERNS.some((pattern) => pattern.test(value));
};

/**
 * Recursively sanitize an object
 */
const sanitizeObject = (obj: unknown, depth = 0): unknown => {
  // Prevent deep recursion attacks
  if (depth > 10) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too (prevent prototype pollution)
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey === '__proto__' || sanitizedKey === 'constructor' || sanitizedKey === 'prototype') {
        continue; // Skip dangerous keys
      }
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as typeof req.query;
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as typeof req.params;
  }

  next();
};

/**
 * SQL injection detection middleware (for alerting)
 */
export const detectSqlInjection = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const checkValue = (value: unknown, path: string): void => {
    if (typeof value === 'string' && hasSqlInjection(value)) {
      // Log potential attack (would trigger security alert)
      console.warn(`[SECURITY] Potential SQL injection detected in ${path}`, {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent'],
      });
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
    }

    if (value !== null && typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        checkValue(val, `${path}.${key}`);
      }
    }
  };

  checkValue(req.body, 'body');
  checkValue(req.query, 'query');
  checkValue(req.params, 'params');

  next();
};

export { sanitizeString, sanitizeObject };
