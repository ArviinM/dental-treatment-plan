import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The PDF renderer reads the Nunito TTFs and the blank templates straight off
  // disk (src/lib/pdf/assets.ts). Vercel prunes anything it cannot see being
  // imported, so the tracer has to be told these files are needed at runtime.
  outputFileTracingIncludes: {
    '/api/plans/render': ['./public/fonts/**', './public/templates/**'],
  },
};

export default nextConfig;
