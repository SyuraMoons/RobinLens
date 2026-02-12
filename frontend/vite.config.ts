import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/subgraph': {
        target: 'https://api.goldsky.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            '/api/subgraph',
            '/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn',
          ),
      },
    },
  },
})
