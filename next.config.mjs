/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse and pg are server-only native-ish deps; keep them external from bundling.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pg"],
  },
};

export default nextConfig;
