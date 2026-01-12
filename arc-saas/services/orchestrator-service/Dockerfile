# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
# Use --ignore-scripts to skip postinstall builds that require devDependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && npm install source-map-support --save

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

# Start the application
CMD ["node", "-r", "source-map-support/register", "./dist/__main__.js"]
