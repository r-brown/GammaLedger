import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, rmdirSync } from 'node:fs'
import { resolve } from 'node:path'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function localReleaseBundle(): import('vite').Plugin {
  let base = '/app/'
  let outDir = 'dist'
  const capturedAssets = new Map<string, { content: string; type: 'js' | 'css' }>()

  return {
    name: 'local-release-bundle',
    configResolved(config) {
      base = config.base
      outDir = config.build.outDir ?? 'dist'
    },

    // Step 1 – capture JS/CSS content WITHOUT deleting from the bundle.
    // Deleting here would prevent Vite's HTML plugin from emitting the
    // <script src="..."> / <link href="..."> tags — we need those tags to
    // exist in the written HTML so step 2 can find and replace them.
    generateBundle(_options, bundle) {
      if (base !== './' && base !== '') return

      for (const [filename, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && filename.endsWith('.js')) {
          capturedAssets.set(filename, { content: chunk.code, type: 'js' })
        } else if (
          chunk.type === 'asset' &&
          filename.endsWith('.css') &&
          typeof chunk.source === 'string'
        ) {
          capturedAssets.set(filename, { content: chunk.source, type: 'css' })
        }
      }
    },

    // Step 2 – after all files are on disk, read index.html, inline every
    // captured asset, write back, then delete the now-redundant asset files.
    writeBundle() {
      if (base !== './' && base !== '') return
      if (capturedAssets.size === 0) return

      const distDir = resolve(__dirname, outDir)
      const htmlPath = resolve(distDir, 'index.html')
      let html = readFileSync(htmlPath, 'utf-8')

      for (const [filename, { content, type }] of capturedAssets) {
        const fullPath = `${base}${filename}` // e.g. ./assets/index-X.js

        if (type === 'js') {
          const safeContent = content.replace(/<\/script/gi, '<\\/script')
          // Regex tolerates any attribute order around src=
          const re = new RegExp(
            `<script[^>]*\\ssrc="${escapeRegExp(fullPath)}"[^>]*>\\s*</script>`,
            'i'
          )
          html = html.replace(re, `<script>${safeContent}</script>`)
        } else {
          const safeContent = content.replace(/<\/style/gi, '<\\/style')
          const re = new RegExp(
            `<link[^>]*\\shref="${escapeRegExp(fullPath)}"[^>]*>`,
            'i'
          )
          html = html.replace(re, `<style>${safeContent}</style>`)
        }

        // Remove the now-inlined asset file from disk
        const assetPath = resolve(distDir, filename)
        if (existsSync(assetPath)) rmSync(assetPath)
        const mapPath = `${assetPath}.map`
        if (existsSync(mapPath)) rmSync(mapPath)
      }

      // Remove the now-empty assets/ dir if it exists
      const assetsDir = resolve(distDir, 'assets')
      try { rmdirSync(assetsDir) } catch { /* not empty or doesn't exist — leave it */ }

      writeFileSync(htmlPath, html)
    },

    // Step 3 – copy the (now fully self-contained) index.html to 404.html.
    closeBundle() {
      const dist = resolve(__dirname, outDir)
      copyFileSync(`${dist}/index.html`, `${dist}/404.html`)
    },
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
