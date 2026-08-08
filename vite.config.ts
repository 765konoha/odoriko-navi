import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: https://<user>.github.io/odoriko-navi/
export default defineConfig({
  base: '/odoriko-navi/',
  plugins: [react(), tailwindcss()],
})
