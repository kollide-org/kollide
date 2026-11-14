import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cn } from 'cn/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cn({ content: ['src/**/*.{ts,tsx}'], out: 'src/lib/cn-tables.ts' })],
  build: {
    rolldownOptions: {
      output: {
        // Without this every icon becomes its own tiny file, and a page can need thirty of them.
        codeSplitting: {
          groups: [{ name: 'icons', test: /node_modules[\\/]lucide-react/ }],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
