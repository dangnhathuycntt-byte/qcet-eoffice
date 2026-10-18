# qcet-web: trang (App Router), tài nguyên tĩnh, PWA. Không giữ bí mật server, không chạm CSDL/Redis/tệp;
# dữ liệu đọc qua API (API_INTERNAL_URL), /api của trình duyệt chuyển tiếp tới qcet-api.
# Build từ gốc repo: docker build -f apps/web/Dockerfile .
# ==============================================================================
# GIAI ĐOẠN 1: BASE
# ==============================================================================
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ==============================================================================
# GIAI ĐOẠN 2: DEPS
# ==============================================================================
FROM base AS deps
COPY package.json package-lock.json* ./
# npm workspaces: npm ci cần package.json của từng workspace để khớp lockfile
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# ==============================================================================
# GIAI ĐOẠN 3: BUILDER
# ==============================================================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Rewrites /api/:path* chốt vào bản build: địa chỉ qcet-api trong mạng compose
ARG API_INTERNAL_URL=http://qcet-api:3000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build -w @qcet/web

# ==============================================================================
# GIAI ĐOẠN 4: RUNNER
# ==============================================================================
FROM node:24-alpine AS runner
WORKDIR /app

ARG API_INTERNAL_URL=http://qcet-api:3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV SERVICE_NAME=qcet-web
# Trang gọi API khi render ở server (serverApiFetch)
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone giữ bố cục repo (outputFileTracingRoot = gốc): server ở apps/web/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Chỉ kiểm tiến trình web (tệp tĩnh), không phụ thuộc qcet-api
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/sw.js || exit 1

CMD ["node", "apps/web/server.js"]
