import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", 
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.openstreetmap\.org\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'nexus-map-tiles',
          expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 }, 
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

// 👇 BAGIAN INI YANG KITA UBAH
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Matikan peringatan bentrok Turbopack vs Webpack
  turbopack: {}, 
};

export default withPWA(nextConfig);