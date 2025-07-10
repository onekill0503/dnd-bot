# Multi-stage build for better native compilation
FROM oven/bun:latest as builder

# Install system dependencies for native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    pkg-config \
    libopus-dev \
    libsodium-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install node-gyp globally
RUN bun install -g node-gyp

# Set environment variables for native compilation
ENV PYTHON=/usr/bin/python3
ENV NODE_GYP_FORCE_PYTHON=python3
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install dependencies with verbose output for debugging
RUN bun install --frozen-lockfile --verbose

# Production stage
FROM oven/bun:latest

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libopus0 \
    libsodium23 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy package files
COPY package.json bun.lockb ./

# Copy source code
COPY . .

# Create a non-root user for security
RUN addgroup --system --gid 1001 bun
RUN adduser --system --uid 1001 bun
RUN chown -R bun:bun /app
USER bun

# Start the application
CMD ["bun", "run", "index.ts"] 