import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'puntocachero',
        short_name: 'puntocachero',
        description: 'Arcade de conquista de territorio para jugar en el navegador',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#080b16',
        background_color: '#080b16',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/logo-brand.png', sizes: '1440x810', type: 'image/png', purpose: 'any' },
          { src: 'icons/logo-mark.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Las imágenes de nivel NO van al precache del shell: se cachean en
        // runtime al jugar cada nivel (ver docs/MOBILE.md).
        globPatterns: [
          '**/*.{js,css,html,svg,woff2}',
          'icons/icon-*.png',
          'icons/logo-brand.png',
          'icons/logo-mark.png',
        ],
        // Phaser es grande; subir el límite de precache por encima del bundle
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/levels\/.*\.(png|webp|jpg)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'level-images',
              expiration: { maxEntries: 40 },
            },
          },
          {
            // Signed URLs de Supabase Storage (Fase 9+)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'level-images-remote',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
