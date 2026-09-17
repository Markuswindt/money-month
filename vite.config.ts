import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Radix sand-1 (hell). Muss mit tokens.css uebereinstimmen, sonst blitzt
// beim Start kurz die falsche Farbe auf.
const BG_LIGHT = '#fdfdfc';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': ein Reload mitten in einer Eingabe
      // waere der schlimmste Moment fuer ein Update.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Money>Month',
        short_name: 'Money>Month',
        description: 'Fixe und variable Ausgaben im Blick - offline, lokal, ohne Konto.',
        lang: 'de',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: BG_LIGHT,
        theme_color: BG_LIGHT,
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Die App braucht kein Netz - die komplette Shell wird vorgeladen.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Service Worker im Dev-Server aus: sonst cached er Module und man
        // debuggt eine alte Version.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
  },
});
