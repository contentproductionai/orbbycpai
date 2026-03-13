import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["child_process", "fs", "path", "os", "crypto"],
  },
};

export default nextConfig;
