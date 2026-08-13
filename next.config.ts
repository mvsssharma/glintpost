import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // next/image optimization uses `sharp`, whose native binary dlopens libvips
  // from a *separate* `@img/sharp-libvips-*` package at runtime (sharp >= 0.35).
  // File tracing follows the `.node` addon but not the runtime-loaded `.so`, so
  // the standalone/Docker image would ship without libvips and crash on first
  // image optimization. Force both packages into the trace. The build runs on
  // one platform, so `@img/` only contains that platform's packages (minimal).
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },

  // --- Production hardening ---

  // Remove x-powered-by header (don't advertise tech stack)
  poweredByHeader: false,

  // --- Dev-only logging (ignored in production builds) ---

  logging: {
    // Forward browser warnings & errors to terminal (no need to open DevTools)
    browserToTerminal: "warn",
    // Log fetch requests with full URLs during development
    fetches: {
      fullUrl: true,
    },
    // Server function calls are logged by default (name, args, duration)
    // Set serverFunctions: false to disable
  },
};

export default nextConfig;
