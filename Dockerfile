# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies
RUN npm ci || npm install

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install dependencies for production only
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci --omit=dev || npm install --production

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend functions
COPY netlify/functions ./netlify/functions
COPY netlify/functions/lib ./netlify/functions/lib

# Copy config files
COPY data/ ./data/
COPY public/ ./public/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "netlify/functions/server.js"]
