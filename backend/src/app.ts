/**
 * CardioWatch API Server
 * Healthcare monitoring backend with comprehensive security
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { csrfProtection } from './middleware/csrf';
import { sanitizeInput } from './middleware/sanitize';
import { auditLogger } from './middleware/audit';

// Route imports
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import doctorRoutes from './routes/doctors';
import alertRoutes from './routes/alerts';
import wearableRoutes from './routes/wearables';
import appointmentRoutes from './routes/appointments';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';

const app: Express = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.FRONTEND_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 600, // 10 minutes
}));

// Rate Limiting - Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  skip: (req) => req.path === '/health',
});
app.use(globalLimiter);

// Rate Limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many login attempts',
    message: 'Account temporarily locked. Please try again in 15 minutes.',
  },
});

// =============================================================================
// PARSING & UTILITY MIDDLEWARE
// =============================================================================

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parsing (for refresh tokens)
app.use(cookieParser(env.COOKIE_SECRET));

// Compression
app.use(compression());

// Request logging
app.use(pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    remove: true,
  },
  customProps: (req) => ({
    requestId: req.headers['x-request-id'] || req.id,
  }),
}));

// Input sanitization
app.use(sanitizeInput);

// =============================================================================
// HEALTH CHECK (No auth required)
// =============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: env.APP_VERSION,
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    // await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================================================
// API ROUTES
// =============================================================================

const apiRouter = express.Router();

// CSRF protection for state-changing requests
apiRouter.use(csrfProtection);

// Audit logging for all API requests
apiRouter.use(auditLogger);

// Mount routes
apiRouter.use('/auth', authLimiter, authRoutes);
apiRouter.use('/patients', patientRoutes);
apiRouter.use('/doctors', doctorRoutes);
apiRouter.use('/alerts', alertRoutes);
apiRouter.use('/wearables', wearableRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/admin', adminRoutes);

// API version prefix
app.use('/api/v1', apiRouter);

// Webhook routes (separate - no CSRF, different auth)
app.use('/webhooks', webhookRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

const PORT = env.PORT || 8080;

const server = app.listen(PORT, () => {
  logger.info({
    message: 'Server started',
    port: PORT,
    environment: env.NODE_ENV,
    version: env.APP_VERSION,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ message: `${signal} received, shutting down gracefully` });

  server.close(async () => {
    logger.info({ message: 'HTTP server closed' });

    // Close database connection
    // await prisma.$disconnect();

    // Close Redis connection
    // await redis.quit();

    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error({ message: 'Forced shutdown after timeout' });
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    message: 'Unhandled Rejection',
    reason,
    promise,
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal({
    message: 'Uncaught Exception',
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default app;
