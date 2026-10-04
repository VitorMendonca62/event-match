import type { NextConfig } from 'next';

import { validateEnvOrThrow } from './src/shared/config/env.server';

validateEnvOrThrow();

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    useTypeScriptCli: false,
  },
  async headers() {
    const developmentEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${developmentEval}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' blob: data: https://res.cloudinary.com",
      "connect-src 'self' https://api.cloudinary.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: csp }, { key: 'Referrer-Policy', value: 'no-referrer' }] }];
  },
};

export default nextConfig;
