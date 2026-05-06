/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@clippr/types', '@clippr/config'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
};

module.exports = nextConfig;
