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
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/unit-tasks",
        destination: "/tasks?scope=unit",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/?zone=calendar",
        permanent: false,
      },
      {
        source: "/org",
        destination: "/?zone=org",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
