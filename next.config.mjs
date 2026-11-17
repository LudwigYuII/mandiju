/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['fonteditor-core'],
  outputFileTracingIncludes: {
    '/journal/**/pdf': ['./node_modules/@fontsource/noto-serif-tc/files/*-400-normal.woff', './node_modules/@fontsource/noto-serif-sc/files/*-400-normal.woff'],
  },
  env: {
    NEXT_PUBLIC_SITE_TIME_ZONE:
      process.env.MDJ_SITE_TIME_ZONE || "Asia/Shanghai",
  },
};

export default nextConfig;
