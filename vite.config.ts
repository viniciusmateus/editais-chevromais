import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = process.env.PORT ?? '3002'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3889,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
    },
  },
})
