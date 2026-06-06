import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pollavar/api-client", "@pollavar/ui"],
  turbopack: {
    resolveAlias: {
      "@pollavar/ui": "../../packages/ui/src",
    },
  },
};

export default nextConfig;
