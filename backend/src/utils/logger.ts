/**
 * Structured Logger
 * Pino-based logging with PII masking and multiple transports
 */

import pino from 'pino';

// PII fields to mask in logs
const PII_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'apiKey',
  'secret',
  'nhsNumber',
  'dateOfBirth',
  'dob',
  'ssn',
  'email',
  'phone',
  'address',
  'postcode',
  'emergencyContact',
];

// Create redaction paths for Pino
const redactPaths = PII_FIELDS.flatMap((field) => [
  field,
  `*.${field}`,
  `*.*.${field}`,
  `*.*.*.${field}`,
  `req.body.${field}`,
  `req.query.${field}`,
  `req.headers.${field}`,
]);

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Create logger instance
export const logger = pino({
  level: logLevel,

  // Redact sensitive fields
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },

  // Add base fields to all logs
  base: {
    service: 'cardiowatch-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Format for development (pretty print)
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Error serializer
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

// Create child loggers for specific modules
export const createModuleLogger = (moduleName: string) => {
  return logger.child({ module: moduleName });
};

// Specialized loggers
export const auditLogger = createModuleLogger('audit');
export const securityLogger = createModuleLogger('security');
export const performanceLogger = createModuleLogger('performance');

// Log levels helper
export const logLevels = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
} as const;

// Performance timing helper
export const measurePerformance = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    performanceLogger.info({
      message: `Operation completed: ${name}`,
      operation: name,
      durationMs: Math.round(duration),
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    performanceLogger.error({
      message: `Operation failed: ${name}`,
      operation: name,
      durationMs: Math.round(duration),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export default logger;
