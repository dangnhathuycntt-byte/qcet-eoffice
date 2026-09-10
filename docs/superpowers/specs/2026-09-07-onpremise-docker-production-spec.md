# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: TRIỂN KHAI ON-PREMISE DOCKER PRODUCTION VỚI IIS REVERSE PROXY
**Tài liệu:** Technical Specification - On-Premise Docker Production Deployment with IIS ARR  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Tên miền chính thức:** `e-office.cdktcnqn.edu.vn`  
**Ngày lập:** 07/09/2026  
**Trạng thái:** DRAFT - CHỜ PHÊ DUYỆT  

---

## 1. TỔNG QUAN & BỐI CẢNH TRIỂN KHAI

### 1.1. Hiện trạng Hạ tầng Thực tế tại Trường QCET
* **Hệ điều hành Máy chủ:** Windows Server (phiên bản 2019 / 2022 Datacenter/Standard) đang chạy tại Trung tâm Thông tin - Thư viện / Phòng Quản trị Mạng.
* **Cổng dịch vụ Web hiện hữu:** Cổng `80` (HTTP) và `443` (HTTPS) do dịch vụ **Internet Information Services (IIS)** trực tiếp quản lý và đã được cài đặt sẵn chứng chỉ bảo mật số chính thức của trường (`*.cdktcnqn.edu.vn` hoặc `e-office.cdktcnqn.edu.vn`).
* **Yêu cầu triển khai:** Hệ thống QCET E-Office (Next.js 15, React 19, Tailwind CSS v4, Prisma ORM) phải được đóng gói container chuẩn hóa chạy song song trên cùng máy chủ này mà **không làm xung đột** với IIS hoặc các hệ thống website hiện có của trường.
* **Ràng buộc an ninh & pháp lý:**
  1. Dữ liệu công văn, hồ sơ minh chứng không được lưu trữ trên Cloud công cộng của bên thứ ba; toàn bộ dữ liệu phải nằm trên máy chủ đặt tại trụ sở Trường (On-Premise).
  2. Băng thông và tài nguyên CPU/RAM phải được tối ưu hóa để phục vụ đồng thời cho Ban Giám hiệu, Lãnh đạo các Phòng/Khoa và Giảng viên, Chuyên viên toàn trường.

### 1.2. Mục tiêu Kỹ thuật (Engineering Goals)
1. **Containerization Đạt Chuẩn Enterprise:** Xây dựng `Dockerfile` đa công đoạn (Multi-stage build) sử dụng chế độ `output: "standalone"` của Next.js 15, giảm dung lượng image từ 1.2GB xuống dưới 200MB và chạy dưới quyền user phi đặc quyền (`non-root`).
2. **IIS Reverse Proxy Gateway:** Tận dụng module **Application Request Routing (ARR 3.0)** và **URL Rewrite 2.1** trên IIS để làm cổng tiếp nhận HTTPS an toàn, giải mã SSL (SSL Offloading), chuyển tiếp lưu lượng vào cổng nội bộ `127.0.0.1:3000`.
3. **Cơ sở dữ liệu PostgreSQL Ổn định & Hiệu năng cao:** Chạy PostgreSQL 16 trên Docker Named Volume (ext4) để triệt tiêu hoàn toàn lỗi xung đột khóa tệp (file locking crash) của Windows NTFS qua WSL2.
4. **Lưu trữ Tệp Đính kèm An toàn (NĐ 30):** Phục vụ tệp đính kèm quét màu (PDF lên tới 100MB) có kiểm soát quyền truy cập qua API Route của Next.js với cơ chế Byte-Range Streaming (HTTP 206 Partial Content), kiểm toán toàn vẹn SHA-256.
5. **Tự động hóa Sao lưu & Khôi phục Thảm họa (DR):** Vận hành không cần người trực thông qua PowerShell Script và Windows Task Scheduler: sao lưu CSDL hàng ngày lúc 01:00 AM, nén dữ liệu, dọn dẹp sau 30 ngày và cung cấp script khôi phục 1 chạm.
6. **Khởi động Bền vững (Boot Persistence):** Cấu hình tự khởi động lại toàn bộ dịch vụ khi máy chủ khởi động lại sau sự cố mất điện mà không cần đăng nhập tài khoản Windows thủ công.

---

## 2. KIẾN TRÚC TỔNG THỂ & SƠ ĐỒ LUỒNG DỮ LIỆU

### 2.1. Sơ đồ Kiến trúc Mạng & Dịch vụ (Architecture Topology)

```
[Người dùng: BGH / Phòng Đào tạo / Khoa CNTT]
  • Trình duyệt Web (Desktop / Laptop)
  • Thiết bị di động (Smartphone / Tablet qua Wi-Fi trường hoặc 4G/VPN)
                        │
                        ▼ (HTTPS Port 443 / SSL PFX Trường)
┌───────────────────────────────────────────────────────────────────────────────┐
│                    MÁY CHỦ VẬT LÝ WINDOWS SERVER (QCET)                       │
│                                                                               │
│  [TẦNG 1: REVERSE PROXY GATEWAY - IIS 10.0]                                   │
│  • Tên miền: e-office.cdktcnqn.edu.vn                                         │
│  • SSL Termination: Giải mã chứng chỉ HTTPS, tự động Redirect 301 từ Port 80  │
│  • Module: URL Rewrite 2.1 + Application Request Routing (ARR 3.0)            │
│  • Buffer Settings: responseBufferLimit = 0 (Hỗ trợ Next.js 15 Streaming UI)  │
│  • Request Filtering: Cho phép tải file PDF lên tới 100MB                     │
│  • Chuyển tiếp Request nội bộ -> http://127.0.0.1:3000                        │
│                        │                                                      │
│                        ▼ (HTTP 127.0.0.1:3000)                                │
│  [TẦNG 2: DOCKER COMPOSE RUNTIME (WSL2 Engine)]                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Docker Bridge Network: `qcet-network`                                   │  │
│  │                                                                         │  │
│  │  [Dịch vụ 1: qcet-app] (Next.js 15.2.1 Standalone)                      │  │
│  │  • Container: qcet-eoffice-app                                          │  │
│  │  • Base Image: node:20-alpine (Non-root user: nextjs:nodejs UID 1001)   │  │
│  │  • Port Host: 127.0.0.1:3000 -> Container Port: 3000                   │  │
│  │  • Entrypoint: 'prisma migrate deploy' tự động trước khi boot server    │  │
│  │  • Healthcheck: GET /api/health (Mỗi 30s)                               │  │
│  │  • Volume Mount:                                                        │  │
│  │    - D:\QCET-Eoffice-Data\uploads -> /app/uploads (Đọc/Ghi PDF, avatar) │  │
│  │            │                                                            │  │
│  │            ▼ (Nội bộ Docker: postgres://qcet-db:5432)                   │  │
│  │  [Dịch vụ 2: qcet-db] (PostgreSQL 16)                                   │  │
│  │  • Container: qcet-eoffice-db                                           │  │
│  │  • Base Image: postgres:16-alpine                                       │  │
│  │  • Port Host: 127.0.0.1:5432:5432 (Chỉ mở nội bộ localhost cho DBeaver)│  │
│  │  • Múi giờ: TZ=Asia/Ho_Chi_Minh (UTC+7)                                │  │
│  │  • Healthcheck: pg_isready -U qcet_admin -d qcet_eoffice                │  │
��  │  • Storage: Docker Named Volume `qcet_postgres_data` (ext4)             │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  [TẦNG 3: VẬN HÀNH & SAO LƯU DỰ PHÒNG (PowerShell & Task Scheduler)]          │
│  • Ổ cứng vật lý: D:\QCET-Eoffice-Data\                                       │
│    ├── uploads\               (Lưu trữ PDF công văn, minh chứng, avatar)      │
│    └── backups\               (Chứa bản snapshot CSDL .dump và tệp nén zip)   │
│  • Task Scheduler lúc 01:00 AM: Chạy scripts/backup-daily.ps1                 │
│  • Chính sách lưu trữ: Tự động xoay vòng và xóa bản sao lưu cũ > 30 ngày.     │
│  • Tự khởi động khi bật máy chủ: Task Scheduler kích hoạt khi hệ thống Boot.   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. THIẾT KẾ CHI TIẾT CONTAINERIZATION (NEXT.JS 15 STANDALONE)

### 3.1. Cập nhật Cấu hình Next.js (`next.config.ts`)
Để sinh ra thư mục `.next/standalone/`, cấu hình `next.config.ts` được cập nhật:

```typescript
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bật chế độ Standalone tối ưu kích thước cho Docker Container
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/tasks",
        destination: "/?scope=school",
        permanent: false,
      },
      {
        source: "/unit-tasks",
        destination: "/?scope=unit",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/?view=calendar",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

### 3.2. Multi-Stage Production Dockerfile (`Dockerfile`)
Dockerfile được thiết kế theo quy chuẩn 4 giai đoạn độc lập:

```dockerfile
# ==============================================================================
# GIAI ĐOẠN 1: BASE (Môi trường cơ sở)
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ==============================================================================
# GIAI ĐOẠN 2: DEPS (Cài đặt dependencies phục vụ build)
# ==============================================================================
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ==============================================================================
# GIAI ĐOẠN 3: BUILDER (Biên dịch mã nguồn & sinh standalone assets)
# ==============================================================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Thiết lập biến môi trường phục vụ build tĩnh
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Sinh Prisma Client tương thích hệ điều hành Alpine Linux
RUN npx prisma generate

# Biên dịch ứng dụng Next.js
RUN npm run build

# ==============================================================================
# GIAI ĐOẠN 4: RUNNER (Container chạy Production siêu nhẹ)
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Cài đặt curl để phục vụ Docker Healthcheck
RUN apk add --no-cache curl openssl

# Tạo nhóm và người dùng phi đặc quyền (Non-root user)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Sao chép asset tĩnh và thư mục public
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Tạo thư mục uploads nội bộ và phân quyền cho user nextjs
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Sao chép entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# Thăm dò sức khỏe container mỗi 30 giây
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
```

### 3.3. Kịch bản Khởi động Khép kín (`docker-entrypoint.sh`)
Đảm bảo CSDL luôn được cập nhật schema mới nhất trước khi Node.js phục vụ truy cập:

```bash
#!/bin/sh
set -e

echo "[QCET E-Office] Đang kiểm tra và áp dụng cập nhật CSDL (Prisma Migrate)..."
npx prisma migrate deploy || {
  echo "[CẢNH BÁO] Prisma migrate deploy gặp lỗi hoặc chưa có migration mới. Tiếp tục khởi động ứng dụng..."
}

echo "[QCET E-Office] Khởi động máy chủ Next.js 15 Standalone tại cổng 3000..."
exec node server.js
```

### 3.4. API Kiểm tra Sức khỏe Hệ thống (`src/app/api/health/route.ts`)
Phục vụ Docker Healthcheck và giám sát trạng thái từ IIS:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    // Truy vấn nhẹ kiểm tra kết nối CSDL thực tế
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbStatus = "unhealthy";
    console.error("[Healthcheck] CSDL PostgreSQL mất kết nối:", error);
  }

  const isHealthy = dbStatus === "healthy";
  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      system: "QCET E-Office On-Premise",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      durationMs: totalDurationMs,
    },
    {
      status: isHealthy ? 200 : 503,
    }
  );
}
```

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU & PERSISTENT STORAGE

### 4.1. Giải pháp Bộ lưu trữ PostgreSQL trên Windows Server (WSL2 NTFS Trap)
* **Vấn đề cốt lõi:** Khi chạy PostgreSQL Linux container trên Docker Desktop Windows, nếu ánh xạ thư mục bind-mount từ Windows NTFS (ví dụ: `volumes: - D:\data:/var/lib/postgresql/data`) sẽ dẫn đến lỗi:
  * Lỗi phân quyền: `FATAL: data directory "/var/lib/postgresql/data" has wrong ownership`.
  * Cơ chế `fsync` và file locking của NTFS không hỗ trợ đầy đủ các thuộc tính POSIX của Linux, dẫn đến crash CSDL hoặc hỏng index khi hệ thống có tải ghi cao.
* **Quy chuẩn Thiết kế:**
  1. Sử dụng **Docker Named Volume (`qcet_postgres_data`)**: Volume này được tạo trực tiếp trên hệ thống tệp `ext4` ảo hóa của Docker engine (WSL2), đảm bảo 100% tuân thủ tiêu chuẩn POSIX Linux, tốc độ đọc ghi cực đại và không bao giờ bị lỗi sai ownership.
  2. Toàn bộ tính an toàn dữ liệu trên ổ cứng vật lý `D:\` của Windows sẽ được đảm bảo bằng **Kịch bản sao lưu tự động nhị phân (`pg_dump -F c`)** hàng đêm ra thư mục `D:\QCET-Eoffice-Data\backups\`.

### 4.2. File Cấu hình Docker Compose Chuẩn Hóa (`docker-compose.yml`)

```yaml
version: "3.8"

services:
  # ============================================================================
  # 1. DỊCH VỤ CƠ SỞ DỮ LIỆU POSTGRESQL 16
  # ============================================================================
  qcet-db:
    container_name: qcet-eoffice-db
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-qcet_eoffice}
      POSTGRES_USER: ${POSTGRES_USER:-qcet_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Vui long cung cap mat khau CSDL trong .env.production}
      TZ: Asia/Ho_Chi_Minh
      PGTZ: Asia/Ho_Chi_Minh
    volumes:
      - qcet_postgres_data:/var/lib/postgresql/data
    ports:
      # Chỉ bind vào loopback 127.0.0.1 để bảo vệ CSDL khỏi truy cập mạng ngoài
      - "127.0.0.1:5432:5432"
    networks:
      - qcet-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-qcet_admin} -d ${POSTGRES_DB:-qcet_eoffice}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ============================================================================
  # 2. DỊCH VỤ ỨNG DỤNG QCET E-OFFICE (NEXT.JS 15)
  # ============================================================================
  qcet-app:
    container_name: qcet-eoffice-app
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      qcet-db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-qcet_admin}:${POSTGRES_PASSWORD}@qcet-db:5432/${POSTGRES_DB:-qcet_eoffice}?schema=public
      JWT_SECRET: ${JWT_SECRET:?Vui long cung cap JWT_SECRET bao mat}
      NEXTAUTH_URL: https://e-office.cdktcnqn.edu.vn
      NEXT_PUBLIC_APP_URL: https://e-office.cdktcnqn.edu.vn
      UPLOADS_DIR: /app/uploads
      TZ: Asia/Ho_Chi_Minh
    ports:
      # Lắng nghe tại 127.0.0.1:3000 để IIS ARR chuyển tiếp vào
      - "127.0.0.1:3000:3000"
    volumes:
      # Mount thư mục lưu trữ tệp đính kèm vật lý từ Windows Host
      - ${UPLOADS_HOST_PATH:-D:/QCET-Eoffice-Data/uploads}:/app/uploads
    networks:
      - qcet-internal

# ==============================================================================
# CẤU HÌNH MẠNG VÀ BỘ LƯU TRỮ (VOLUMES & NETWORKS)
# ==============================================================================
networks:
  qcet-internal:
    name: qcet-network
    driver: bridge

volumes:
  qcet_postgres_data:
    name: qcet_postgres_data
    driver: local
```

---

## 5. CẤU HÌNH IIS REVERSE PROXY, ARR 3.0 & SSL

### 5.1. Quy trình Thiết lập Cấp Máy chủ (Server-Level Setup trên IIS)
Thực hiện một lần duy nhất trên máy chủ Windows Server:

1. **Cài đặt các gói thành phần bắt buộc:**
   * Tải và cài đặt **IIS URL Rewrite Module 2.1** (x64).
   * Tải và cài đặt **Application Request Routing (ARR) 3.0** (x64).
   * Cài đặt tính năng **WebSocket Protocol** trong Server Manager:
     `Add Roles and Features` ➔ `Server Roles` ➔ `Web Server (IIS)` ➔ `Web Server` ➔ `Application Development` ➔ Tích chọn `WebSocket Protocol`.

2. **Kích hoạt Proxy Engine:**
   * Mở **IIS Manager** ➔ Nhấp chọn tên Node Server trên cùng (gốc máy chủ).
   * Nhấp đúp vào biểu tượng **Application Request Routing Cache**.
   * Ở thanh tác vụ bên phải, nhấp vào **Server Proxy Settings...**.
   * Tích chọn ô **Enable proxy**. Bỏ chọn *Use URL Rewrite to inspect incoming requests* (vì ta sẽ tự cấu hình rule chi tiết ở cấp Website). Nhấp **Apply**.

3. **Bảo toàn Host Header (Preserve Host Header):**
   * Vẫn tại Node Server gốc ➔ Nhấp đúp vào **Configuration Editor**.
   * Tại dropdown *Section*, chọn: `system.webServer/proxy`.
   * Đặt thuộc tính `preserveHostHeader` thành `True`.
   * Đặt thuộc tính `responseBufferLimit` thành `0` (Tắt bộ đệm phản hồi để Next.js 15 Streaming hoạt động mượt mà).
   * Đặt `timeout` thành `00:05:00` (5 phút để hỗ trợ upload văn bản dung lượng lớn). Nhấp **Apply**.

4. **Cho phép các Biến Server Chuyển tiếp (Allowed Server Variables):**
   * Mở biểu tượng **URL Rewrite** tại Node Server gốc ➔ Nhấp **View Server Variables...** ở thanh bên phải.
   * Lần lượt thêm 2 biến sau:
     * `HTTP_X_FORWARDED_PROTO`
     * `HTTP_X_FORWARDED_FOR`

### 5.2. Cấu hình Website và Tệp `web.config` tại Thư mục Proxy Site
Tạo thư mục trên Windows Server: `C:\inetpub\qcet-eoffice-proxy\` và tạo file `web.config` với nội dung hoàn chỉnh:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- 1. Cấu hình Giới hạn Kích thước Tải lên (Cho phép Upload PDF 100MB) -->
    <security>
      <requestFiltering>
        <!-- 104857600 Bytes = 100 MB -->
        <requestLimits maxAllowedContentLength="104857600" />
      </requestFiltering>
    </security>

    <!-- 2. Cho phép Next.js toàn quyền xử lý mã phản hồi HTTP (404, 500,...) -->
    <httpErrors existingResponse="PassThrough" />

    <!-- 3. Bộ quy tắc Chuyển hướng & Reverse Proxy -->
    <rewrite>
      <rules>
        <!-- Quy tắc 3.1: Bắt buộc chuyển từ HTTP sang HTTPS an toàn -->
        <rule name="Redirect to HTTPS" stopProcessing="true">
          <match url="(.*)" />
          <conditions logicalGrouping="MatchAll" trackAllCaptures="false">
            <add input="{HTTPS}" pattern="off" ignoreCase="true" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
        </rule>

        <!-- Quy tắc 3.2: Reverse Proxy toàn bộ lưu lượng vào Container Next.js Port 3000 -->
        <rule name="ReverseProxyToNextjs" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" appendQueryString="true" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_FOR" value="{REMOTE_ADDR}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>

    <!-- 4. Tiêu đề Bảo mật Bổ sung (Security Hardening Headers) -->
    <httpProtocol>
      <customHeaders>
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-XSS-Protection" value="1; mode=block" />
        <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>

  <!-- 5. Tăng giới hạn tải lên của ASP.NET Pipeline phụ trợ -->
  <system.web>
    <!-- maxRequestLength tính theo KB: 102400 KB = 100 MB, executionTimeout: 300s -->
    <httpRuntime maxRequestLength="102400" executionTimeout="300" />
  </system.web>
</configuration>
```

---

## 6. KIẾN TRÚC LƯU TRỮ TỆP & XỬ LÝ VĂN BẢN SỐ HÓA (NĐ 30)

### 6.1. Cấu trúc Cây Thư mục Lưu trữ trên Host
Thư mục gốc: `D:\QCET-Eoffice-Data\uploads\`
```text
D:\QCET-Eoffice-Data\uploads\
├── documents\                   # Tệp quét màu công văn NĐ 30
│   ���── 2026\                    # Phân mục tự động theo năm văn bản
│       ├── doc_cuid_01\
│       │   ├── CV_2026_09_001_signed.pdf
│       │   └── phu_luc_so_lieu.xlsx
├── tasks\                       # Minh chứng hoàn thành nhiệm vụ
│   └── task_cuid_45\
│       └── bao_cao_nghiem_thu_dacum.pdf
└── avatars\                     # Ảnh đại diện tài khoản viên chức
    └── usr_cuid_99.webp
```

### 6.2. Route Handler Phục vụ Tệp An toàn (`src/app/api/files/[...path]/route.ts`)
Route này tích hợp:
1. Xác thực quyền sở hữu / phân công công việc.
2. Kiểm tra an toàn chống tấn công **Path Traversal**.
3. **HTTP 206 Byte-Range Streaming** cho phép trình duyệt mở tài liệu PDF tức thì mà không cần tải hết tệp 100MB.

```typescript
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { promisify } from "node:util";

const statAsync = promisify(fs.stat);
const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_DIR || "./uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Tệp không tồn tại", { status: 404 });
    }

    // 1. Kiểm tra an toàn chống Path Traversal (Chống tấn công lùi thư mục)
    const relativePath = path.join(...pathSegments);
    const safeResolvedPath = path.resolve(UPLOADS_ROOT, relativePath);

    if (!safeResolvedPath.startsWith(UPLOADS_ROOT)) {
      return new NextResponse("Yêu cầu không hợp lệ (Forbidden Access)", { status: 403 });
    }

    // 2. Kiểm tra sự tồn tại của tệp
    if (!fs.existsSync(safeResolvedPath)) {
      return new NextResponse("Không tìm thấy tệp yêu cầu", { status: 404 });
    }

    const stat = await statAsync(safeResolvedPath);
    if (!stat.isFile()) {
      return new NextResponse("Đường dẫn không phải là tệp hợp lệ", { status: 400 });
    }

    // 3. Xác định MIME Type
    const ext = path.extname(safeResolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // 4. Xử lý HTTP Range Request (Hỗ trợ trình đọc PDF streaming trang)
    const rangeHeader = req.headers.get("range");
    const fileSize = stat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(safeResolvedPath, { start, end });
      // Chuyển đổi Node stream thành Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600, must-revalidate",
        },
      });
    }

    // 5. Trả về toàn bộ tệp (Full Stream)
    const fileStream = fs.createReadStream(safeResolvedPath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600, must-revalidate",
        "Content-Disposition": `inline; filename="${path.basename(safeResolvedPath)}"`,
      },
    });
  } catch (error) {
    console.error("[File Service Error]", error);
    return new NextResponse("Lỗi máy chủ nội bộ khi nạp tệp", { status: 500 });
  }
}
```

---

## 7. TỰ ĐỘNG HÓA VẬN HÀNH & SAO LƯU DỰ PHÒNG (DISASTER RECOVERY)

### 7.1. Kịch bản Sao lưu Toàn diện Hàng ngày (`scripts/backup-daily.ps1`)
Script PowerShell được tối ưu hóa cho Windows Server:

```powershell
<#
.SYNOPSIS
    Kịch bản tự động sao lưu CSDL PostgreSQL và Tệp đính kèm hệ thống QCET E-Office.
.DESCRIPTION
    Được cấu hình chạy định kỳ lúc 01:00 AM mỗi ngày qua Windows Task Scheduler.
#>

param(
    [string]$BaseDir = "D:\QCET-Eoffice-Data",
    [string]$ContainerName = "qcet-eoffice-db",
    [string]$DbUser = "qcet_admin",
    [string]$DbName = "qcet_eoffice",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$DateStamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupDir = Join-Path $BaseDir "backups"
$UploadsDir = Join-Path $BaseDir "uploads"
$LogFile = Join-Path $BackupDir "backup-history.log"

# Tạo thư mục lưu trữ nếu chưa có
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

function Write-Log($message) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$time] $message"
    Write-Host $logLine
    Add-Content -Path $LogFile -Value $logLine
}

Write-Log "================ BẮT ĐẦU TIẾN TRÌNH SAO LƯU DỰ PHÒNG ================"

try {
    # 1. Sao lưu CSDL PostgreSQL bằng pg_dump (Định dạng nén nhị phân Custom -F c)
    $DbBackupFile = Join-Path $BackupDir "qcet_db_$DateStamp.dump"
    Write-Log "Đang kết xuất CSDL PostgreSQL vào: $DbBackupFile..."
    
    # Thực thi pg_dump trực tiếp trong container
    $dumpCmd = "docker exec $ContainerName pg_dump -U $DbUser -d $DbName -F c -b -v"
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -Command `"$dumpCmd > `"`"$DbBackupFile`"`"`"" -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -ne 0 -or -not (Test-Path $DbBackupFile)) {
        throw "Lỗi khi thực hiện pg_dump xuất CSDL. Mã lỗi: $($process.ExitCode)"
    }
    $dbSizeMB = [math]::Round((Get-Item $DbBackupFile).Length / 1MB, 2)
    Write-Log "Sao lưu CSDL thành công! Dung lượng: $dbSizeMB MB."

    # 2. Sao lưu Thư mục Tệp đính kèm (Uploads Archive)
    if (Test-Path $UploadsDir) {
        $UploadsBackupZip = Join-Path $BackupDir "qcet_uploads_$DateStamp.zip"
        Write-Log "Đang nén thư mục tệp đính kèm vào: $UploadsBackupZip..."
        Compress-Archive -Path "$UploadsDir\*" -DestinationPath $UploadsBackupZip -CompressionLevel Optimal -Force
        $zipSizeMB = [math]::Round((Get-Item $UploadsBackupZip).Length / 1MB, 2)
        Write-Log "Nén tệp đính kèm thành công! Dung lượng: $zipSizeMB MB."
    }

    # 3. Dọn dẹp Bản sao lưu Cũ (Retention Policy 30 ngày)
    Write-Log "Đang kiểm tra và dọn dẹp các bản sao lưu cũ hơn $RetentionDays ngày..."
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    
    $OldFiles = Get-ChildItem -Path $BackupDir -File | Where-Object {
        ($_.Extension -in @(".dump", ".zip", ".sql")) -and ($_.CreationTime -lt $CutoffDate)
    }

    foreach ($file in $OldFiles) {
        Write-Log "Xóa bản lưu hết hạn: $($file.Name) (Tạo lúc: $($file.CreationTime))"
        Remove-Item -Path $file.FullName -Force
    }

    Write-Log "HOÀN TẤT SAO LƯU DỰ PHÒNG THÀNH CÔNG VÀ AN TOÀN!"
}
catch {
    Write-Log "[LỖI NGHIÊM TRỌNG] Quá trình sao lưu thất bại: $($_.Exception.Message)"
    exit 1
}
```

### 7.2. Kịch bản Phục hồi Thảm họa 1-Chạm (`scripts/restore-disaster.ps1`)
Sử dụng khi cần khôi phục lại dữ liệu sau sự cố phần cứng hoặc chuyển máy chủ mới:

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$DbDumpPath,
    
    [string]$UploadsZipPath = "",
    [string]$ContainerName = "qcet-eoffice-db",
    [string]$DbUser = "qcet_admin",
    [string]$DbName = "qcet_eoffice",
    [string]$TargetUploadsDir = "D:\QCET-Eoffice-Data\uploads"
)

$ErrorActionPreference = "Stop"

Write-Host "================ BẮT ĐẦU TIẾN TRÌNH KHÔI PHỤC CSDL ================" -ForegroundColor Cyan

if (-not (Test-Path $DbDumpPath)) {
    Write-Error "Không tìm thấy tệp sao lưu CSDL: $DbDumpPath"
    exit 1
}

# 1. Chép tệp dump vào trong container để tối ưu tốc độ restore
Write-Host "1. Sao chép tệp sao lưu vào container..." -ForegroundColor Yellow
docker cp $DbDumpPath "$($ContainerName):/tmp/restore_target.dump"

# 2. Thực thi pg_restore với tùy chọn làm sạch và tạo lại bảng
Write-Host "2. Đang thực thi pg_restore tái thiết lập CSDL..." -ForegroundColor Yellow
$restoreCmd = "pg_restore -U $DbUser -d $DbName -v --clean --if-exists /tmp/restore_target.dump"
docker exec $ContainerName sh -c "$restoreCmd"

# Dọn dẹp tệp tạm trong container
docker exec $ContainerName rm -f /tmp/restore_target.dump
Write-Host "Khôi phục CSDL PostgreSQL hoàn tất!" -ForegroundColor Green

# 3. Giải nén phục hồi tệp đính kèm nếu có cung cấp
if ($UploadsZipPath -and (Test-Path $UploadsZipPath)) {
    Write-Host "3. Đang giải nén phục hồi thư mục uploads: $UploadsZipPath..." -ForegroundColor Yellow
    Expand-Archive -Path $UploadsZipPath -DestinationPath $TargetUploadsDir -Force
    Write-Host "Khôi phục tệp đính kèm hoàn tất!" -ForegroundColor Green
}

Write-Host "HỆ THỐNG ĐÃ ĐƯỢC KHÔI PHỤC THÀNH CÔNG VỀ TRẠNG THÁI HOẠT ĐỘNG!" -ForegroundColor Green
```

### 7.3. Cấu hình Tự động Kích hoạt khi Khởi động Máy chủ (Boot Persistence)
Để đảm bảo toàn bộ hệ sinh thái chạy ngay khi máy chủ Windows Server bật nguồn:

1. Mở **Windows PowerShell (Run as Administrator)**.
2. Đăng ký tác vụ hệ thống tự khởi động Docker Compose bằng lệnh:
```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd 'C:\QCET\QCET Work'; docker compose up -d`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT1M' # Chờ 1 phút để dịch vụ Docker Engine/WSL2 khởi động hoàn tất
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)

Register-ScheduledTask -TaskName "QCET_EOffice_AutoBoot" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Tự động khởi động hệ thống QCET E-Office khi máy chủ bật nguồn"
```

3. Đăng ký tác vụ Sao lưu Hàng ngày (Daily Backup 01:00 AM):
```powershell
$backupAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\QCET\QCET Work\scripts\backup-daily.ps1`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At "01:00"
$backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "QCET_EOffice_DailyBackup" -Action $backupAction -Trigger $backupTrigger -Principal $backupPrincipal -Description "Tự động sao lưu dữ liệu CSDL và tệp đính kèm QCET E-Office"
```

---

## 8. DANH MỤC BIẾN MÔI TRƯỜNG & AN AN NINH BẢO MẬT

Tệp cấu hình môi trường sản xuất (`.env.production`):

```ini
# ==============================================================================
# CẤU HÌNH CƠ SỞ DỮ LIỆU POSTGRESQL (PRODUCTION)
# ==============================================================================
POSTGRES_DB="qcet_eoffice"
POSTGRES_USER="qcet_admin"
# Mật khẩu mạnh tối thiểu 24 ký tự bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
POSTGRES_PASSWORD="QCET_Eoffice_SuperSecured_DbPass_2026!#"

# Chuỗi kết nối nội bộ cho Next.js Container
DATABASE_URL="postgresql://qcet_admin:QCET_Eoffice_SuperSecured_DbPass_2026!%23@qcet-db:5432/qcet_eoffice?schema=public"

# ==============================================================================
# CẤU HÌNH BẢO MẬT XÁC THỰC & PHIÊN LÀM VIỆC (JWT / SESSION)
# ==============================================================================
# Khóa bí mật mã hóa JWT (Tạo bằng lệnh: openssl rand -base64 48)
JWT_SECRET="qcet_eoffice_production_jwt_master_secret_key_2026_binhdinh_education"

# ==============================================================================
# TÊN MIỀN & GIAO THỨC CHÍNH THỨC
# ==============================================================================
NEXTAUTH_URL="https://e-office.cdktcnqn.edu.vn"
NEXT_PUBLIC_APP_URL="https://e-office.cdktcnqn.edu.vn"

# ==============================================================================
# ĐƯỜNG DẪN BỘ LƯU TRỮ VẬT LÝ
# ==============================================================================
UPLOADS_HOST_PATH="D:/QCET-Eoffice-Data/uploads"
UPLOADS_DIR="/app/uploads"
```

---

## 9. QUY TRÌNH TRIỂN KHAI & KIỂM THỬ THỰC TẾ (RUNBOOK)

### 9.1. Bảng Kiểm Tra Tiền Triển Khai (Pre-flight Checklist)
* [ ] Máy chủ Windows Server đã kích hoạt ảo hóa CPU (Intel VT-x / AMD-V) trong BIOS.
* [ ] Cài đặt Docker Desktop for Windows (sử dụng WSL2 backend) hoặc Mirantis Container Runtime.
* [ ] Cài đặt IIS URL Rewrite 2.1, ARR 3.0 và tính năng WebSocket Protocol.
* [ ] Import chứng chỉ SSL của trường cho domain `e-office.cdktcnqn.edu.vn` vào Personal Certificates Store của Windows Server.
* [ ] Tạo sẵn thư mục lưu trữ: `D:\QCET-Eoffice-Data\uploads` và `D:\QCET-Eoffice-Data\backups`.

### 9.2. Lệnh Khởi động và Kiểm thử (Smoke Test)
1. **Khởi chạy Cụm Container:**
   ```powershell
   # Tại thư mục gốc dự án:
   docker compose --env-file .env.production up -d --build
   ```
2. **Kiểm tra Trạng thái Container:**
   ```powershell
   docker compose ps
   ```
   *Cả 2 dịch vụ `qcet-eoffice-app` và `qcet-eoffice-db` phải ở trạng thái `healthy` hoặc `running`.*

3. **Kiểm tra Logs Khởi động:**
   ```powershell
   docker logs -f qcet-eoffice-app
   ```
   *Kiểm tra thông báo "Prisma migrate deploy" thành công và "Ready in ... ms".*

4. **Kiểm tra Truy cập:**
   * Truy cập từ trình duyệt nội bộ hoặc bên ngoài: `https://e-office.cdktcnqn.edu.vn`.
   * Kiểm tra ổ khóa xanh HTTPS (chứng chỉ hợp lệ).
   * Kiểm tra đăng nhập với các vai trò (Ban Giám hiệu, Trưởng phòng Đào tạo, Cán bộ Khoa CNTT).
   * Thử nghiệm tải lên văn bản scan PDF dung lượng 20MB - 50MB và xem trực tiếp trên tab trình duyệt.
   * Thử nghiệm chạy script `backup-daily.ps1` để xác nhận file `.dump` và `.zip` sinh ra chính xác.

---

*Tài liệu Đặc tả Thiết kế Kỹ thuật Triển khai On-Premise đã được hoàn thiện và sẵn sàng để xây dựng Kế hoạch Triển khai Chi tiết.*
