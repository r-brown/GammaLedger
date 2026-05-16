import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function localReleaseBundle(): import('vite').Plugin {
  let base = '/app/'

  const toDistPath = (dist: string, assetPath: string): string => {
    const normalizedPath = assetPath.replace(/^\.?\//, '')
    return resolve(dist, normalizedPath)
  }

  const inlineScriptAttributes = (attributes: string): string => {
    return attributes.replace(/\s+crossorigin(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
  }

  const inlineLocalAssets = (dist: string, htmlFile: string): void => {
    const htmlPath = resolve(dist, htmlFile)
    const inlinedAssets = new Set<string>()
    let html = readFileSync(htmlPath, 'utf8')

    html = html.replace(
      /<script\b([^>]*?)\s+src="([^"]+)"([^>]*)><\/script>/gi,
      (tag, before: string, src: string, after: string) => {
        if (/^(?:https?:)?\/\//i.test(src)) {
          return tag
        }

        const assetPath = toDistPath(dist, src)
        const script = readFileSync(assetPath, 'utf8').replace(/<\/script/gi, '<\\/script')
        inlinedAssets.add(assetPath)

        return `<script${inlineScriptAttributes(`${before}${after}`)}>${script}</script>`
      }
    )

    html = html.replace(
      /<link\b([^>]*?)rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/gi,
      (tag, _before: string, _middle: string, href: string, _after: string) => {
        if (/^(?:https?:)?\/\//i.test(href)) {
          return tag
        }

        const assetPath = toDistPath(dist, href)
        const styles = readFileSync(assetPath, 'utf8').replace(/<\/style/gi, '<\\/style')
        inlinedAssets.add(assetPath)

        return `<style>${styles}</style>`
      }
    )

    writeFileSync(htmlPath, html)

    for (const assetPath of inlinedAssets) {
      unlinkSync(assetPath)
    }
  }

  return {
    name: 'local-release-bundle',
    configResolved(config) {
      base = config.base
    },
    closeBundle() {
      const dist = resolve(__dirname, 'dist')

      if (base === './' || base === '') {
        inlineLocalAssets(dist, 'index.html')
      }

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
