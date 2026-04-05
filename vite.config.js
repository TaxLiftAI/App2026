import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Improve chunk splitting so the initial JS bundle is smaller,
    // reducing the blank-flash window on first load.
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk — React + router + recharts loaded once, cached forever
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
