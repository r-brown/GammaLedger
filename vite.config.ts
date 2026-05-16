import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

function spa404(): import('vite').Plugin {
  return {
    name: 'spa-404',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      copyFileSync(`${dist}/index.html`, `${dist}/404.html`)
    }
  }
}

export default defineConfig({
  base: '/appv2/',
  root: '.',
  plugins: [
    checker({ typescript: true }),
    spa404()
  ],
  resolve: {
    alias: {
      '@core':         '/src/core',
      '@trades':       '/src/trades',
      '@calculations': '/src/calculations',
      '@ui':           '/src/ui',
      '@utils':        '/src/utils',
      '@types-gl':     '/src/types'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
})
