#!/bin/sh
set -e

# Default ports if not set
: ${CNS_DASHBOARD_PORT:=27810}
: ${CNS_PORT:=27800}

# Replace environment variables in nginx template
envsubst '${CNS_DASHBOARD_PORT} ${CNS_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
