import type { NextConfig } from "next";
import {securityHeaders} from './lib/security-headers';

const nextConfig: NextConfig = {
  // Leave room for multipart metadata around the API's 5 MiB image limit.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers(){return [
    {source:'/:path*',headers:securityHeaders},
    {source:'/',headers:[{key:'Cache-Control',value:'private, no-store'}]},
    {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
  ]},
};

export default nextConfig;
