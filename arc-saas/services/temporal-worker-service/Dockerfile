# =============================================================================
# Temporal Worker Service - Docker Build
# =============================================================================
# Multi-stage build for Temporal workflow workers
#
# Build:   docker build -t arc-saas-temporal-worker .
# Run:     docker run arc-saas-temporal-worker
# =============================================================================

# Build stage - Use debian-based image for glibc compatibility with Temporal SDK
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage - Use debian-based image for glibc compatibility
FROM node:20-slim AS production

WORKDIR /app

# Install tini for proper process management
RUN apt-get update && apt-get install -y tini && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nodejs

# Copy built assets and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production \
    TEMPORAL_ADDRESS=temporal:7233 \
    TEMPORAL_NAMESPACE=arc-saas \
    TEMPORAL_TASK_QUEUE=tenant-provisioning

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
