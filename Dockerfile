# ==============================================================================
# GIAI ĐOẠN 1: BASE
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ==============================================================================
# GIAI ĐOẠN 2: DEPS
# ==============================================================================
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ==============================================================================
# GIAI ĐOẠN 2b: PROD DEPS (chỉ production dependencies, đủ closure cho Prisma CLI)
# ==============================================================================
FROM base AS proddeps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ==============================================================================
# GIAI ĐOẠN 3: BUILDER
# ==============================================================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# ==============================================================================
# GIAI ĐOẠN 4: RUNNER
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PATH="/app/node_modules/.bin:$PATH"

RUN apk add --no-cache curl openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Sao chép toàn bộ production node_modules phục vụ chạy migrate offline / airgapped.
# Prisma CLI cần đầy đủ dependency closure (@prisma/config -> effect -> fast-check, c12, ...),
# nên không thể cherry-pick từng package riêng lẻ.
COPY --from=proddeps --chown=nextjs:nodejs /app/node_modules ./node_modules
# Sao chép Prisma Client đã sinh từ stage builder đè vào node_modules của runner
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health/ready || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
