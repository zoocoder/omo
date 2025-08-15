import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['styled-jsx/babel']
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow access from other devices
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable source maps for production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  },
  base: '/' // Root path for production
})

