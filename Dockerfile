# Multi-stage build for Discord bot with native sqlite3 compilation
FROM node:20-alpine AS builder

# Install build dependencies for sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set NODE_ENV (can be overridden by environment variable)
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
