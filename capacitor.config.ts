import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 慢递局 · Capacitor 薄壳配置
 * 站点是动态 SSR（Next.js 15），客户端仅作为 WebView 壳加载线上站点。
 * 生产环境绝不加载 localhost；webDir 字段仅供 cap sync 使用，无实际资产。
 */
const config: CapacitorConfig = {
  appId: 'uno.ludwig.mandiju',
  appName: '慢递局',
  webDir: 'out',
  server: {
    url: 'https://ludwig.uno',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
