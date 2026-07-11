import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, rmdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

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
          const srcAttr = new RegExp(`\\s+src="${escapeRegExp(fullPath)}"`, 'i')
          html = html.replace(re, (tag) => {
            const openTag = tag
              .replace(srcAttr, '')
              .replace(/>\s*<\/script>$/i, '>')
            return `${openTag}${safeContent}</script>`
          })
        } else {
          const safeContent = content.replace(/<\/style/gi, '<\\/style')
          const re = new RegExp(
            `<link[^>]*\\shref="${escapeRegExp(fullPath)}"[^>]*>`,
            'i'
          )
          html = html.replace(re, () => `<style>${safeContent}</style>`)
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

// Content-Security-Policy, injected at build time only:
//  - dev stays CSP-free (Vite HMR needs inline preamble + ws: connections);
//  - the single-file release build (base './') inlines all JS/CSS into the
//    HTML via localReleaseBundle, which script-src 'self' would block, so it
//    is skipped there too.
// style-src needs 'unsafe-inline' (ECharts/AG Grid inline style attributes)
// and fonts.googleapis.com (Inter is @import-ed from the bundled CSS).
// frame-ancestors is omitted — it has no effect in a <meta> policy.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com", // data: — AG Grid ships its icon font as a data: URI
  "img-src 'self' data:",
  "connect-src 'self' https://finnhub.io https://generativelanguage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

function injectCsp(): import('vite').Plugin {
  let base = '/app/'
  return {
    name: 'gl-csp',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml(html) {
      if (base === './' || base === '') return html
      return html.replace(
        '<meta charset="UTF-8">',
        `<meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}">`
      )
    },
  }
}

function normalizeReleaseVersion(version: string | undefined): string | null {
  if (!version) return null

  const normalized = version
    .trim()
    .replace(/^gammaledger-/, '')
    .replace(/^app-/, '')
    .replace(/^v/, '')

  if (/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/.test(normalized)) {
    return normalized
  }

  return null
}

function getLatestGitVersion(): string | null {
  try {
    const tags = execFileSync('git', ['tag', '--list', '--sort=-v:refname'], { encoding: 'utf-8' })
      .split('\n')
      .map(tag => normalizeReleaseVersion(tag))
      .filter((tag): tag is string => tag !== null)

    return tags[0] ?? null
  } catch {
    return null
  }
}

function getAppVersion(): string {
  const envVersion = normalizeReleaseVersion(process.env.VITE_APP_VERSION)
  if (envVersion) return envVersion

  const latestGitVersion = getLatestGitVersion()
  if (latestGitVersion) return latestGitVersion

  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf-8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  base: '/app/',
  root: '.',
  plugins: [
    checker({ typescript: true }),
    injectCsp(),
    localReleaseBundle()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
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
