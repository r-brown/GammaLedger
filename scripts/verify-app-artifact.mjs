/**
 * Verify the Vite build artifact after `vite build`.
 *
 * Usage:
 *   node scripts/verify-app-artifact.mjs --mode=local   (build with --base ./)
 *   node scripts/verify-app-artifact.mjs --mode=pages   (build with --base /app/)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')

// ── Parse --mode argument ────────────────────────────────────────────────────

const modeArg = process.argv.find((a) => a.startsWith('--mode='))
if (!modeArg) {
  console.error('Error: --mode=<local|pages> is required.')
  process.exit(1)
}
const mode = modeArg.split('=')[1]
if (mode !== 'local' && mode !== 'pages') {
  console.error(`Error: unknown mode "${mode}". Expected "local" or "pages".`)
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Browser-side AI provider origins; each must be in the pages build CSP connect-src.
const REQUIRED_CONNECT_ORIGINS = ['https://generativelanguage.googleapis.com', 'https://openrouter.ai']

let failures = 0

function pass(msg) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg) {
  console.error(`  ✗ ${msg}`)
  failures++
}

function checkFileExists(rel) {
  const abs = join(DIST, rel)
  if (existsSync(abs)) {
    pass(`${rel} exists`)
    return true
  }
  fail(`${rel} is missing`)
  return false
}

// ── Mode: local ──────────────────────────────────────────────────────────────
// The localReleaseBundle Vite plugin inlines all JS and CSS into index.html
// and copies index.html → 404.html. No separate asset files should remain.

function verifyLocal() {
  console.log('Verifying local artifact (self-contained HTML)…')

  const indexOk = checkFileExists('index.html')
  const notFoundOk = checkFileExists('404.html')

  if (!indexOk) return

  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')

  // Must NOT have external script src pointing to ./assets/
  if (/<script[^>]+src=["']\.\/assets\//i.test(html)) {
    fail('index.html still has external <script src="./assets/…"> — JS was not inlined')
  } else {
    pass('index.html has no external ./assets/ script references')
  }

  // Must NOT have external link href pointing to ./assets/
  if (/<link[^>]+href=["']\.\/assets\//i.test(html)) {
    fail('index.html still has external <link href="./assets/…"> — CSS was not inlined')
  } else {
    pass('index.html has no external ./assets/ link references')
  }

  // Must contain at least one inline <script> with non-trivial content (>10 chars
  // to skip empty or whitespace-only tags that Vite may emit as placeholders).
  if (/<script(?![^>]*\bsrc=)[^>]*>[^<]{10}/i.test(html)) {
    pass('index.html contains inline <script> content')
  } else {
    fail('index.html does not appear to contain any inline script content')
  }

  // index.html and 404.html must be identical for local builds
  if (notFoundOk) {
    const notFoundHtml = readFileSync(join(DIST, '404.html'), 'utf-8')
    if (html === notFoundHtml) {
      pass('index.html and 404.html are identical')
    } else {
      fail('index.html and 404.html differ — the 404 fallback is stale')
    }
  }

  // The assets/ directory should not contain any JS or CSS files
  const assetsDir = join(DIST, 'assets')
  if (existsSync(assetsDir)) {
    const leftover = readdirSync(assetsDir).filter(
      (f) => f.endsWith('.js') || f.endsWith('.css')
    )
    if (leftover.length > 0) {
      fail(`assets/ still contains files that should have been inlined: ${leftover.join(', ')}`)
    } else {
      pass('assets/ contains no leftover JS/CSS files')
    }
  } else {
    pass('assets/ directory was cleaned up as expected')
  }
}

// ── Mode: pages ──────────────────────────────────────────────────────────────
// Standard Vite build with --base /app/. Assets live in dist/assets/.

function verifyPages() {
  console.log('Verifying GitHub Pages artifact (external assets)…')

  const indexOk = checkFileExists('index.html')
  checkFileExists('404.html')

  if (!indexOk) return

  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')

  // Must reference /app/ base path
  if (/["']\/app\//.test(html)) {
    pass('index.html references /app/ base path')
  } else {
    fail('index.html does not reference /app/ base path — was the build run with --base /app/?')
  }

  // assets/ must exist and contain JS + CSS
  const assetsDir = join(DIST, 'assets')
  if (!existsSync(assetsDir)) {
    fail('assets/ directory is missing')
    return
  }
  pass('assets/ directory exists')

  const files = readdirSync(assetsDir)
  const jsFiles = files.filter((f) => f.endsWith('.js'))
  const cssFiles = files.filter((f) => f.endsWith('.css'))

  if (jsFiles.length > 0) {
    pass(`assets/ contains ${jsFiles.length} JS file(s): ${jsFiles.join(', ')}`)
  } else {
    fail('assets/ contains no JS files')
  }

  if (cssFiles.length > 0) {
    pass(`assets/ contains ${cssFiles.length} CSS file(s): ${cssFiles.join(', ')}`)
  } else {
    fail('assets/ contains no CSS files')
  }

  // CSP must allow every AI provider origin, or production requests are silently blocked
  const cspMatch = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i)
  if (!cspMatch) {
    fail('index.html has no Content-Security-Policy meta tag')
  } else {
    const connectSrc = (cspMatch[1].split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src')) || '')
      .split(/\s+/)
      .slice(1)
    for (const origin of REQUIRED_CONNECT_ORIGINS) {
      if (connectSrc.includes(origin)) {
        pass(`CSP connect-src allows ${origin}`)
      } else {
        fail(`CSP connect-src is missing ${origin} — requests to it will be blocked in production`)
      }
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

if (mode === 'local') {
  verifyLocal()
} else {
  verifyPages()
}

if (failures > 0) {
  console.error(`\nArtifact verification failed with ${failures} error(s).`)
  process.exit(1)
}

console.log('\nArtifact verification passed.')
