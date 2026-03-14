# CardioWatch API - Production Dockerfile
# Multi-stage build for security and efficiency

# =============================================================================
# Stage 1: Production dependencies only
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# Stage 2: Builder (needs dev deps for tsc)
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# Install all deps (including devDependencies) so tsc is available
RUN npm ci && npm cache clean --force

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 cardiowatch

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Security: Set ownership
RUN chown -R cardiowatch:nodejs /app

# Security: Switch to non-root user
USER cardiowatch

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run Prisma migrations then start server.
# Using shell form so the command runs in a shell that can chain statements.
# migrate deploy is idempotent — safe to run on every startup.
CMD npx prisma migrate deploy && node dist/app.js
