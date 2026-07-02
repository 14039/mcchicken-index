import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root (a stray parent lockfile otherwise confuses tracing).
  outputFileTracingRoot: root,
  // The methodology page renders METHODOLOGY.md from disk at request time.
  outputFileTracingIncludes: {
    "/methodology": ["./METHODOLOGY.md"],
  },
};

export default nextConfig;
