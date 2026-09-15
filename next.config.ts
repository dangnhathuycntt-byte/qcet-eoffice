import path from "node:path";
import type { NextConfig } from "next";
import { getNextSecurityHeaders } from "./src/config/security-headers";

const isProduction = process.env.NODE_ENV === "production";
const securityHeaders = getNextSecurityHeaders(isProduction);

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["web-push"],
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "qrcode", "vaul"],
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
    ];
  },
};

export default nextConfig;
