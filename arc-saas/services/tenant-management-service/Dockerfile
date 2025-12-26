# =============================================================================
# Tenant Management Service - Docker Build
# =============================================================================
# Multi-stage build for LoopBack 4 microservice
#
# Build:   docker build -t arc-saas-tenant-mgmt .
# Run:     docker run -p 14000:14000 arc-saas-tenant-mgmt
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install tini for proper process management
RUN apk add --no-cache tini wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built assets and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Public folder is optional - create empty if doesn't exist
RUN mkdir -p ./public

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 14000

ENV NODE_ENV=production \
    PORT=14000 \
    HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:14000/ping || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "-r", "./dist/opentelemetry-registry.js", "-r", "source-map-support/register", "./dist/__main__.js"]
