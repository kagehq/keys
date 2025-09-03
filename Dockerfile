# Kage Keys Docker Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist/ ./dist/
COPY examples/ ./examples/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S kagekeys -u 1001

# Change ownership
RUN chown -R kagekeys:nodejs /app
USER kagekeys

# Expose ports
EXPOSE 3000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/cli.js health --port 3000 || exit 1

# Default command
CMD ["npm", "start"]
