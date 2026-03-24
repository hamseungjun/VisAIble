/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.VERCEL ? '.next' : process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
