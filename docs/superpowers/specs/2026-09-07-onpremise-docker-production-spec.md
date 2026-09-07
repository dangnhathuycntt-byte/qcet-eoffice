# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: ĐÓNG GÓI TRIỂN KHAI MÁY CHỦ NỘI BỘ ON-PREMISE & AN TOÀN DỮ LIỆU
**Tài liệu:** Technical Specification - On-Premise Infrastructure, Docker & Production Security  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 07/09/2026  
**Trạng thái:** DRAFT - CHỜ PHÊ DUYỆT  

---

## 1. MỤC TIÊU & THÔNG SỐ HẠ TẦNG MỤC TIÊU

### 1.1. Mục tiêu Triển khai
* Triển khai hệ thống QCET E-Office hoàn toàn độc lập trên hạ tầng máy chủ của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (On-Premise).
* Đảm bảo an toàn thông tin tối đa: Dữ liệu văn bản, hồ sơ công vụ và thông tin viên chức không lưu trữ trên đám mây công cộng (Public Cloud), tránh rủi ro vi phạm pháp luật về bảo vệ dữ liệu nội bộ.
* Tự động hóa toàn diện quy trình đóng gói (Dockerized), khởi động lại khi có sự cố, tự động sao lưu định kỳ hàng ngày và phục hồi thảm họa (Disaster Recovery).

### 1.2. Cấu hình Máy chủ Vật lý / Máy chủ Ảo (Target Hardware Specs)
* **Hệ điều hành:** Ubuntu Server 24.04 LTS (x86_64).
* **Tài nguyên tối thiểu:** 4 vCPU, 8 GB RAM, 100 GB SSD (Enterprise NVMe hoặc SATA Enterprise).
* **Tài nguyên khuyến nghị:** 8 vCPU, 16 GB RAM, 250 GB SSD (RAID 1 bảo vệ dữ liệu).
* **Môi trường:** Docker Engine 27+ và Docker Compose v2.

---

## 2. KIẾN TRÚC VẬN HÀNH MULTI-CONTAINER (DOCKER ARCHITECTURE)

Hệ thống được thiết kế theo mô hình 3 containers tách biệt, giao tiếp qua mạng nội bộ Docker cô lập (`qcet-internal-net`):

```
                       [ MẠNG LAN TRƯỜNG / TRUY CẬP HTTPS ]
                                         │
                                         ▼ (Port 80/443)
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTAINER: qcet-proxy                             │
│                      Nginx 1.27 Alpine Reverse Proxy                        │
│   • Cấu hình SSL/TLS (HTTPS) nội bộ    • Chặn DoS / Rate Limiting (10 req/s)│
│   • Giới hạn dung lượng tải PDF: 50MB  • Nén Gzip / Bộ nhớ đệm tài nguyên   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ (Port 3000 nội bộ)
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CONTAINER: qcet-app                              │
│                 Next.js 15 Standalone + Node.js 22 Alpine                   │
│   • Chạy dưới quyền non-root (nextjs:nodejs, UID 1001)                      │
│   • Next.js output: 'standalone' siêu nhẹ (~150MB thay vì 1GB+)             │
│   • Tích hợp Prisma Client & Healthcheck Endpoint (/api/health)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ (Port 5432 nội bộ)
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CONTAINER: qcet-db                              │
│                            PostgreSQL 16 Alpine                             │
│   • Docker Volume bền vững (qcet_pgdata)                                    │
│   • Tối ưu RAM cache (shared_buffers=1GB, work_mem=16MB)                    │
│   • Kịch bản sao lưu tự động hàng đêm (pg_dump nén gzip)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT TỆP CẤU HÌNH ĐÓNG GÓI (DOCKER & PROXY CONFIGS)

### 3.1. Cấu hình Multi-stage Dockerfile cho Next.js 15 (`Dockerfile`)
Áp dụng chiến lược 3 giai đoạn (Deps -> Builder -> Runner) để tối ưu kích thước image và nâng cao bảo mật:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Sinh Prisma Client cho production
RUN npx prisma generate
# Build Next.js ở chế độ Standalone
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl curl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Bảo mật: Chạy với user phi đặc quyền (non-root)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Sao chép các tệp tĩnh và standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### 3.2. Cấu hình `docker-compose.yml`
```yaml
version: '3.8'

services:
  qcet-db:
    image: postgres:16-alpine
    container_name: qcet-db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-qcet_admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-qcet_eoffice}
    volumes:
      - qcet_pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - qcet-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-qcet_admin} -d ${DB_NAME:-qcet_eoffice}"]
      interval: 10s
      timeout: 5s
      retries: 5

  qcet-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: qcet-app
    restart: always
    depends_on:
      qcet-db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${DB_USER:-qcet_admin}:${DB_PASSWORD}@qcet-db:5432/${DB_NAME:-qcet_eoffice}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NODE_ENV: production
    networks:
      - qcet-network

  qcet-proxy:
    image: nginx:1.27-alpine
    container_name: qcet-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - qcet_uploads:/var/www/uploads:ro
    depends_on:
      - qcet-app
    networks:
      - qcet-network

networks:
  qcet-network:
    driver: bridge

volumes:
  qcet_pgdata:
    driver: local
  qcet_uploads:
    driver: local
```

---

## 4. BẢO VỆ ĐỊNH TUYẾN & CHỐNG TẤN CÔNG (API SECURITY & MIDDLEWARE)

### 4.1. Cấu hình Chặn Truy cập Trái phép (`src/middleware.ts`)
Xây dựng middleware ở tầng mạng Next.js để kiểm soát phiên làm việc trước khi request chạm vào Server Components hoặc API routes:
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwtSession } from '@/lib/jwt-session';

const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/health', '/favicon.ico', '/_next'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cho phép các tuyến công khai
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Lấy token phiên từ cookie HttpOnly
  const token = request.cookies.get('qcet_session_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthorized)' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifyJwtSession(token);
  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('qcet_session_token');
    return response;
  }

  // Bảo vệ vùng làm việc Ban Giám hiệu (Executive Scope Guard)
  if (pathname.startsWith('/portal/executive') && session.role !== 'BAN_GIAM_HIEU' && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/portal?denied=1', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 4.2. Giám sát Sức khỏe Dịch vụ (`src/app/api/health/route.ts`)
Phục vụ Docker Healthcheck và các công cụ giám sát mạng (Uptime Kuma):
```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Kiểm tra kết nối CSDL PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: 'connected'
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Database connection failed'
    }, { status: 503 });
  }
}
```

---

## 5. CHIẾN LƯỢC SAO LƯU DỰ PHÒNG & KHÔI PHỤC THẢM HỌA (DISASTER RECOVERY)

### 5.1. Kịch bản Sao lưu Tự động Hàng đêm (`scripts/backup-db.sh`)
* **Thời gian thực hiện:** 00:30 mỗi đêm (qua Linux crontab).
* **Nội dung:** Sử dụng `pg_dump` nén trực tiếp ra file `.sql.gz`.
* **Chính sách lưu trữ (Retention Policy):**
  * Giữ lại bản sao lưu 7 ngày gần nhất trên ổ cứng máy chủ.
  * Tự động đồng bộ bản sao lưu sang máy chủ lưu trữ NAS thứ 2 của trường (qua giao thức `rsync` hoặc `sftp` an toàn).
* **Chỉ số RPO & RTO:**
  * **RPO (Recovery Point Objective):** Tối đa 24 giờ mất mát dữ liệu (có thể hạ xuống 1 giờ nếu cấu hình PostgreSQL WAL archiving).
  * **RTO (Recovery Time Objective):** Dưới 30 phút để nạp lại CSDL và khởi động lại toàn bộ stack dịch vụ.

### 5.2. Kịch bản Khôi phục Thử nghiệm (`scripts/restore-db.sh`)
Cung cấp script một câu lệnh cho quản trị viên mạng:
```bash
./scripts/restore-db.sh /path/to/backup_qcet_2026-09-07.sql.gz
```
Script tự động giải nén, kiểm tra tính toàn vẹn SHA-256, nạp lại vào PostgreSQL và kích hoạt kiểm tra tính hợp lệ của dữ liệu.
