# Phase 3 Prerequisites (L4/L5/L6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the three remaining low-priority Phase 3 entry-criteria items: convert two modals to native `<dialog>`, add a queued ARIA-compliant toast manager, and replace the hand-rolled Markdown renderer with `marked` + `DOMPurify`.

**Architecture:** Three independent refactors. L6 swaps five Markdown helpers in `src/utils/dom.ts` for one `marked.parse → DOMPurify.sanitize` pipeline. L4 converts `#disclaimer-banner` and `#ai-coach-consent` `<div>`s to `<dialog>` and uses `showModal()`/`close()`. L5 mounts a `<div id="toast-region">` and replaces the `alert()`/`console.log` stub in `src/ui/notifications.ts` with a small queued toast manager that respects `prefers-reduced-motion` and uses `role="status"` / `role="alert"`. Sequenced L6 → L4 → L5 (smallest blast radius first). Each task ends with `npm run typecheck` + `npm run typecheck:strict` + commit.

**Tech Stack:** TypeScript, Vite, vanilla DOM, native `<dialog>`, `marked` v12+, `dompurify` v3+. No new framework dependencies.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/utils/dom.ts` | Markdown rendering | Replace 5 helpers with one `renderMarkdownToHTML` using `marked` + `DOMPurify`; keep `escapeHTML` |
| `src/index.ts` | Class delegators + state init | Drop unused markdown delegators; drop unused modal-state fields |
| `src/styles/app.css` | Global styles | Scope `.ai-chat__bubble` heading/code/blockquote rules; rewrite modal show/hide to use `dialog[open]` + `::backdrop`; add `.toast-region` + `.toast` rules |
| `index.html` | Page shell | Convert two modals to `<dialog>`; remove ai-consent overlay div; add `<div id="toast-region">` |
| `src/ui/modals/disclaimer.ts` | Disclaimer modal lifecycle | Use `dialog.showModal()`/`close()`; drop `hideTimeoutId`/`body` state |
| `src/ui/modals/ai-coach-consent.ts` | AI consent modal lifecycle | Use `dialog.showModal()`/`close()`; drop `escapeHandler`/`restoreFocus`; add native `cancel` + backdrop-click handler |
| `src/ui/notifications.ts` | Toast manager | Mount region; queue/visible state; auto-dismiss; ARIA attrs |
| `package.json` | Dependencies | Add `marked`, `dompurify`, `@types/dompurify` |

---

## Task 0: Branch hygiene + baseline

**Files:**
- No file changes; verifies baseline before refactor begins.

- [ ] **Step 1: Verify clean working tree on the feature branch**

Run:
```bash
git status
```

Expected: working tree clean, branch `feature/RB/phase1`. If dirty, stop and surface to the user.

- [ ] **Step 2: Verify baseline typecheck and build pass**

Run:
```bash
npm run typecheck
npm run typecheck:strict
npm run build
```

Expected: all three exit code 0. The build prints the bundle. Take note of the JS bundle size so we can compare after L6 (DOMPurify + marked are the only meaningful additions).

---

## L6 — Markdown via `marked` + `DOMPurify`

### Task 1: Add `marked` and `dompurify` dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime + type dependencies**

Run:
```bash
npm install marked dompurify
npm install --save-dev @types/dompurify
```

Expected: `package.json` gains `"marked"` and `"dompurify"` under `dependencies`, and `"@types/dompurify"` under `devDependencies`. `marked` ships its own types since v5 — no `@types/marked` needed.

- [ ] **Step 2: Verify install**

Run:
```bash
npm ls marked dompurify @types/dompurify
```

Expected: each prints a single resolved version.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add marked + dompurify for AI chat Markdown rendering"
```

### Task 2: Swap markdown helpers to marked + DOMPurify

**Files:**
- Modify: `src/utils/dom.ts:100-300`

- [ ] **Step 1: Replace the markdown helper block in `src/utils/dom.ts`**

Open `src/utils/dom.ts`. Find the block starting at the comment `// Markdown rendering helpers` (around line 100) through the end of `sanitizeMarkdownUrl` (around line 300). Keep `escapeHTML` (it lives above this block, around line 24).

Replace the entire markdown block (the comment header + `renderMarkdownToHTML`, `renderMarkdownTextSegment`, `formatMarkdownInline`, `applyBasicInlineFormatting`, `sanitizeMarkdownUrl`) with:

```ts
// ---------------------------------------------------------------------------
// Markdown rendering — marked + DOMPurify
// Replaces the prior hand-rolled CommonMark subset. AI chat is the only caller.
// ---------------------------------------------------------------------------

import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({ gfm: true, breaks: false })

let domPurifyHookInstalled = false
function ensureDomPurifyHook(): void {
    if (domPurifyHookInstalled) return
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node instanceof Element && node.tagName === 'A') {
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
        }
    })
    domPurifyHookInstalled = true
}

const MARKDOWN_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'a',
]
const MARKDOWN_ALLOWED_ATTR = ['href']

export function renderMarkdownToHTML(markdown = ''): string {
    if (!markdown) return ''
    ensureDomPurifyHook()
    const raw = marked.parse(markdown, { async: false }) as string
    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
        ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTR,
    })
}
```

Add the `marked` and `DOMPurify` imports near the top of the file (group with the other imports). If `dom.ts` has no existing imports, add them at the very top.

- [ ] **Step 2: Drop dead delegators from `src/index.ts`**

Open `src/index.ts`. Find lines around 1053–1061:

```ts
    renderMarkdownToHTML(markdown = '') { return dom.renderMarkdownToHTML.call(this, markdown); }

    renderMarkdownTextSegment(text = '') { return dom.renderMarkdownTextSegment.call(this, text); }

    formatMarkdownInline(text = '') { return dom.formatMarkdownInline.call(this, text); }

    applyBasicInlineFormatting(text = '') { return dom.applyBasicInlineFormatting.call(this, text); }

    sanitizeMarkdownUrl(url = '') { return dom.sanitizeMarkdownUrl.call(this, url); }
```

Replace with:

```ts
    renderMarkdownToHTML(markdown = '') { return dom.renderMarkdownToHTML(markdown); }
```

(Drop the four unused delegators; drop the now-unneeded `.call(this, ...)` since `renderMarkdownToHTML` no longer references `this`.)

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
```

Expected: 0 errors. If `marked.parse` complains about the `async` overload returning `string | Promise<string>`, the `as string` cast plus `{ async: false }` resolves it.

- [ ] **Step 4: Run strict typecheck**

Run:
```bash
npm run typecheck:strict
```

Expected: 0 errors. `src/utils/` has `strict: true`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dom.ts src/index.ts
git commit -m "L6: replace custom Markdown renderer with marked + DOMPurify"
```

### Task 3: Scope AI chat bubble CSS to compensate for new tag set

**Files:**
- Modify: `src/styles/app.css`

The previous renderer emitted `<h3>`/`<h4>`/`<h5>` for `#`/`##`/`###` (off-by-two heading shift), and added `ai-chat__code` / `ai-chat__quote` / `ai-chat__rule` classes to `<pre>`/`<blockquote>`/`<hr>`. `marked` emits `<h1>`/`<h2>`/`<h3>` and bare tags. Compensate via scoped CSS.

- [ ] **Step 1: Locate existing `.ai-chat__code`/`.ai-chat__quote`/`.ai-chat__rule` rules**

Run:
```bash
grep -n "ai-chat__code\|ai-chat__quote\|ai-chat__rule\|ai-chat__bubble" src/styles/app.css
```

Expected: a handful of matches — note their line numbers and the existing rule shapes so the new scoped rules match the visual style.

- [ ] **Step 2: Add scoped bubble rules**

Insert (or extend) inside `src/styles/app.css` near the existing `.ai-chat__bubble` block:

```css
.ai-chat__bubble pre {
    /* preserves the prior .ai-chat__code visual */
    margin: var(--space-8) 0;
    padding: var(--space-12);
    border-radius: var(--radius-md);
    background: var(--color-surface-2, rgba(0, 0, 0, 0.05));
    overflow-x: auto;
    font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: var(--font-size-sm);
}

.ai-chat__bubble blockquote {
    /* preserves the prior .ai-chat__quote visual */
    margin: var(--space-8) 0;
    padding-left: var(--space-12);
    border-left: 3px solid var(--color-brand-purple, #7c3aed);
    color: var(--color-text-secondary);
    font-style: italic;
}

.ai-chat__bubble hr {
    /* preserves the prior .ai-chat__rule visual */
    margin: var(--space-12) 0;
    border: 0;
    border-top: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
}

/* marked emits real h1/h2/h3 — scale them down inside chat bubbles */
.ai-chat__bubble h1 { font-size: var(--font-size-lg); margin: var(--space-8) 0; }
.ai-chat__bubble h2 { font-size: var(--font-size-md); margin: var(--space-8) 0; }
.ai-chat__bubble h3 { font-size: var(--font-size-base); margin: var(--space-6) 0; font-weight: var(--font-weight-semibold, 600); }
.ai-chat__bubble h4,
.ai-chat__bubble h5,
.ai-chat__bubble h6 { font-size: var(--font-size-base); margin: var(--space-6) 0; font-weight: var(--font-weight-semibold, 600); }
```

If the existing `.ai-chat__code`/`.ai-chat__quote`/`.ai-chat__rule` selectors had subtle properties (e.g., specific colours or borders) that differ from the snippet above, copy those exact properties into the scoped `.ai-chat__bubble pre` / `blockquote` / `hr` rules to preserve fidelity.

- [ ] **Step 3: Remove the now-unused class-based rules**

Delete the old `.ai-chat__code`, `.ai-chat__quote`, `.ai-chat__rule` rule blocks (the class selectors no longer appear in any emitted HTML).

- [ ] **Step 4: Build and inspect**

Run:
```bash
npm run build
```

Expected: clean build. The CSS bundle should not change in size meaningfully.

- [ ] **Step 5: Manual smoke test**

Run:
```bash
npm run preview
```

Open `http://127.0.0.1:4173/`, navigate to the AI Coach chat (Settings → enable consent flag, or clear `localStorage` and accept again), and trigger a chat reply. Verify:
- Bold/italic render
- Bullet/numbered lists render
- Inline `code` and fenced ``` blocks render
- Headings render at the scaled-down sizes
- Links render with `target="_blank"` (inspect via DevTools)
- No `<script>`, `<iframe>`, or `<style>` survives in the rendered HTML (paste `<script>alert(1)</script>` into a stub if needed — but only via mocked AI response in dev; do not send to a live API)

If you don't have a Gemini key configured locally, paste markdown text into a `LocalInsightsAgent` reply by sending a chat — the local agent emits markdown that's enough to verify the renderer.

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css
git commit -m "L6: scope AI chat bubble styles for marked tag set"
```

---

## L4 — Native `<dialog>` modals

### Task 4: Convert `#disclaimer-banner` and `#ai-coach-consent` to `<dialog>` in `index.html`

**Files:**
- Modify: `index.html:53-108`

- [ ] **Step 1: Replace the disclaimer banner outer element**

Open `index.html`. Find the block starting at line 53:

```html
    <div id="disclaimer-banner" class="disclaimer-banner is-hidden" role="dialog" aria-modal="true"
        aria-labelledby="disclaimer-title" aria-hidden="true">
```

Replace the opening tag with:

```html
    <dialog id="disclaimer-banner" class="disclaimer-banner" aria-labelledby="disclaimer-title">
```

Find the matching closing `</div>` for `#disclaimer-banner` (at the end of the block, around line 82) and change it to `</dialog>`.

- [ ] **Step 2: Replace the AI consent modal outer element and remove overlay**

Find the block starting at line 83:

```html
    <div id="ai-coach-consent" class="ai-consent-modal is-hidden" role="dialog" aria-modal="true"
        aria-labelledby="ai-consent-title" aria-describedby="ai-consent-description">
        <div class="ai-consent-modal__overlay" data-action="ai-consent-dismiss"></div>
```

Replace the opening tag with:

```html
    <dialog id="ai-coach-consent" class="ai-consent-modal" aria-labelledby="ai-consent-title" aria-describedby="ai-consent-description">
```

Delete the entire `<div class="ai-consent-modal__overlay" ...></div>` line — the dialog `::backdrop` replaces it, and dismiss-on-backdrop is handled in JS via a click listener on the dialog itself.

Find the matching closing `</div>` for `#ai-coach-consent` (at the end of the block, around line 108) and change it to `</dialog>`.

- [ ] **Step 3: Verify the file parses**

Run:
```bash
npm run build
```

Expected: clean build. No HTML parsing complaints from Vite.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "L4: convert disclaimer and AI-consent modals to <dialog> markup"
```

### Task 5: Update modal CSS for `<dialog>` semantics

**Files:**
- Modify: `src/styles/app.css:1925-2155` (approximate — covers `.disclaimer-banner` and `.ai-consent-modal` blocks)

- [ ] **Step 1: Drop the show/hide rules that fight `<dialog>`**

Find and delete:

```css
.disclaimer-banner.is-hidden {
    display: none;
}
```

And:

```css
.ai-consent-modal.is-hidden {
    display: none;
}
```

`<dialog>` is `display: none` by default, becomes `display: block` when `[open]`. Our own rule conflicts.

- [ ] **Step 2: Rebase the outer-element rules onto `dialog`**

The existing `.disclaimer-banner` block (around line 1925) sets up flex centering, backdrop blur, and a fade transition on the outer element. `<dialog>` natively centers via `margin: auto` and renders the backdrop via `::backdrop`. Rewrite as:

```css
.disclaimer-banner {
    /* native <dialog> uses margin: auto + position: fixed when open. */
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    max-width: 100vw;
    max-height: 100vh;
    overflow: visible;
}

.disclaimer-banner::backdrop {
    background: rgba(var(--color-slate-900-rgb), 0.55);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.disclaimer-banner[open] .disclaimer-banner__panel {
    transform: translateY(0);
    opacity: 1;
}
```

Remove the obsolete `.disclaimer-banner.is-visible` rules (the panel transform now keys off `.disclaimer-banner[open]`).

Mirror the same shape for `.ai-consent-modal` — drop overlay z-index/centering on the outer element, add `::backdrop` blur, key the panel transform off `.ai-consent-modal[open] .ai-consent-modal__panel`.

Delete the `.ai-consent-modal__overlay` rule entirely (the element is gone).

- [ ] **Step 3: Preserve animation entry**

Native `<dialog>` jumps to `[open]` instantly when `showModal()` is called, which makes the panel transform trigger on the *first* render — no fade. To keep the existing fade-in feel, JS will toggle an `is-visible` class on the next animation frame. The panel transform stays keyed off both `[open]` and `.is-visible` for compatibility:

Add:

```css
.disclaimer-banner.is-visible .disclaimer-banner__panel,
.disclaimer-banner[open].is-visible .disclaimer-banner__panel {
    transform: translateY(0);
    opacity: 1;
}

.ai-consent-modal.is-visible .ai-consent-modal__panel,
.ai-consent-modal[open].is-visible .ai-consent-modal__panel {
    transform: translateY(0);
    opacity: 1;
}
```

(The `[open]` selector is the fallback if the JS class hook ever fails.)

- [ ] **Step 4: Build**

Run:
```bash
npm run build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css
git commit -m "L4: rebase modal CSS onto <dialog> [open] + ::backdrop"
```

### Task 6: Update `src/ui/modals/disclaimer.ts` to use `<dialog>`

**Files:**
- Modify: `src/ui/modals/disclaimer.ts` (entire file)
- Modify: `src/index.ts:192-199` (drop `body` and `hideTimeoutId` state init)

- [ ] **Step 1: Rewrite `src/ui/modals/disclaimer.ts`**

Replace the contents with:

```ts
// src/ui/modals/disclaimer.ts — Wave 8: Disclaimer banner modal (native <dialog>).
// Uses the .call(this, …) delegation pattern.

import { DISCLAIMER_STORAGE_KEY } from '@core/config'

interface DisclaimerBannerState {
  element: HTMLDialogElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
}

interface DisclaimerContext {
  disclaimerBanner: DisclaimerBannerState
  disclaimerFadeMs: number
  acceptDisclaimer(): void
  getDisclaimerAcceptance(): string | null
  showDisclaimerBanner(): void
  hideDisclaimerBanner(opts?: { immediate?: boolean }): void
  setDisclaimerAcceptance(value: string | null): void
}

export function initializeDisclaimerBanner(this: DisclaimerContext): void {
    const element = document.getElementById('disclaimer-banner') as HTMLDialogElement | null
    if (!element) return

    if (this.disclaimerBanner.agreeButton && this.disclaimerBanner.agreeHandler) {
        this.disclaimerBanner.agreeButton.removeEventListener('click', this.disclaimerBanner.agreeHandler)
    }

    const agreeButton = element.querySelector('[data-action="disclaimer-agree"]')
    this.disclaimerBanner.element = element
    this.disclaimerBanner.agreeButton = agreeButton

    const handler = () => this.acceptDisclaimer()
    this.disclaimerBanner.agreeHandler = handler
    if (agreeButton) {
        agreeButton.addEventListener('click', handler)
    }

    const acceptedAt = this.getDisclaimerAcceptance()
    if (acceptedAt) {
        this.hideDisclaimerBanner({ immediate: true })
    } else {
        this.showDisclaimerBanner()
    }
}

export function showDisclaimerBanner(this: DisclaimerContext): void {
    const banner = this.disclaimerBanner.element
    if (!banner) return
    if (!banner.open) banner.showModal()
    requestAnimationFrame(() => {
        banner.classList.add('is-visible')
    })
}

export function hideDisclaimerBanner(this: DisclaimerContext, { immediate = false } = {}): void {
    const banner = this.disclaimerBanner.element
    if (!banner) return

    banner.classList.remove('is-visible')

    if (immediate) {
        if (banner.open) banner.close()
        return
    }

    setTimeout(() => {
        if (banner.open) banner.close()
    }, this.disclaimerFadeMs)
}

export function acceptDisclaimer(this: DisclaimerContext): void {
    this.setDisclaimerAcceptance(new Date().toISOString())
    this.hideDisclaimerBanner()
}

export function getDisclaimerAcceptance(): string | null {
    try {
        const value = localStorage.getItem(DISCLAIMER_STORAGE_KEY)
        return value || null
    } catch (error) {
        console.warn('Failed to read disclaimer acceptance from storage:', error)
        return null
    }
}

export function setDisclaimerAcceptance(value: string | null): void {
    try {
        if (!value) {
            localStorage.removeItem(DISCLAIMER_STORAGE_KEY)
            return
        }
        localStorage.setItem(DISCLAIMER_STORAGE_KEY, value)
    } catch (error) {
        console.warn('Failed to persist disclaimer acceptance:', error)
    }
}
```

- [ ] **Step 2: Update state init in `src/index.ts`**

Open `src/index.ts`. Around line 192:

```ts
        this.disclaimerBanner = {
            element: null,
            body: null,
            agreeButton: null,
            agreeHandler: null,
            hideTimeoutId: null
        };
```

Replace with:

```ts
        this.disclaimerBanner = {
            element: null,
            agreeButton: null,
            agreeHandler: null
        };
```

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
npm run typecheck:strict
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/modals/disclaimer.ts src/index.ts
git commit -m "L4: disclaimer modal uses native <dialog> showModal/close"
```

### Task 7: Update `src/ui/modals/ai-coach-consent.ts` to use `<dialog>`

**Files:**
- Modify: `src/ui/modals/ai-coach-consent.ts` (entire file)
- Modify: `src/index.ts:201-212` (drop `escapeHandler` and `restoreFocus` state init)

- [ ] **Step 1: Rewrite `src/ui/modals/ai-coach-consent.ts`**

Replace the contents with:

```ts
// src/ui/modals/ai-coach-consent.ts — Wave 8: AI Coach consent modal (native <dialog>).
// Uses the .call(this, …) delegation pattern.

import { AI_COACH_CONSENT_STORAGE_KEY } from '@core/config'

interface AICoachConsentState {
  element: HTMLDialogElement | null
  panel: HTMLElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
  dismissButtons: Element[]
  dismissHandlers: ((event: Event) => void)[]
  cancelHandler: ((event: Event) => void) | null
  backdropHandler: ((event: MouseEvent) => void) | null
  pendingAction: (() => void) | null
  isVisible: boolean
}

interface AICoachConsentContext {
  aiCoachConsent: AICoachConsentState
  initializeAICoachConsent(): void
  showAICoachConsent(): void
  hideAICoachConsent(opts?: { immediate?: boolean }): void
  acceptAICoachConsent(): void
  cancelAICoachConsent(): void
  hasAICoachConsent(): boolean
  getAICoachConsent(): string | null
  setAICoachConsent(value: string | null): void
  updateAIChatHeader(): void
}

const HIDE_FADE_MS = 220

export function initializeAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent
    const element = document.getElementById('ai-coach-consent') as HTMLDialogElement | null
    if (!element) return

    consent.element = element
    consent.panel = (element.querySelector('.ai-consent-modal__panel') || element) as HTMLElement

    if (consent.agreeButton && consent.agreeHandler) {
        consent.agreeButton.removeEventListener('click', consent.agreeHandler)
    }
    const agreeButton = element.querySelector('[data-action="ai-consent-agree"]')
    consent.agreeButton = agreeButton
    const agreeHandler = () => this.acceptAICoachConsent()
    consent.agreeHandler = agreeHandler
    if (agreeButton) agreeButton.addEventListener('click', agreeHandler)

    consent.dismissButtons.forEach((button, index) => {
        const handler = consent.dismissHandlers[index]
        if (button && handler) button.removeEventListener('click', handler)
    })
    const dismissButtons = Array.from(element.querySelectorAll('[data-action="ai-consent-dismiss"]'))
    consent.dismissButtons = dismissButtons
    consent.dismissHandlers = dismissButtons.map((button) => {
        const handler = (event: Event) => {
            event.preventDefault()
            this.cancelAICoachConsent()
        }
        button.addEventListener('click', handler)
        return handler
    })

    if (consent.cancelHandler) {
        element.removeEventListener('cancel', consent.cancelHandler)
    }
    const cancelHandler = (event: Event) => {
        event.preventDefault() // suppress instant close so the fade-out animation runs
        this.cancelAICoachConsent()
    }
    consent.cancelHandler = cancelHandler
    element.addEventListener('cancel', cancelHandler)

    if (consent.backdropHandler) {
        element.removeEventListener('click', consent.backdropHandler as EventListener)
    }
    const backdropHandler = (event: MouseEvent) => {
        // Click on the dialog element itself = click on the backdrop area outside the panel.
        if (event.target === element) {
            this.cancelAICoachConsent()
        }
    }
    consent.backdropHandler = backdropHandler
    element.addEventListener('click', backdropHandler as EventListener)

    this.updateAIChatHeader()
}

export function showAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent
    const { element, panel } = consent
    if (!element) return

    if (!element.open) element.showModal()
    requestAnimationFrame(() => {
        element.classList.add('is-visible')
        consent.isVisible = true
        if (panel && typeof panel.focus === 'function') {
            panel.setAttribute('tabindex', '-1')
            try { panel.focus({ preventScroll: true }) } catch (_e) { panel.focus() }
        }
    })
}

export function hideAICoachConsent(this: AICoachConsentContext, { immediate = false } = {}): void {
    const consent = this.aiCoachConsent
    const { element } = consent
    if (!element) return

    element.classList.remove('is-visible')
    consent.isVisible = false

    if (immediate) {
        if (element.open) element.close()
        return
    }

    setTimeout(() => {
        if (element.open) element.close()
    }, HIDE_FADE_MS)
}

export function promptAICoachConsent(this: AICoachConsentContext, nextAction: (() => void) | null = null): boolean {
    if (!this.aiCoachConsent.element) {
        this.initializeAICoachConsent()
    }

    if (this.hasAICoachConsent()) {
        if (typeof nextAction === 'function') {
            try { nextAction() } catch (error) { console.error('AI Coach consent follow-up failed:', error) }
        }
        return true
    }

    this.aiCoachConsent.pendingAction = typeof nextAction === 'function' ? nextAction : null
    this.showAICoachConsent()
    return false
}

export function acceptAICoachConsent(this: AICoachConsentContext): void {
    this.setAICoachConsent(new Date().toISOString())
    const followUp = this.aiCoachConsent.pendingAction
    this.aiCoachConsent.pendingAction = null
    this.hideAICoachConsent()
    this.updateAIChatHeader()

    if (typeof followUp === 'function') {
        try { followUp() } catch (error) { console.error('AI Coach consent follow-up failed:', error) }
    }
}

export function cancelAICoachConsent(this: AICoachConsentContext): void {
    this.aiCoachConsent.pendingAction = null
    this.hideAICoachConsent()
    this.updateAIChatHeader()
}

export function hasAICoachConsent(this: AICoachConsentContext): boolean {
    return Boolean(this.getAICoachConsent())
}

export function getAICoachConsent(): string | null {
    try {
        const value = localStorage.getItem(AI_COACH_CONSENT_STORAGE_KEY)
        return value || null
    } catch (error) {
        console.warn('Failed to read AI Coach consent from storage:', error)
        return null
    }
}

export function setAICoachConsent(value: string | null): void {
    try {
        if (!value) {
            localStorage.removeItem(AI_COACH_CONSENT_STORAGE_KEY)
            return
        }
        localStorage.setItem(AI_COACH_CONSENT_STORAGE_KEY, value)
    } catch (error) {
        console.warn('Failed to persist AI Coach consent:', error)
    }
}
```

- [ ] **Step 2: Update state init in `src/index.ts`**

Open `src/index.ts`. Around line 201:

```ts
        this.aiCoachConsent = {
            element: null,
            panel: null,
            agreeButton: null,
            agreeHandler: null,
            dismissButtons: [],
            dismissHandlers: [],
            escapeHandler: null,
            restoreFocus: null,
            pendingAction: null,
            isVisible: false
        };
```

Replace with:

```ts
        this.aiCoachConsent = {
            element: null,
            panel: null,
            agreeButton: null,
            agreeHandler: null,
            dismissButtons: [],
            dismissHandlers: [],
            cancelHandler: null,
            backdropHandler: null,
            pendingAction: null,
            isVisible: false
        };
```

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
npm run typecheck:strict
```

Expected: 0 errors.

- [ ] **Step 4: Build and smoke test**

Run:
```bash
npm run build
npm run preview
```

In a separate terminal: open `http://127.0.0.1:4173/` in Chrome.

To exercise:

1. **Disclaimer modal** — open DevTools console: `localStorage.removeItem('GammaLedgerDisclaimerAcceptedAt')`, reload. The disclaimer should appear with the panel fade-in. Click "Agree" — it closes; reload — it does not reappear.
2. **AI consent modal** — `localStorage.removeItem('GammaLedgerAICoachConsentAt')`, reload. Open the AI Coach view, attempt a chat — the consent modal appears. Verify:
   - Press Escape → modal closes (cancel path)
   - Click outside the panel (on the backdrop) → modal closes
   - Click the × button → modal closes
   - Click "I Understand & Agree" → modal closes and the pending chat action runs

If the dialog appears but the fade-in is missing, confirm `is-visible` is being added on the next frame in DevTools.

- [ ] **Step 5: Commit**

```bash
git add src/ui/modals/ai-coach-consent.ts src/index.ts
git commit -m "L4: AI consent modal uses native <dialog> with cancel + backdrop click"
```

---

## L5 — Queued ARIA toast manager

### Task 8: Add toast region to `index.html`

**Files:**
- Modify: `index.html` (one line near the end of `<body>`)

- [ ] **Step 1: Find the end of `<body>` (just before the `<script>` that loads the bundle)**

Run:
```bash
grep -n "</body>\|src=\"/src/index" index.html
```

- [ ] **Step 2: Add the toast region container**

Just before the `<script type="module" src="/src/index.js">` line (or wherever Vite injects the bundle reference), insert:

```html
    <div id="toast-region" class="toast-region" aria-label="Notifications" role="region"></div>
```

The container is empty — toasts are appended at runtime.

- [ ] **Step 3: Build**

Run:
```bash
npm run build
```

Expected: clean build.

### Task 9: Add toast CSS

**Files:**
- Modify: `src/styles/app.css` (append)

- [ ] **Step 1: Append toast styles**

Append to `src/styles/app.css` (or insert near other top-level UI helper rules):

```css
/* Toast notifications --------------------------------------------------- */

.toast-region {
    position: fixed;
    top: var(--space-16);
    right: var(--space-16);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    z-index: 4000;
    max-width: min(420px, 90vw);
    pointer-events: none;
}

.toast {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    padding: var(--space-12) var(--space-16);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface, #fff);
    color: var(--color-text);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
    border-left: 4px solid var(--color-text-secondary);
    pointer-events: auto;
    opacity: 0;
    transform: translateX(16px);
    transition: opacity 180ms ease, transform 180ms ease;
}

.toast.is-visible {
    opacity: 1;
    transform: translateX(0);
}

.toast--info { border-left-color: var(--color-brand-purple, #7c3aed); }
.toast--success { border-left-color: var(--color-teal-500, #14b8a6); }
.toast--warning { border-left-color: var(--color-orange-400, #fb923c); }
.toast--error { border-left-color: var(--color-red-500, #ef4444); }

.toast__message {
    flex: 1;
    font-size: var(--font-size-base);
    line-height: 1.4;
    white-space: pre-line;
    overflow-wrap: anywhere;
}

.toast__close {
    flex: 0 0 auto;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--font-size-lg);
    line-height: 1;
    padding: 2px 6px;
    border-radius: var(--radius-sm, 4px);
}

.toast__close:hover,
.toast__close:focus-visible {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.06);
    outline: none;
}

@media (prefers-reduced-motion: reduce) {
    .toast {
        transition: none;
        transform: none;
    }
}
```

- [ ] **Step 2: Build**

Run:
```bash
npm run build
```

Expected: clean build.

### Task 10: Implement the toast queue in `src/ui/notifications.ts`

**Files:**
- Modify: `src/ui/notifications.ts` (entire file — keep `ToastVariant` type from `@types-gl`)

- [ ] **Step 1: Replace `src/ui/notifications.ts` contents**

Replace the file with:

```ts
// src/ui/notifications.ts — Wave 8: Notification + toast helpers.
// Vanilla queued toast manager with ARIA live regions.
// Uses the .call(this, …) delegation pattern for the unsaved-indicator helpers.

import type { ToastVariant } from '@types-gl/common'

interface NotificationsContext {
  hasUnsavedChanges: boolean
  currentFileName: string
  updateUnsavedIndicator(): void
  updateFileNameDisplay(): void
}

interface ToastOptions {
  duration?: number
  closable?: boolean
}

interface VisibleToast {
  element: HTMLElement
  timeoutId: ReturnType<typeof setTimeout> | null
  remainingMs: number
  expiresAt: number
}

interface QueuedToast {
  message: string
  type: ToastVariant
  options: ToastOptions
}

const MAX_VISIBLE = 3
const DEFAULT_DURATION_MS = 4000
const ERROR_DURATION_MS = 8000
const ANIMATION_MS = 180

const visible: VisibleToast[] = []
const queue: QueuedToast[] = []

function getRegion(): HTMLElement | null {
    return document.getElementById('toast-region')
}

function durationFor(type: ToastVariant, override?: number): number {
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) return override
    return type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS
}

function scheduleDismiss(toast: VisibleToast, ms: number): void {
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
    toast.remainingMs = ms
    toast.expiresAt = Date.now() + ms
    toast.timeoutId = setTimeout(() => dismiss(toast.element), ms)
}

function pauseDismiss(toast: VisibleToast): void {
    if (!toast.timeoutId) return
    clearTimeout(toast.timeoutId)
    toast.timeoutId = null
    toast.remainingMs = Math.max(0, toast.expiresAt - Date.now())
}

function resumeDismiss(toast: VisibleToast): void {
    if (toast.timeoutId) return
    if (toast.remainingMs <= 0) {
        dismiss(toast.element)
        return
    }
    scheduleDismiss(toast, toast.remainingMs)
}

function pumpQueue(): void {
    while (queue.length > 0 && visible.length < MAX_VISIBLE) {
        const next = queue.shift()
        if (!next) break
        mount(next.message, next.type, next.options)
    }
}

function dismiss(el: HTMLElement): void {
    const idx = visible.findIndex((t) => t.element === el)
    if (idx === -1) return
    const toast = visible[idx]
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
    visible.splice(idx, 1)

    el.classList.remove('is-visible')
    setTimeout(() => {
        el.remove()
        pumpQueue()
    }, ANIMATION_MS)
}

function mount(message: string, type: ToastVariant, options: ToastOptions): void {
    const region = getRegion()
    if (!region) {
        // Fallback when the region is not in the DOM (older saved html, tests).
        console.log(`${type.toUpperCase()}: ${message}`)
        return
    }

    const el = document.createElement('div')
    el.className = `toast toast--${type}`
    el.setAttribute('role', type === 'error' ? 'alert' : 'status')
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
    el.setAttribute('aria-atomic', 'true')

    const messageEl = document.createElement('div')
    messageEl.className = 'toast__message'
    messageEl.textContent = message
    el.appendChild(messageEl)

    const closable = options.closable !== false
    if (closable) {
        const closeBtn = document.createElement('button')
        closeBtn.type = 'button'
        closeBtn.className = 'toast__close'
        closeBtn.setAttribute('aria-label', 'Dismiss notification')
        closeBtn.textContent = '×'
        closeBtn.addEventListener('click', () => dismiss(el))
        el.appendChild(closeBtn)
    }

    region.appendChild(el)
    requestAnimationFrame(() => el.classList.add('is-visible'))

    const toast: VisibleToast = {
        element: el,
        timeoutId: null,
        remainingMs: 0,
        expiresAt: 0,
    }
    visible.push(toast)

    const ms = durationFor(type, options.duration)
    scheduleDismiss(toast, ms)

    el.addEventListener('mouseenter', () => pauseDismiss(toast))
    el.addEventListener('mouseleave', () => resumeDismiss(toast))
    el.addEventListener('focusin', () => pauseDismiss(toast))
    el.addEventListener('focusout', () => resumeDismiss(toast))
}

export function showNotification(message: string, type: ToastVariant = 'info', options: ToastOptions = {}): void {
    if (!message) return
    if (visible.length >= MAX_VISIBLE) {
        queue.push({ message, type, options })
        return
    }
    mount(message, type, options)
}

export function showLoadingIndicator(text = 'Loading...'): void {
    const indicator = document.getElementById('loading-indicator')
    if (indicator) {
        indicator.textContent = text
        indicator.classList.remove('hidden')
    }
}

export function hideLoadingIndicator(): void {
    const indicator = document.getElementById('loading-indicator')
    if (indicator) {
        indicator.classList.add('hidden')
    }
}

export function markUnsavedChanges(this: NotificationsContext): void {
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
}

export function updateFileNameDisplay(this: NotificationsContext): void {
    const nameEl = document.getElementById('current-file-name')
    if (!nameEl) return

    nameEl.textContent = this.currentFileName
    if (this.currentFileName === 'Unsaved Database') {
        nameEl.classList.add('is-unsaved')
    } else {
        nameEl.classList.remove('is-unsaved')
    }
}

export function updateUnsavedIndicator(this: NotificationsContext): void {
    const indicator = document.getElementById('unsaved-indicator')
    if (this.hasUnsavedChanges) {
        indicator?.classList.remove('hidden')
    } else {
        indicator?.classList.add('hidden')
    }
}
```

- [ ] **Step 2: Verify the index delegator still resolves**

Open `src/index.ts`. Confirm line ~1677 still reads:

```ts
    showNotification(message, type = 'info') { return notificationsModule.showNotification.call(this, message, type); }
```

The `.call(this, …)` is harmless — `showNotification` is now a free function and ignores `this`. Leave it as is to avoid touching every signature row.

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
npm run typecheck:strict
```

Expected: 0 errors. The strict config for `src/ui/` covers the changed file.

- [ ] **Step 4: Build**

Run:
```bash
npm run build
```

Expected: clean build.

- [ ] **Step 5: Manual smoke test**

Run:
```bash
npm run preview
```

Open `http://127.0.0.1:4173/` and:

1. Save the database (Ctrl/Cmd + S, or click the save button) → expect a green-bordered "Database saved successfully!" toast at the top right.
2. Trigger an error path: open Settings, paste an obviously invalid JSON in the Import view (e.g. `not json`), import → expect a red-bordered "Invalid JSON file" toast with `role="alert"`.
3. In DevTools console, fire 5 rapid notifications:
   ```js
   for (let i = 1; i <= 5; i++) window.tracker.showNotification(`Toast ${i}`, 'info')
   ```
   Expect 3 to mount immediately and 2 to queue, mounting as the first dismiss.
4. Hover a toast — auto-dismiss pauses; leave — it resumes.
5. DevTools accessibility tree: confirm `role="status"`/`role="alert"` and `aria-live` values.

- [ ] **Step 6: Commit**

```bash
git add index.html src/styles/app.css src/ui/notifications.ts
git commit -m "L5: queued ARIA-compliant toast manager replaces alert/console stub"
```

---

## Final verification

### Task 11: Whole-app verification

**Files:**
- None modified.

- [ ] **Step 1: Run full typecheck suite**

Run:
```bash
npm run typecheck
npm run typecheck:strict
```

Expected: 0 errors across both.

- [ ] **Step 2: Run production build**

Run:
```bash
npm run build
```

Expected: clean build. Note the bundle delta vs Task 0 baseline. Expected delta: roughly +45 kB JS gzip from `marked` + `dompurify`, with the modal and notification changes adding little.

- [ ] **Step 3: Smoke-test the app end to end**

Run:
```bash
npm run preview
```

Open `http://127.0.0.1:4173/` and walk the golden path:

1. Disclaimer (clear `localStorage` first) — appears, fades in, Agree closes, does not reappear after reload.
2. Dashboard renders with sample data — 8 chart canvases visible, P&L + position counts populate.
3. Save database — toast appears.
4. AI Coach modal — clear `GammaLedgerAICoachConsentAt`, open AI Coach chat, attempt a question — consent modal appears, Escape/backdrop/cancel/agree all behave correctly.
5. Markdown rendering — send a chat message that produces markdown output (the local agent emits headings/lists/bold). Inspect DOM: `<a target="_blank" rel="noopener noreferrer">` on links, no `is-visible` script tags.
6. Toast queue — fire 5 notifications via console as in Task 10 step 5 — queueing behaves.

- [ ] **Step 4: Update `MIGRATION_PROGRESS.md`**

Open `MIGRATION_PROGRESS.md`. Update the **L4**, **L5**, **L6** entries (lines around 446–486) so each one is marked `✅ Complete` with a one-paragraph "Completed scope" matching the L1/L2/L3 style. Update the Phase 3 entry-criteria table (around line 524) to mark L4 as ✅ alongside L1/L2/L3. Add a `5. native <dialog> ✅ Done` etc. row to the recommended sequencing block (around line 534) by updating the `⏳ ` marks to `✅ Done`.

Update the "Last updated" date at the top to `2026-05-08`.

- [ ] **Step 5: Final commit**

```bash
git add MIGRATION_PROGRESS.md
git commit -m "Phase 3 prereqs: mark L4/L5/L6 complete in MIGRATION_PROGRESS"
```

- [ ] **Step 6: Verify the branch state**

Run:
```bash
git log --oneline -10
git status
```

Expected: clean working tree, recent commits cover Tasks 1–11, baseline branch unchanged from feature/RB/phase1.
