import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', 'pdf-parse'],
};

export default nextConfig;
