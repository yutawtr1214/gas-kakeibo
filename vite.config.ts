import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages で配信する場合はリポジトリ名を base に設定する。
// ローカル開発時は '/' のままにする。
const repoBase = '/gas-kakeibo/'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? repoBase : '/',
  plugins: [react()],
}))
