import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ems/',
  plugins: [react()],
  publicDir: '../Public',
  server: {
    port: 5174
  }
})
