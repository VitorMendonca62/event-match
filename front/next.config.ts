import type { NextConfig } from 'next';

import { validateEnvOrThrow } from './src/shared/config/env.server';

validateEnvOrThrow();

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
