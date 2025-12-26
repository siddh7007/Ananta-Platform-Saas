# syntax=docker/dockerfile:1.4

# ==========================================
# CNS Dashboard - React Admin Frontend
# Uses pre-built dist folder (build locally first with `bun run build`)
# ==========================================

# Production server with nginx
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy nginx configuration template
COPY services/cns-service/dashboard/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy entrypoint script
COPY services/cns-service/dashboard/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy pre-built assets from local dist folder
# IMPORTANT: Run `bun run build` locally before building this image!
COPY services/cns-service/dashboard/dist /usr/share/nginx/html

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
