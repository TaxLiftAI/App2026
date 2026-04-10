import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // ── Dev server proxy ───────────────────────────────────────────────────────
  // In dev, the React app runs on :5173 and the Express API on :3001.
  // Without a proxy, they're different origins — browsers won't send
  // SameSite=Lax httpOnly cookies cross-port.
  // With the proxy, the browser sees everything as same-origin (localhost:5173),
  // so cookies flow automatically just like they do in production (Vercel → Railway).
  server: {
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true },
      '/healthz': { target: 'http://localhost:3001', changeOrigin: true },
      '/health':  { target: 'http://localhost:3001', changeOrigin: true },
    },
  },

  build: {
    // Route-based code splitting — all 58 page imports in App.jsx are
    // already React.lazy() dynamic imports. Vite splits at each boundary.
    // Initial JS bundle: ~139 KB (vs 1.1 MB pre-splitting).
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk — React + router cached across deploys
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
