import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
