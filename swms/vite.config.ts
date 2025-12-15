import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    base: '/swms/',
    plugins: [react()],
    publicDir: '../Public',
    server: {
        port: 5175,
        proxy: {
            '/api': {
                target: 'http://localhost:3007',
                changeOrigin: true,
                secure: false,
            }
        }
    }
})
