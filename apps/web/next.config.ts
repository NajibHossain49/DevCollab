import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained build for Docker/Vercel deployment.
  output: "standalone",
  reactStrictMode: true,
  // The shared-types package ships ESM from source; let Next transpile it.
  transpilePackages: ["@devcollab/shared-types"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws",
  },
};

export default nextConfig;
