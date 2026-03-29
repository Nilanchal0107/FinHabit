# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# ── Stage 2: Production Image ─────────────────────────────────────────────────
FROM node:20-slim AS runner

# Security: run as non-root
RUN groupadd -r finhabits && useradd -r -g finhabits finhabits

WORKDIR /app

# Copy only production node_modules and app source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

RUN chown -R finhabits:finhabits /app
USER finhabits

# Cloud Run injects PORT automatically
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check (Cloud Run uses this)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
