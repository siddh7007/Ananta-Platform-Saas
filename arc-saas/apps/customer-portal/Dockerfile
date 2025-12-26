# =============================================================================
# Customer Business Portal (CBP) - Docker Build
# =============================================================================
# Production nginx serving pre-built static files
#
# IMPORTANT: Build locally first with `bun run build` before docker build
#
# Build:   bun run build && docker build -t cbp-frontend .
# Run:     docker run -p 27100:80 cbp-frontend
# =============================================================================

# Production stage - nginx serving static files
FROM nginx:alpine

# Copy pre-built assets from local dist folder
COPY dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check using the /health endpoint defined in nginx.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:80/health > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
