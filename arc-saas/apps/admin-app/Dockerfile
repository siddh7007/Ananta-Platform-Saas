# =============================================================================
# Admin App (Control Plane Portal) - Docker Build
# =============================================================================
# Multi-stage build - nginx for production static serving
#
# Build:   docker build -t arc-saas-admin-app .
# Run:     docker run -p 3000:80 arc-saas-admin-app
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
# Build: skip tsc for test files
RUN npx tsc -p tsconfig.build.json --noEmit && npx vite build

# Production stage - nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
