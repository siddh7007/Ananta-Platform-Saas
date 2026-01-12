# syntax=docker/dockerfile:1.4

# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Build-time environment variables for Vite

# Authentication Configuration
ARG VITE_AUTH_PROVIDER
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE

# Backend URLs
ARG VITE_BACKEND_URL
ARG VITE_DOCKER_API_URL
ARG VITE_CNS_API_URL
ARG VITE_MIDDLEWARE_API_URL
ARG VITE_BASE_PATH

# Supabase
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Make them available to Vite build
ENV VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_DOCKER_API_URL=$VITE_DOCKER_API_URL
ENV VITE_CNS_API_URL=$VITE_CNS_API_URL
ENV VITE_MIDDLEWARE_API_URL=$VITE_MIDDLEWARE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copy package files
COPY services/backstage-portal/package*.json ./

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm npm install

# Copy source code
COPY services/backstage-portal/. .

# Debug: Show environment variables during build
RUN echo "🔍 Build-time ENV check:" && \
    echo "  VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER" && \
    echo "  VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN" && \
    echo "  VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID"

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY services/backstage-portal/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
