import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Leave room for multipart metadata around the API's 5 MiB image limit.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default nextConfig;
