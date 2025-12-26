FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY webhook_handler.py .

# Expose port
EXPOSE 27600

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:27600/health || exit 1

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:27600", "--workers", "2", "webhook_handler:app"]
