# Multi-stage build - Use Node.js 22 for native module compilation
FROM node:22-slim as builder

# Install system dependencies for native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    pkg-config \
    libopus-dev \
    libsodium-dev \
    libtool \
    autoconf \
    automake \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Set environment variables for native compilation
ENV PYTHON=/usr/bin/python3
ENV NODE_GYP_FORCE_PYTHON=python3

# Install dependencies with npm
RUN npm install --legacy-peer-deps

# Production stage - Use Bun for runtime performance
FROM oven/bun:latest

# Install runtime dependencies including FFmpeg for audio processing
RUN apt-get update && apt-get install -y \
    libopus0 \
    libsodium23 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage (includes compiled native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy package files
COPY package.json ./

# Copy source code
COPY . .

# Start the application with Bun
CMD ["bun", "run", "index.ts"]
