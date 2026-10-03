import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from 'vite-plugin-pwa'
import { inspectAttr } from 'kimi-plugin-inspect-react'

export default defineConfig({
  plugins: [
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: 'TukpaMaster',
        short_name: 'TukpaMaster',
        description: 'Tambola Operator Portal',
        // Match the app shell (#2e1065) so the installed status bar and splash
        // don't flash sky blue before the purple UI paints.
        theme_color: '#2e1065',
        background_color: '#2e1065',
        display: 'standalone',
        // Layouts are fluid now, so let the installed app follow the device.
        orientation: 'any',
        start_url: '/',
        scope: '/',
        shortcuts: [
          { name: 'Live Game', short_name: 'Live',   url: '/?page=live-game' },
          { name: 'Orders',    short_name: 'Orders', url: '/?page=pending-payments' },
        ],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Force new SW to activate immediately — no waiting for tab close
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        cacheId: 'tukpa-v4',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // Never cache API calls — always go to network
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 3000 },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['jspdf', 'qrcode'],
        },
      },
    },
  },
});
