/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 한글 경로 처리를 위한 설정
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;

