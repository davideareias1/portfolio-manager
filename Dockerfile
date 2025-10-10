# -------- Build stage --------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lockb* ./
# Use npm by default; if a lockfile exists for others, install the manager and use it
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm@9 && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f bun.lockb ]; then npm i -g bun && bun install --frozen-lockfile; \
    else npm ci; fi

# Copy source
COPY . .

# Build Next.js (standalone output)
RUN npm run build

# -------- Runtime stage --------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy standalone output and public assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port and run
ENV PORT=3000
EXPOSE 3000
USER nextjs
CMD ["node", "server.js"]
