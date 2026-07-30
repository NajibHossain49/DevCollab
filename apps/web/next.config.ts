import { createRequire } from "node:module";
import path from "node:path";

import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
// Resolve the monaco-editor package root (its `exports` map blocks resolving
// deep paths and even package.json, so derive it from the main entry instead).
const monacoRoot = path.resolve(
  path.dirname(require.resolve("monaco-editor")),
  "../..",
);
const monacoEditorApi = path.join(
  monacoRoot,
  "esm/vs/editor/editor.api.js",
);

const nextConfig: NextConfig = {
  // Produces a self-contained build for Docker/Vercel deployment.
  output: "standalone",
  reactStrictMode: true,
  // The shared-types package ships ESM from source; let Next transpile it.
  transpilePackages: ["@devcollab/shared-types"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws",
    // Optional TURN relay for WebRTC (STUN-only by default). See .env.example.
    NEXT_PUBLIC_TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL ?? "",
    NEXT_PUBLIC_TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
    NEXT_PUBLIC_TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD ?? "",
  },
  webpack: (config) => {
    // y-monaco imports `monaco-editor/esm/vs/editor/editor.api.js` directly, but
    // monaco-editor's strict `exports` map does not expose that deep path. Alias
    // it to the package entry so the import resolves. The Monaco *editor* itself
    // (and its web workers) is still loaded via @monaco-editor/react's CDN loader.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> | undefined),
      "monaco-editor/esm/vs/editor/editor.api.js$": monacoEditorApi,
      "monaco-editor/esm/vs/editor/editor.api$": monacoEditorApi,
    };
    return config;
  },
};

export default nextConfig;
