import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/recharts')) return 'charts'
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jspdf-autotable') ||
            id.includes('node_modules/papaparse')
          ) {
            return 'export-tools'
          }
          if (id.includes('node_modules/react-router-dom')) return 'router'
          if (
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-hot-toast')
          ) {
            return 'ui'
          }
        },
      },
    },
  },
})
