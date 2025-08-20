/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/ws',
        destination: 'http://localhost:8000/ws',
      },
    ];
  },
};

module.exports = nextConfig;
