import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// GitHub Pages で配信する場合はリポジトリ名を base に設定する。
// ローカル開発時は '/' のままにする。
const repoBase = '/gas-kakeibo/'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? repoBase : '/',
  plugins: [
    react(),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
        },
      },
    },
  },
}))
