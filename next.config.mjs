/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SITE_TIME_ZONE:
      process.env.MDJ_SITE_TIME_ZONE || "Asia/Shanghai",
  },
};

export default nextConfig;
