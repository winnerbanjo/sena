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
  async redirects() {
    return [
      { source: '/channels', destination: '/apps', permanent: false },
      { source: '/channels/:path*', destination: '/apps', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/offline.html',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
