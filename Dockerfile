# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

RUN bun install -g node-gyp

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create a non-root user for security
RUN addgroup --system --gid 1001 bun
RUN adduser --system --uid 1001 bun
RUN chown -R bun:bun /app
USER bun

# Start the application
CMD ["bun", "run", "index.ts"] 