import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const repoRoot = path.resolve(__dirname, "../..");
// Next nạp file này bằng requireFromString nên import tương đối được tìm theo thư mục chạy lệnh, không theo vị trí
// file: nạp theo đường dẫn tuyệt đối để `next dev|start apps/<app>` chạy được cả từ gốc repo lẫn từ thư mục app.
const { getNextSecurityHeaders }: typeof import("../../packages/shared/src/config/security-headers") = require(
  path.join(repoRoot, "packages/shared/src/config/security-headers"),
);
// .env* nằm ở gốc repo, dùng chung hai app; Next chỉ tự nạp trong thư mục app. Next đã gọi loadEnvConfig cho thư mục
// app ngay trước khi đọc file này và cache kết quả, nên phải forceReload (tham số cuối) mới nạp được gốc repo; biến
// file này thêm vào được Next giữ lại (updateInitialEnv). Không ghi đè biến của shell.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production", console, true);

const isProduction = process.env.NODE_ENV === "production";
// Micro cho chính trang này (ghi âm cuộc họp trực tiếp, `getUserMedia`). Mặc định `microphone=()` chặn hẳn micro: trình
// duyệt không hỏi quyền, người dùng không bật được dù bấm ổ khóa (người dùng báo 21/10/2026). Camera, vị trí, thanh
// toán vẫn tắt; iframe nhúng từ nơi khác không được dùng micro.
const securityHeaders = getNextSecurityHeaders(isProduction, {
  permissionsPolicy: "camera=(), microphone=(self), geolocation=(), payment=()",
});

/**
 * API nội bộ (D6). Trình duyệt gọi /api cùng tên miền; production định tuyến /api tới qcet-api ở cloudflared,
 * còn lại (dev, gọi thẳng web) đi qua rewrite dưới đây. Rewrite chốt lúc build: image web build với
 * API_INTERNAL_URL của mạng compose. Dev mặc định API ở cổng API_PORT (3100).
 */
const apiInternalUrl = (
  process.env.API_INTERNAL_URL ||
  (isProduction ? "" : `http://127.0.0.1:${process.env.API_PORT || 3100}`)
).replace(/\/+$/, "");
if (!apiInternalUrl) throw new Error("API_INTERNAL_URL chưa đặt (bắt buộc khi build/chạy production)");

/**
 * Máy chủ cộng tác mô tả nhiệm vụ (ADR-014) nằm trong qcet-api ở cổng riêng COLLAB_PORT (mặc định 3101). Production cloudflared
 * định tuyến /collab thẳng tới đó; rewrite dưới đây cho dev và khi gọi thẳng web (Next chuyển tiếp cả upgrade WebSocket).
 * Mặc định cùng máy với API_INTERNAL_URL, đổi cổng; COLLAB_INTERNAL_URL ghi đè.
 */
const collabInternalUrl = (
  process.env.COLLAB_INTERNAL_URL ||
  (() => {
    const url = new URL(apiInternalUrl);
    url.port = process.env.COLLAB_PORT || "3101";
    return url.origin;
  })()
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // E2E chạy server riêng với NEXT_DIST_DIR khác để không đụng .next của dev server đang mở
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Gốc repo: standalone mang theo packages/ dùng chung
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  // `next dev` (16.2+) tự ghi AGENTS.md vào thư mục app; repo giữ một AGENTS.md ở gốc, đã trỏ tới node_modules/next/dist/docs
  agentRules: false,
  transpilePackages: ["@qcet/contracts", "@qcet/shared"],
  experimental: {
    // @qcet/* là mã nguồn TS ngoài thư mục app (tsconfig paths)
    externalDir: true,
    optimizePackageImports: ["lucide-react", "qrcode", "vaul", "motion", "@base-ui/react"],
    // Proxy (Next 16, trước là Middleware) chạy Node runtime nên Next đệm body request và cắt ở 10MB (mặc định), làm
    // upload ~10MB lỗi "Failed to parse body as FormData". Chừa dư cho overhead multipart
    // (giới hạn tệp thực tế 10MB vẫn do /api/upload kiểm tra). /api/* đi qua proxy này trước rewrite.
    proxyClientMaxBodySize: "12mb",
    // Rewrite /api chờ API tới 340 s: luồng chat của Trợ lý chạy tối đa 330 s (maxDuration của route, ADR-009)
    proxyTimeout: 340_000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` },
      { source: "/collab/:path*", destination: `${collabInternalUrl}/collab/:path*` },
    ];
  },
  async redirects() {
    return [
      {
        source: "/task",
        destination: "/tasks",
        permanent: true,
      },
      {
        source: "/task/:id*",
        destination: "/tasks/:id*",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/tasks",
        permanent: true,
      },
      // Trang chi tiết văn bản riêng đã bỏ (trùng Quick View): đường dẫn cũ trong thông báo/dấu trang mở thẳng Quick View, giữ ?file=.
      {
        source: "/documents/incoming/:id",
        destination: "/documents?docId=:id",
        permanent: false,
      },
      {
        source: "/documents/outgoing/:id((?!compose$)[^/]+)",
        destination: "/documents?docId=:id",
        permanent: false,
      },
      {
        source: "/documents/:id((?!approval-report$|incoming$|outgoing$)[^/]+)",
        destination: "/documents?docId=:id",
        permanent: false,
      },
      {
        source: "/portal",
        destination: "/tasks",
        permanent: true,
      },
      {
        source: "/unit-tasks",
        destination: "/tasks?scope=unit",
        permanent: true,
      },
      {
        source: "/notifications",
        destination: "/inbox",
        permanent: false,
      },
      {
        source: "/notifications/:path*",
        destination: "/inbox/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
