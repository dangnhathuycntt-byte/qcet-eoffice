import path from "node:path";
import type { NextConfig } from "next";
import { getNextSecurityHeaders } from "./src/config/security-headers";

const isProduction = process.env.NODE_ENV === "production";
const securityHeaders = getNextSecurityHeaders(isProduction);

const nextConfig: NextConfig = {
  // E2E chạy server riêng với NEXT_DIST_DIR khác để không đụng .next của dev server đang mở
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  serverExternalPackages: ["web-push"],
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "qrcode", "vaul", "motion", "@base-ui/react"],
    // Middleware chạy Node runtime nên Next đệm body request và cắt ở 10MB (mặc định), làm
    // upload ~10MB lỗi "Failed to parse body as FormData". Chừa dư cho overhead multipart
    // (giới hạn tệp thực tế 10MB vẫn do /api/upload kiểm tra).
    middlewareClientMaxBodySize: "12mb",
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
