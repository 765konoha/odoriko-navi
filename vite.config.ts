import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: https://<user>.github.io/odoriko-navi/
export default defineConfig({
  base: '/odoriko-navi/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '踊り子ナビ',
        short_name: '踊り子ナビ',
        description: '祭り当日の集合時間・場所をすぐ確認できる踊り子向けアプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリ本体(JS/CSS/HTML/アイコン)をプリキャッシュ
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // 地図タイル・Supabase APIはキャッシュしない
        // (スケジュール等のデータは localStorage スナップショットで保持)
        runtimeCaching: [],
        navigateFallback: '/odoriko-navi/index.html',
      },
    }),
  ],
})
