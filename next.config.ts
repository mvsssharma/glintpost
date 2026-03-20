import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
