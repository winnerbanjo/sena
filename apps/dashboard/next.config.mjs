/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres', 'bcryptjs'],
  transpilePackages: [
    '@sena/ui',
    '@sena/types',
    '@sena/config',
    '@sena/validation',
    '@sena/database',
    '@sena/reservations',
    '@sena/inventory',
    '@sena/payments',
    '@sena/housekeeping',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
