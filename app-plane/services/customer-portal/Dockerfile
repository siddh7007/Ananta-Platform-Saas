# syntax=docker/dockerfile:1.4

# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Build-time environment variables for Vite

# Node Environment (CRITICAL for auth mode detection)
ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

# Authentication Configuration
ARG VITE_AUTH_MODE
ARG VITE_DEV_BYPASS_ENABLED
ARG VITE_DEV_SESSION_DURATION
ARG VITE_AUTH_LOGGING

# Dev Mode Default Credentials
ARG VITE_DEV_DEFAULT_EMAIL
ARG VITE_DEV_DEFAULT_PASSWORD

# Supabase
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_SERVICE_KEY

# Keycloak & Backend
ARG VITE_KEYCLOAK_URL
ARG VITE_BACKEND_URL
ARG VITE_CNS_API_URL

# Auth0
ARG VITE_AUTH_PROVIDER
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_USE_DIRECT_AUTH0_JWT

# Novu Notifications
ARG VITE_NOVU_APP_IDENTIFIER
ARG VITE_NOVU_BACKEND_URL
ARG VITE_NOVU_SOCKET_URL

# Make them available to Vite build
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_DEV_BYPASS_ENABLED=$VITE_DEV_BYPASS_ENABLED
ENV VITE_DEV_SESSION_DURATION=$VITE_DEV_SESSION_DURATION
ENV VITE_AUTH_LOGGING=$VITE_AUTH_LOGGING
ENV VITE_DEV_DEFAULT_EMAIL=$VITE_DEV_DEFAULT_EMAIL
ENV VITE_DEV_DEFAULT_PASSWORD=$VITE_DEV_DEFAULT_PASSWORD
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_SERVICE_KEY=$VITE_SUPABASE_SERVICE_KEY
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_CNS_API_URL=$VITE_CNS_API_URL
ENV VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_USE_DIRECT_AUTH0_JWT=$VITE_USE_DIRECT_AUTH0_JWT
ENV VITE_NOVU_APP_IDENTIFIER=$VITE_NOVU_APP_IDENTIFIER
ENV VITE_NOVU_BACKEND_URL=$VITE_NOVU_BACKEND_URL
ENV VITE_NOVU_SOCKET_URL=$VITE_NOVU_SOCKET_URL

# Copy source code first (excluding node_modules via .dockerignore)
COPY . .

# Install dependencies
RUN npm install --legacy-peer-deps

# Debug: Show environment variables during build
RUN echo "🔍 Build-time ENV check:" && \
    echo "  VITE_DEV_DEFAULT_EMAIL=$VITE_DEV_DEFAULT_EMAIL" && \
    echo "  VITE_DEV_DEFAULT_PASSWORD=$VITE_DEV_DEFAULT_PASSWORD" && \
    echo "  NODE_ENV=$NODE_ENV" && \
    echo "  VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER" && \
    echo "  VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN" && \
    echo "  VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID" && \
    echo "  VITE_USE_DIRECT_AUTH0_JWT=$VITE_USE_DIRECT_AUTH0_JWT"

# Build the application in development mode if NODE_ENV=development
# This sets import.meta.env.MODE which is checked by authConfig
RUN if [ "$NODE_ENV" = "development" ]; then \
      npx vite build --mode development; \
    else \
      npm run build:prod || npx vite build; \
    fi

# Production stage
FROM nginx:alpine

# Build argument to determine which nginx config to use
ARG NODE_ENV=production

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration based on environment
# Development: no-cache headers for rapid iteration
# Production: aggressive caching for performance
RUN if [ "$NODE_ENV" = "development" ]; then \
      echo "Using development nginx config (no caching)"; \
    else \
      echo "Using production nginx config (aggressive caching)"; \
    fi

COPY nginx.dev.conf /etc/nginx/nginx.dev.conf
COPY nginx.conf /etc/nginx/nginx.prod.conf

# Use conditional copy based on NODE_ENV
RUN if [ "$NODE_ENV" = "development" ]; then \
      cp /etc/nginx/nginx.dev.conf /etc/nginx/conf.d/default.conf; \
    else \
      cp /etc/nginx/nginx.prod.conf /etc/nginx/conf.d/default.conf; \
    fi

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
