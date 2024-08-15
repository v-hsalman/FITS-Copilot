import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../',
  plugins: [react(), visualizer()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild'
  },
  server: {
    proxy: {
      '/ask': 'http://localhost:5000',
      '/chat': 'http://localhost:5000'
    }
  }
})
