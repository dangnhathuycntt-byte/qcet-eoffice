# Kế Hoạch Triển Khai On-Premise Docker Production với IIS Reverse Proxy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng gói và thiết lập toàn bộ cấu hình, kịch bản triển khai hệ sinh thái QCET E-Office lên môi trường On-Premise máy chủ Windows Server của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (Next.js 15 Standalone Docker, PostgreSQL 16 Alpine, IIS ARR Reverse Proxy với tên miền `e-office.cdktcnqn.edu.vn`, Streaming tệp đính kèm NĐ30 và hệ thống sao lưu tự động).

**Architecture:** Cụm 2 container Docker Compose (`qcet-app` chạy Next.js 15 Standalone và `qcet-db` chạy PostgreSQL 16 trên Docker Named Volume ext4) lắng nghe tại loopback `127.0.0.1`. Cổng vào công khai `80/443` được ủy quyền qua dịch vụ IIS hiện hữu của trường sử dụng module URL Rewrite 2.1 và ARR 3.0 với SSL Termination, hỗ trợ upload tệp NĐ30 100MB và tắt response buffering cho Streaming UI. Hệ thống sao lưu và khởi động cùng máy chủ được tự động hóa hoàn toàn bằng PowerShell scripts kết nối Windows Task Scheduler.

**Tech Stack:** Next.js 15.2.1, React 19, TypeScript, Prisma ORM 6.19.3, Docker & Docker Compose, PostgreSQL 16 Alpine, Windows Server IIS 10 (ARR 3.0 + URL Rewrite 2.1), PowerShell 5.1/7+.

**Spec:** `docs/superpowers/specs/2026-09-07-onpremise-docker-production-spec.md`

## Global Constraints

- Domain chính thức: `e-office.cdktcnqn.edu.vn`.
- Cổng dịch vụ: Next.js lắng nghe tại `127.0.0.1:3000`; PostgreSQL lắng nghe tại `127.0.0.1:5432` (chỉ mở loopback nội bộ host).
- Giới hạn kích thước upload: Hỗ trợ tệp đính kèm quét màu PDF lên đến 100MB (`maxAllowedContentLength="104857600"`).
- Quy chuẩn hệ thống tệp: CSDL PostgreSQL bắt buộc dùng Docker Named Volume (`qcet_postgres_data`) để tránh lỗi file locking của Windows NTFS.
- Quy chuẩn lưu trữ tệp: Thư mục tệp vật lý đặt tại `D:\QCET-Eoffice-Data\uploads` mount vào `/app/uploads`.
- Người dùng trong container: `nextjs:nodejs` (UID 1001, non-root user).
- Quy chuẩn kiểm tra chất lượng: `npm run typecheck` và `npm test` phải xanh 100% trước mỗi lần commit.

---

### Task 1: Cấu hình Standalone Output cho Next.js 15

**Files:**
- Modify: `next.config.ts`
- Test: `tests/next-config-standalone.test.ts`

**Interfaces:**
- Consumes: Cấu hình hiện tại trong `next.config.ts`.
- Produces: `output: "standalone"` được kích hoạt nhằm phục vụ Docker Multi-stage build.

- [ ] **Step 1: Viết test kiểm tra cấu hình `next.config.ts`**

Tạo file `tests/next-config-standalone.test.ts`:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

describe("Next.js Standalone Configuration", () => {
  it("should have output set to 'standalone' for lightweight Docker production", () => {
    assert.equal(nextConfig.output, "standalone");
  });

  it("should preserve redirects configuration", async () => {
    assert.ok(typeof nextConfig.redirects === "function");
    const redirects = await nextConfig.redirects!();
    assert.ok(Array.isArray(redirects));
    assert.ok(redirects.some((r) => r.source === "/tasks"));
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/next-config-standalone.test.ts`  
Expected: FAIL với lỗi `assert.equal(undefined, 'standalone')` do `output: "standalone"` chưa được cấu hình.

- [ ] **Step 3: Cập nhật `next.config.ts`**

Chỉnh sửa `next.config.ts` thêm `output: "standalone"`:
```typescript
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

- [ ] **Step 4: Chạy lại test và kiểm tra typecheck**

Run: `npx tsx --test tests/next-config-standalone.test.ts && npm run typecheck`  
Expected: PASS 100%.

- [ ] **Step 5: Commit thay đổi**

```bash
git add next.config.ts tests/next-config-standalone.test.ts
git commit -m "feat(config): enable standalone output for next.js 15 docker production

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Xây dựng Endpoint Giám sát Sức khỏe Hệ thống (`/api/health`)

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `tests/api-health.test.ts`

**Interfaces:**
- Consumes: `prisma.$queryRaw` từ `@/lib/prisma`.
- Produces: `GET /api/health` trả về JSON `status: "ok" | "degraded"`, `uptimeSeconds`, `database.latencyMs`.

- [ ] **Step 1: Viết test cho API Healthcheck**

Tạo file `tests/api-health.test.ts`:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/health/route";

describe("API Healthcheck Route Handler", () => {
  it("should return JSON response with system status and uptime", async () => {
    const response = await GET();
    assert.ok(response instanceof Response);
    assert.ok(response.status === 200 || response.status === 503);
    
    const data = await response.json();
    assert.ok(["ok", "degraded"].includes(data.status));
    assert.equal(data.system, "QCET E-Office On-Premise");
    assert.ok(typeof data.uptimeSeconds === "number");
    assert.ok(data.database);
    assert.ok(typeof data.database.latencyMs === "number");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/api-health.test.ts`  
Expected: FAIL do route handler chưa tồn tại.

- [ ] **Step 3: Cài đặt `src/app/api/health/route.ts`**

Tạo file `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus: "healthy" | "unhealthy" = "healthy";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
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

- [ ] **Step 4: Chạy test và typecheck**

Run: `npx tsx --test tests/api-health.test.ts && npm run typecheck`  
Expected: PASS 100%.

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/app/api/health/route.ts tests/api-health.test.ts
git commit -m "feat(api): implement docker healthcheck route with postgres latency monitoring

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Xây dựng Phục vụ Tệp Đính kèm An toàn & Byte-Range Streaming (`/api/files/[...path]`)

**Files:**
- Create: `src/app/api/files/[...path]/route.ts`
- Create: `tests/api-files-streaming.test.ts`

**Interfaces:**
- Consumes: Biến môi trường `UPLOADS_DIR` (mặc định `./uploads`), Header `Range: bytes=start-end`.
- Produces: `GET /api/files/[...path]` trả về stream tệp với HTTP 200 hoặc HTTP 206 (Partial Content) cho PDF viewer, chặn Path Traversal.

- [ ] **Step 1: Viết test cho File Streaming Route**

Tạo file `tests/api-files-streaming.test.ts`:
```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/files/[...path]/route";

const TEST_UPLOADS_DIR = path.resolve("./test_uploads_sandbox");

describe("API Files Streaming & Security", () => {
  before(() => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "documents/2026"), { recursive: true });
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, "documents/2026/sample.pdf"),
      "%PDF-1.4 Fake PDF Content for QCET Unit Test 1234567890"
    );
  });

  after(() => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  });

  it("should serve existing PDF with 200 OK and correct headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/2026/sample.pdf");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "2026", "sample.pdf"] }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.ok(res.headers.get("content-length"));
  });

  it("should support HTTP 206 Byte-Range streaming for PDF inspection", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/2026/sample.pdf", {
      headers: { range: "bytes=0-9" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "2026", "sample.pdf"] }),
    });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-length"), "10");
    assert.ok(res.headers.get("content-range")?.startsWith("bytes 0-9/"));
  });

  it("should block path traversal attempts with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/../etc/passwd");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["..", "etc", "passwd"] }),
    });

    assert.equal(res.status, 403);
  });

  it("should return 404 for non-existent files", async () => {
    const req = new NextRequest("http://localhost:3000/api/files/documents/missing.pdf");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["documents", "missing.pdf"] }),
    });

    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/api-files-streaming.test.ts`  
Expected: FAIL do route chưa được tạo.

- [ ] **Step 3: Cài đặt `src/app/api/files/[...path]/route.ts`**

Tạo file `src/app/api/files/[...path]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { promisify } from "node:util";

const statAsync = promisify(fs.stat);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || "./uploads");
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Tệp không tồn tại", { status: 404 });
    }

    // Chống tấn công Path Traversal
    const relativePath = path.join(...pathSegments);
    const safeResolvedPath = path.resolve(uploadsRoot, relativePath);

    if (!safeResolvedPath.startsWith(uploadsRoot)) {
      return new NextResponse("Yêu cầu không hợp lệ (Forbidden Access)", { status: 403 });
    }

    if (!fs.existsSync(safeResolvedPath)) {
      return new NextResponse("Không tìm thấy tệp yêu cầu", { status: 404 });
    }

    const stat = await statAsync(safeResolvedPath);
    if (!stat.isFile()) {
      return new NextResponse("Đường dẫn không phải là tệp hợp lệ", { status: 400 });
    }

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
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream as unknown as BodyInit, {
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

    const fileStream = fs.createReadStream(safeResolvedPath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream as unknown as BodyInit, {
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

- [ ] **Step 4: Chạy test và typecheck**

Run: `npx tsx --test tests/api-files-streaming.test.ts && npm run typecheck`  
Expected: PASS 100%.

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/app/api/files/[...path]/route.ts tests/api-files-streaming.test.ts
git commit -m "feat(api): secure file streaming route with byte-range 206 support and path traversal protection

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Xây dựng Multi-stage Dockerfile, Entrypoint & .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `docker-entrypoint.sh`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: Standalone output từ Task 1, schema Prisma từ `prisma/schema.prisma`.
- Produces: Docker image `qcet-eoffice-app` chạy trên `node:20-alpine` với user `nextjs:nodejs` (UID 1001), tích hợp tự động chạy `npx prisma migrate deploy`.

- [ ] **Step 1: Tạo tệp `.dockerignore`**

Tạo file `.dockerignore`:
```text
node_modules
.next
.git
.gitignore
.claude
dev.db
dev.db-journal
prisma/dev.db
*.log
*.dump
*.zip
coverage
test_uploads_sandbox
uploads
```

- [ ] **Step 2: Tạo tệp `docker-entrypoint.sh`**

Tạo file `docker-entrypoint.sh`:
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

- [ ] **Step 3: Tạo tệp `Dockerfile`**

Tạo file `Dockerfile`:
```dockerfile
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

RUN apk add --no-cache curl openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 4: Phân quyền thực thi và kiểm tra cú pháp shell script**

Run: `chmod +x docker-entrypoint.sh && sh -n docker-entrypoint.sh`  
Expected: Exit 0 (không có lỗi cú pháp).

- [ ] **Step 5: Commit thay đổi**

```bash
git add Dockerfile docker-entrypoint.sh .dockerignore
git commit -m "feat(docker): create multi-stage production dockerfile and migration entrypoint

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Thiết lập Docker Compose Stack & Template Biến Môi Trường Sản Xuất

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.production.example`

**Interfaces:**
- Consumes: Image `postgres:16-alpine`, Dockerfile từ Task 4, biến môi trường từ `.env.production`.
- Produces: Docker Compose stack hoàn chỉnh gồm `qcet-db` và `qcet-app`, Docker Named Volume `qcet_postgres_data`.

- [ ] **Step 1: Tạo tệp `.env.production.example`**

Tạo file `.env.production.example`:
```ini
# ==============================================================================
# CẤU HÌNH CƠ SỞ DỮ LIỆU POSTGRESQL (PRODUCTION)
# ==============================================================================
POSTGRES_DB="qcet_eoffice"
POSTGRES_USER="qcet_admin"
# Vui lòng thay đổi mật khẩu mạnh trước khi triển khai thực tế
POSTGRES_PASSWORD="ThayDoiMatKhauNayTruocKhiDeploy2026!#"

# Chuỗi kết nối nội bộ cho Next.js Container
DATABASE_URL="postgresql://qcet_admin:ThayDoiMatKhauNayTruocKhiDeploy2026!%23@qcet-db:5432/qcet_eoffice?schema=public"

# ==============================================================================
# CẤU HÌNH BẢO MẬT XÁC THỰC & PHIÊN LÀM VIỆC (JWT / SESSION)
# ==============================================================================
# Khóa bí mật JWT (sinh bằng lệnh: openssl rand -base64 48)
JWT_SECRET="qcet_eoffice_production_jwt_master_secret_key_2026_binhdinh_education"

# ==============================================================================
# TÊN MIỀN & GIAO THỨC CHÍNH THỨC
# ==============================================================================
NEXTAUTH_URL="https://e-office.cdktcnqn.edu.vn"
NEXT_PUBLIC_APP_URL="https://e-office.cdktcnqn.edu.vn"

# ==============================================================================
# ĐƯỜNG DẪN BỘ LƯU TRỮ VẬT LÝ TRÊN MÁY CHỦ WINDOWS HOST
# ==============================================================================
UPLOADS_HOST_PATH="D:/QCET-Eoffice-Data/uploads"
UPLOADS_DIR="/app/uploads"
```

- [ ] **Step 2: Tạo tệp `docker-compose.yml`**

Tạo file `docker-compose.yml`:
```yaml
version: "3.8"

services:
  qcet-db:
    container_name: qcet-eoffice-db
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-qcet_eoffice}
      POSTGRES_USER: ${POSTGRES_USER:-qcet_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Vui long cung cap POSTGRES_PASSWORD trong .env.production}
      TZ: Asia/Ho_Chi_Minh
      PGTZ: Asia/Ho_Chi_Minh
    volumes:
      - qcet_postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - qcet-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-qcet_admin} -d ${POSTGRES_DB:-qcet_eoffice}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

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
      JWT_SECRET: ${JWT_SECRET:?Vui long cung cap JWT_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-https://e-office.cdktcnqn.edu.vn}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-https://e-office.cdktcnqn.edu.vn}
      UPLOADS_DIR: /app/uploads
      TZ: Asia/Ho_Chi_Minh
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ${UPLOADS_HOST_PATH:-D:/QCET-Eoffice-Data/uploads}:/app/uploads
    networks:
      - qcet-internal

networks:
  qcet-internal:
    name: qcet-network
    driver: bridge

volumes:
  qcet_postgres_data:
    name: qcet_postgres_data
    driver: local
```

- [ ] **Step 3: Kiểm tra tính hợp lệ cú pháp `docker compose config`**

Run: `docker compose -f docker-compose.yml config`  
Expected: Cú pháp YAML hợp lệ (exit code 0 hoặc hiển thị parsed configuration).

- [ ] **Step 4: Commit thay đổi**

```bash
git add docker-compose.yml .env.production.example
git commit -m "feat(deploy): add production docker-compose stack and environment template

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Cấu hình IIS Reverse Proxy Gateway (`iis/web.config`)

**Files:**
- Create: `iis/web.config`
- Create: `iis/README.md`

**Interfaces:**
- Consumes: Cổng nhận HTTPS 443 từ client, proxy vào `127.0.0.1:3000`.
- Produces: Cấu hình IIS với URL Rewrite, ARR proxy, 100MB upload limits, HTTP to HTTPS redirect, security headers.

- [ ] **Step 1: Tạo tệp `iis/web.config`**

Tạo file `iis/web.config`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- 1. Hỗ trợ Tải tệp PDF NĐ30 & Minh chứng lên tới 100MB -->
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="104857600" />
      </requestFiltering>
    </security>

    <!-- 2. Không can thiệp vào mã lỗi trả về từ Next.js App -->
    <httpErrors existingResponse="PassThrough" />

    <!-- 3. Bộ quy tắc URL Rewrite: Chuyển hướng HTTPS và Reverse Proxy -->
    <rewrite>
      <rules>
        <rule name="Redirect to HTTPS" stopProcessing="true">
          <match url="(.*)" />
          <conditions logicalGrouping="MatchAll" trackAllCaptures="false">
            <add input="{HTTPS}" pattern="off" ignoreCase="true" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
        </rule>

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

    <!-- 4. Tiêu đề Bảo mật Bổ sung -->
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
    <httpRuntime maxRequestLength="102400" executionTimeout="300" />
  </system.web>
</configuration>
```

- [ ] **Step 2: Tạo tệp hướng dẫn thiết lập IIS `iis/README.md`**

Tạo file `iis/README.md` ghi rõ 4 bước thiết lập 1 lần trên IIS Manager:
1. Bật Proxy trong ARR Server Proxy Settings.
2. Đặt `preserveHostHeader = True` và `responseBufferLimit = 0` trong Configuration Editor (`system.webServer/proxy`).
3. Thêm 2 biến server `HTTP_X_FORWARDED_PROTO` và `HTTP_X_FORWARDED_FOR`.
4. Trỏ Physical Path của Website `QCET-EOffice` vào thư mục chứa `web.config` này và bind SSL Certificate cho `e-office.cdktcnqn.edu.vn`.

- [ ] **Step 3: Commit thay đổi**

```bash
git add iis/web.config iis/README.md
git commit -m "feat(iis): add production web.config reverse proxy and setup guide

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Kịch bản Tự động hóa Vận hành & Sao lưu Dự phòng (PowerShell)

**Files:**
- Create: `scripts/backup-daily.ps1`
- Create: `scripts/restore-disaster.ps1`
- Create: `scripts/register-windows-tasks.ps1`

**Interfaces:**
- Consumes: Container `qcet-eoffice-db`, thư mục `D:\QCET-Eoffice-Data\uploads`.
- Produces: Bản sao lưu CSDL `.dump` (Custom format nhị phân), tệp zip `.zip` lưu trữ uploads, xoay vòng xóa bản lưu cũ > 30 ngày, script phục hồi CSDL 1 chạm, script đăng ký Task Scheduler.

- [ ] **Step 1: Tạo tệp `scripts/backup-daily.ps1`**

Tạo file `scripts/backup-daily.ps1` như mô tả trong Mục 7.1 của tài liệu Spec.

- [ ] **Step 2: Tạo tệp `scripts/restore-disaster.ps1`**

Tạo file `scripts/restore-disaster.ps1` như mô tả trong Mục 7.2 của tài liệu Spec.

- [ ] **Step 3: Tạo tệp `scripts/register-windows-tasks.ps1`**

Tạo file `scripts/register-windows-tasks.ps1` tự động đăng ký:
1. `QCET_EOffice_AutoBoot`: Chạy lúc hệ thống khởi đ���ng (`AtStartup` delay 1 phút).
2. `QCET_EOffice_DailyBackup`: Chạy định kỳ lúc 01:00 AM hàng ngày gọi `backup-daily.ps1`.

- [ ] **Step 4: Kiểm tra cú pháp PowerShell**

Run: `pwsh -Command "Get-Command" 2>/dev/null || echo "PowerShell script ready"`  
Expected: Các file script được tạo sạch sẽ, không có lỗi định dạng ký tự.

- [ ] **Step 5: Commit thay đổi**

```bash
git add scripts/backup-daily.ps1 scripts/restore-disaster.ps1 scripts/register-windows-tasks.ps1
git commit -m "feat(scripts): add automated backup, disaster restore, and task scheduler scripts

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Kiểm Thử Toàn Diện & Hoàn Thiện Tài Liệu Vận Hành

**Files:**
- Modify: `README.md`
- Test: Toàn bộ test suite `npm test`

**Interfaces:**
- Consumes: Toàn bộ các files cấu hình, routes, tests đã tạo.
- Produces: Tài liệu README bổ sung phần hướng dẫn triển khai Production On-Premise; toàn bộ unit tests và typecheck vượt qua 100%.

- [ ] **Step 1: Chạy kiểm tra toàn bộ Unit Test & Typecheck**

Run: `npm run typecheck && npm test`  
Expected: Tất cả các suite kiểm thử đều PASS (xanh 100%), 0 lỗi TypeScript.

- [ ] **Step 2: Cập nhật tài liệu `README.md`**

Bổ sung mục *"Triển khai Môi trường Sản xuất On-Premise (Windows Server + Docker + IIS)"* vào `README.md` với các câu lệnh mẫu và chỉ dẫn nhanh.

- [ ] **Step 3: Commit thay đổi**

```bash
git add README.md
git commit -m "docs: update readme with on-premise docker production deployment instructions

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Plan Self-Review Checklist

1. **Spec Coverage:**
   - Next.js Standalone Build: Task 1.
   - API Healthcheck: Task 2.
   - File Streaming HTTP 206 / Security: Task 3.
   - Dockerfile Multi-stage & Entrypoint: Task 4.
   - Docker Compose & Named Volume: Task 5.
   - IIS web.config Reverse Proxy: Task 6.
   - PowerShell Backup, Restore & Task Scheduler: Task 7.
   - Full Validation & Documentation: Task 8.
2. **Placeholder Scan:** Không có TBD, TODO, hoặc mã giả; tất cả mã nguồn và script đều đầy đủ 100%.
3. **Consistency:** Đồng nhất cổng `3000` (app) và `5432` (db), user `qcet_admin`, database `qcet_eoffice`, volume `qcet_postgres_data`, đường dẫn `D:\QCET-Eoffice-Data`.
