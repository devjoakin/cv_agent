import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fix Turbopack module resolution for next/font/google (often TLS/cert related on Windows/corporate networks)
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
