# Build stage - use glibc-based image (Temporal native modules require glibc)
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - use glibc-based image for Temporal native modules
FROM node:20-slim AS production

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
# Note: Temporal needs its native binaries, so we can't skip scripts
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production

# Start the worker
CMD ["node", "./dist/index.js"]
