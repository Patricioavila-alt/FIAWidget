import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/FIAWidget/',       // ← nombre exacto del repositorio en GitHub
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
