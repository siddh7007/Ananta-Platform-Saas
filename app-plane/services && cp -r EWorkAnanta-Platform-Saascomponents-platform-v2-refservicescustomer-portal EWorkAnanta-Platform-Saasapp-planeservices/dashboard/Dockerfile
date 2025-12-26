# syntax=docker/dockerfile:1.4

# ==========================================
# CNS Dashboard - React Admin Frontend
# Multi-stage Docker build with BuildKit cache optimization
# ==========================================

# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables

# Authentication Configuration
ARG VITE_AUTH_PROVIDER
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_MIDDLEWARE_API_URL

# CNS API Configuration
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_CNS_API_URL
ARG VITE_CNS_ADMIN_TOKEN
ARG VITE_DIRECTUS_URL

# Export build args as environment variables for Vite
ENV VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_MIDDLEWARE_API_URL=$VITE_MIDDLEWARE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_CNS_API_URL=$VITE_CNS_API_URL
ENV VITE_CNS_ADMIN_TOKEN=$VITE_CNS_ADMIN_TOKEN
ENV VITE_DIRECTUS_URL=$VITE_DIRECTUS_URL

# Copy package files
COPY services/cns-service/dashboard/package*.json ./

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm npm install

# Copy source code
COPY services/cns-service/dashboard/. .

# Debug: Show environment variables during build
RUN echo "🔍 Build-time ENV check:" && \
    echo "  VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER" && \
    echo "  VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN" && \
    echo "  VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID"

# Build the application
RUN npm run build

# Stage 2: Production server with nginx
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy nginx configuration template
COPY services/cns-service/dashboard/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy entrypoint script
COPY services/cns-service/dashboard/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set default environment variables
ENV CNS_DASHBOARD_PORT=27810
ENV CNS_PORT=27800

# Expose port
EXPOSE 27810

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:27810/ || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
