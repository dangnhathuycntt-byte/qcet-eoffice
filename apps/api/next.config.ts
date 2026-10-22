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
const securityHeaders = getNextSecurityHeaders(isProduction);

// API: chỉ route handler /api/* (không có trang). Header bảo mật áp cho mọi phản hồi như khi còn một ứng dụng.
const nextConfig: NextConfig = {
  // E2E chạy server riêng với NEXT_DIST_DIR khác để không đụng .next của dev server đang mở
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Gói Yjs nạp bằng require của Node: bundle của instrumentation (máy chủ cộng tác) và của route handler phải dùng chung một bản
  // `yjs`, không thì "Type with the name content has already been defined with a different constructor" (ADR-014).
  serverExternalPackages: ["web-push", "yjs", "y-protocols", "lib0", "@slate-yjs/core", "@hocuspocus/server", "ws"],
  // Gốc repo: standalone mang theo packages/ dùng chung
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  transpilePackages: ["@qcet/contracts", "@qcet/shared", "@qcet/db"],
  experimental: {
    // @qcet/* là mã nguồn TS ngoài thư mục app (tsconfig paths)
    externalDir: true,
    // Proxy (Next 16, trước là Middleware) chạy Node runtime nên Next đệm body request và cắt ở 10MB (mặc định), làm
    // upload ~10MB lỗi "Failed to parse body as FormData". Chừa dư cho overhead multipart
    // (giới hạn tệp thực tế 10MB vẫn do /api/upload kiểm tra).
    proxyClientMaxBodySize: "12mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
