import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    stylex.vite({ useCSSLayers: true }),
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['assets/favicon.svg', 'assets/*.ttf', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'jot.', short_name: 'jot.', description: 'A private place for little notes.',
        start_url: '/', scope: '/', display: 'standalone',
        background_color: '#f7f8fa', theme_color: '#f7f8fa',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/images/'),
          handler: 'CacheFirst',
          options: { cacheName: 'jot-images', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } },
        }],
      },
    }),
  ],
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: { port: 4273, host: '0.0.0.0', proxy: { '/api': 'http://127.0.0.1:3000', '/healthz': 'http://127.0.0.1:3000' } },
});
