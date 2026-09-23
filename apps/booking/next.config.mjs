/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@sena/ui',
    '@sena/types',
    '@sena/config',
    '@sena/validation',
  ],
};

export default nextConfig;
