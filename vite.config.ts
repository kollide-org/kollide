import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cn } from 'cn/vite'
import { defineConfig, loadEnv } from 'vite'

import { routePreload } from './scripts/vite-route-preload.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const services =
    loadEnv(mode, process.cwd(), 'VITE_').VITE_SERVICES === 'real' ? 'src/services/real/index.ts' : 'src/services/mock/index.ts'
  return {
    plugins: [
      react(),
      tailwindcss(),
      cn({ content: ['src/**/*.{ts,tsx}'], out: 'src/lib/cn-tables.ts' }),
      // Pages people often open directly from a shared link start loading their code with the main bundle.
      routePreload({
        everywhereButHome: [services],
        routes: [
          {
            pattern: /^\/events\/[^/]+\/?$/,
            modules: ['src/pages/public/event.tsx'],
          },
          {
            pattern: /^\/app\/?$/,
            modules: ['src/app/layouts/app-layout.tsx', 'src/pages/app/home.tsx'],
          },
          {
            pattern: /^\/app\/events\/[^/]+\/?$/,
            modules: ['src/app/layouts/app-layout.tsx', 'src/pages/app/event.tsx'],
          },
        ],
      }),
    ],
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
  }
})
