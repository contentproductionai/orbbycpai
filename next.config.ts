import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["puppeteer", "@anthropic-ai/sdk"],
  // Ensure component library fonts and CSS are copied into the standalone build.
  // Without this, fs.readFileSync calls in assembleHtml.ts fail at runtime on Railway.
  outputFileTracingIncludes: {
    "/api/generate": [
      "./src/lib/component-library/fonts/**",
      "./src/lib/component-library/fonts.css",
      "./src/lib/component-library/layouts.css",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
};

export default nextConfig;
