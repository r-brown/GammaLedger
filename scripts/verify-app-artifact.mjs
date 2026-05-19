#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, relative, sep } from 'node:path'

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split('=')
    return [key.replace(/^--/, ''), rest.join('=') || 'true']
  })
)

const mode = args.get('mode')
const distDir = args.get('dist') || 'dist'

if (!['local', 'pages'].includes(mode)) {
  fail('Usage: node scripts/verify-app-artifact.mjs --mode=local|pages [--dist=dist]')
}

const htmlFiles = ['index.html', '404.html']
const expectedBase = mode === 'pages' ? '/app/' : './'
const tagPattern = /<(script|link)\b[^>]*>/gi
const attrPattern = /\b(?:src|href)=["']([^"']+)["']/gi
const cssUrlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
const errors = []
const checkedFiles = new Set()

for (const htmlFile of htmlFiles) {
  const htmlPath = join(distDir, htmlFile)
  if (!existsSync(htmlPath)) {
    errors.push(`Missing ${htmlFile}`)
    continue
  }

  const html = readFileSync(htmlPath, 'utf8')
  if (html.includes('%BASE_URL%')) {
    errors.push(`${htmlFile} still contains unresolved %BASE_URL%`)
  }

  for (const url of collectHtmlUrls(html)) {
    validateUrl({ url, owner: htmlFile })
  }

  for (const tag of collectExternalCodeTags(html)) {
    validateInlineRequirement({ tag, owner: htmlFile })
  }

  for (const css of collectInlineStyles(html)) {
    for (const url of collectCssUrls(css)) {
      validateUrl({ url, owner: `${htmlFile} inline style` })
    }
  }
}

for (const file of Array.from(checkedFiles)) {
  if (!existsSync(file)) {
    errors.push(`Referenced file is missing: ${toDisplayPath(file)}`)
  } else if (!statSync(file).isFile()) {
    errors.push(`Referenced path is not a file: ${toDisplayPath(file)}`)
  }
}

if (mode === 'local') {
  for (const forbidden of ['assets']) {
    const path = join(distDir, forbidden)
    if (existsSync(path)) {
      errors.push(`Local ZIP artifact should be self-contained; unexpected ${forbidden}/ remains`)
    }
  }
}

if (errors.length > 0) {
  fail(`Artifact verification failed for ${mode} build:\n- ${errors.join('\n- ')}`)
}

console.log(`Verified ${mode} app artifact: ${checkedFiles.size} referenced local files resolved.`)

function collectHtmlUrls(html) {
  const htmlOnly = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  return Array.from(htmlOnly.matchAll(attrPattern), (match) => match[1])
}

function collectInlineStyles(html) {
  return Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi), (match) => match[1])
}

function collectExternalCodeTags(html) {
  return Array.from(html.matchAll(tagPattern), ([rawTag, tagName]) => {
    const attrs = Object.fromEntries(
      Array.from(rawTag.matchAll(/\b([a-zA-Z:-]+)=["']([^"']*)["']/g), ([, name, value]) => [
        name.toLowerCase(),
        value,
      ])
    )
    return { rawTag, tagName: tagName.toLowerCase(), attrs }
  }).filter(({ tagName, attrs }) => {
    if (tagName === 'script') return Boolean(attrs.src)
    if (tagName !== 'link' || !attrs.href) return false

    const rel = (attrs.rel || '').toLowerCase()
    const as = (attrs.as || '').toLowerCase()
    return (
      rel === 'stylesheet' ||
      rel === 'modulepreload' ||
      (rel === 'preload' && ['script', 'style'].includes(as))
    )
  })
}

function collectCssUrls(css) {
  return Array.from(css.matchAll(cssUrlPattern), (match) => match[2])
}

function validateInlineRequirement({ tag, owner }) {
  if (mode !== 'local') return

  const url = tag.attrs.src || tag.attrs.href || ''
  const cleanUrl = stripQueryAndHash(url.trim())
  if (!cleanUrl || shouldIgnoreUrl(cleanUrl)) return

  if (tag.tagName === 'script') {
    errors.push(`${owner} local ZIP JavaScript must be inline, not referenced as ${cleanUrl}`)
    return
  }

  errors.push(`${owner} local ZIP CSS/module assets must be inline, not referenced as ${cleanUrl}`)
}

function validateUrl({ url, owner }) {
  const cleanUrl = stripQueryAndHash(url.trim())
  if (!cleanUrl || shouldIgnoreUrl(cleanUrl)) return

  if (cleanUrl.startsWith('/src/')) {
    errors.push(`${owner} references development-only resource ${cleanUrl}`)
    return
  }

  if (mode === 'pages') {
    if (!cleanUrl.startsWith(expectedBase)) {
      errors.push(`${owner} local resource must start with ${expectedBase}: ${cleanUrl}`)
      return
    }
    addDistFile(cleanUrl.slice(expectedBase.length))
    return
  }

  if (cleanUrl.startsWith('/')) {
    errors.push(`${owner} local ZIP resource must be relative, not root-absolute: ${cleanUrl}`)
    return
  }

  if (!cleanUrl.startsWith(expectedBase)) {
    errors.push(`${owner} local ZIP resource must start with ${expectedBase}: ${cleanUrl}`)
    return
  }

  addDistFile(cleanUrl.slice(expectedBase.length))
}

function addDistFile(localPath) {
  const normalizedPath = normalize(localPath)
  if (normalizedPath.startsWith('..') || normalizedPath.includes(`..${sep}`)) {
    errors.push(`Referenced path escapes dist/: ${localPath}`)
    return
  }
  checkedFiles.add(join(distDir, normalizedPath))
}

function stripQueryAndHash(url) {
  return url.split('#')[0].split('?')[0]
}

function shouldIgnoreUrl(url) {
  return (
    url.startsWith('#') ||
    url.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(url) ||
    url.startsWith('data:')
  )
}

function toDisplayPath(path) {
  return relative(process.cwd(), path) || path
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
