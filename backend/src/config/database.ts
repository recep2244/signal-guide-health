/**
 * Database Configuration
 * Prisma client singleton with connection management
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Extend PrismaClient with logging
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

// Declare global type for prisma
declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Use global singleton in development to prevent multiple instances
export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Query event type
interface QueryEvent {
  query: string;
  params: string;
  duration: number;
}

// Error event type
interface ErrorEvent {
  message: string;
}

// Log queries in development
prisma.$on('query' as never, (e: QueryEvent) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug({
      message: 'Database query',
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  }
});

// Log errors
prisma.$on('error' as never, (e: ErrorEvent) => {
  logger.error({
    message: 'Database error',
    error: e.message,
  });
});

// Connection management
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info({ message: 'Database connected successfully' });
  } catch (error) {
    logger.fatal({
      message: 'Failed to connect to database',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info({ message: 'Database disconnected' });
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default prisma;
