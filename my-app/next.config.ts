import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', 'pdf-parse', 'pdf-parse-v1', '@napi-rs/canvas'],
};

export default nextConfig;
