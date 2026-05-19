import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

function localReleaseBundle(): import('vite').Plugin {
  let base = '/app/'
  const capturedAssets = new Map<string, { content: string; type: 'js' | 'css' }>()

  return {
    name: 'local-release-bundle',
    configResolved(config) {
      base = config.base
    },
    generateBundle(_options, bundle) {
      if (base !== './' && base !== '') return

      for (const [filename, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && filename.endsWith('.js')) {
          capturedAssets.set(filename, { content: chunk.code, type: 'js' })
          delete bundle[filename]
        } else if (chunk.type === 'asset' && filename.endsWith('.css') && typeof chunk.source === 'string') {
          capturedAssets.set(filename, { content: chunk.source, type: 'css' })
          delete bundle[filename]
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (base !== './' && base !== '') return html

        let result = html

        for (const [filename, { content, type }] of capturedAssets) {
          const fullPath = `${base}${filename}`
          if (type === 'js') {
            const safeContent = content.replace(/<\/script/gi, '<\\/script')
            const candidates = [
              `<script type="module" crossorigin src="${fullPath}"></script>`,
              `<script type="module" src="${fullPath}"></script>`,
              `<script crossorigin src="${fullPath}"></script>`,
              `<script src="${fullPath}"></script>`,
            ]
            for (const tag of candidates) {
              if (result.includes(tag)) {
                result = result.replace(tag, `<script>${safeContent}</script>`)
                break
              }
            }
          } else {
            const safeContent = content.replace(/<\/style/gi, '<\\/style')
            const candidates = [
              `<link rel="stylesheet" crossorigin href="${fullPath}">`,
              `<link rel="stylesheet" href="${fullPath}">`,
            ]
            for (const tag of candidates) {
              if (result.includes(tag)) {
                result = result.replace(tag, `<style>${safeContent}</style>`)
                break
              }
            }
          }
        }

        return result
      }
    },
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      copyFileSync(`${dist}/index.html`, `${dist}/404.html`)
    }
  }
}

export default defineConfig({
  base: '/app/',
  root: '.',
  plugins: [
    checker({ typescript: true }),
    localReleaseBundle()
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
