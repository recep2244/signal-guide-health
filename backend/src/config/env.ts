/**
 * Environment Configuration
 * Validates all required environment variables at startup
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema with validation
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('8080'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_NAME: z.string().default('CardioWatch API'),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters for AES-256'),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')).default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('10'),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // WhatsApp Business API
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Local LLM (DeepSeek/Ollama-compatible)
  LOCAL_LLM_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  LOCAL_LLM_BASE_URL: z.string().url().default('http://127.0.0.1:11434/v1'),
  LOCAL_LLM_MODEL: z.string().default('deepseek-r1:8b'),
  LOCAL_LLM_API_KEY: z.string().optional(),
  LOCAL_LLM_TIMEOUT_MS: z.string().transform(Number).default('8000'),

  // Wearable OAuth
  APPLE_WEBHOOK_SECRET: z.string().optional(),
  APPLE_HEALTHKIT_TEAM_ID: z.string().optional(),
  APPLE_HEALTHKIT_KEY_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  HEALTH_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_PUBSUB_TOKEN: z.string().optional(),
  FITBIT_VERIFY_CODE: z.string().optional(),
  GARMIN_WEBHOOK_SECRET: z.string().optional(),
  WITHINGS_WEBHOOK_SECRET: z.string().optional(),
  SAMSUNG_WEBHOOK_SECRET: z.string().optional(),
  FITBIT_CLIENT_ID: z.string().optional(),
  FITBIT_CLIENT_SECRET: z.string().optional(),
  FITBIT_REDIRECT_URI: z.string().url().optional(),
  GARMIN_CONSUMER_KEY: z.string().optional(),
  GARMIN_CONSUMER_SECRET: z.string().optional(),
  WITHINGS_CLIENT_ID: z.string().optional(),
  WITHINGS_CLIENT_SECRET: z.string().optional(),
  WITHINGS_REDIRECT_URI: z.string().url().optional(),

  // Push Notifications
  FCM_PROJECT_ID: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Feature Flags
  ENABLE_MFA: z.string().transform((val) => val === 'true').default('true'),
  ENABLE_AUDIT_LOGGING: z.string().transform((val) => val === 'true').default('true'),
  ENABLE_FIELD_ENCRYPTION: z.string().transform((val) => val === 'true').default('true'),
  ADMIN_LOCAL_ONLY: z.string().transform((val) => val === 'true').default('false'),
  PILOT_FOLLOWUP_SCHEDULER_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  PILOT_FOLLOWUP_INTERVAL_MINUTES: z.string().transform(Number).default('1440'),
  PILOT_FOLLOWUP_BATCH_LIMIT: z.string().transform(Number).default('25'),
});

// Parse and validate environment
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();

// Type export for use in other files
export type Env = z.infer<typeof envSchema>;

// Security check - ensure secrets are not default values in production
if (env.NODE_ENV === 'production') {
  const sensitiveVars = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'COOKIE_SECRET',
    'ENCRYPTION_KEY',
  ];

  for (const varName of sensitiveVars) {
    const value = env[varName as keyof typeof env] as string;
    if (value.includes('changeme') || value.includes('default') || value.length < 32) {
      console.error(`❌ ${varName} appears to be a default value. Please set a secure value in production.`);
      process.exit(1);
    }
  }

  console.log('✅ Environment validation passed');
}
