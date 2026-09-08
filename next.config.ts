import path from "node:path";
import type { NextConfig } from "next";

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
  async redirects() {
    return [
      {
        source: "/tasks",
        destination: "/?zone=tasks&scope=school",
        permanent: false,
      },
      {
        source: "/unit-tasks",
        destination: "/?zone=tasks&scope=unit",
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
