# Phase 3 Prerequisites — L4, L5, L6

**Date:** 2026-05-08
**Scope:** Three Phase 3 entry-criteria items from `MIGRATION_PROGRESS.md`.
**Status:** Approved by user (2026-05-08) — proceeding to writing-plans.

## Goals

1. **L4** — replace the `is-hidden` class-toggle modal pattern with the native `<dialog>` element.
2. **L5** — replace `showNotification`'s `alert()`/`console.log` stub with an ARIA-compliant queued toast manager.
3. **L6** — replace the hand-rolled Markdown renderer in AI chat with `marked` + `DOMPurify`.

Each item is part of the Phase 3 (Vue 3) entry criteria — clean DOM boundaries that future Vue components can wrap without rewrites.

## Non-Goals

- No Vue 3 work.
- No changes to the trade-form `is-hidden` toggles in `src/trades/leg-form.ts` or `src/imports/controls.ts` (these are field/column visibility toggles, not modals).
- No new chart, AG Grid, or Zod surface.
- No changes to `escapeHTML` or other DOM helpers in `src/utils/dom.ts` outside the Markdown stack.

## L4 — Modals → native `<dialog>`

### Current state

| Element | File | Pattern |
|---|---|---|
| `#disclaimer-banner` | `src/ui/modals/disclaimer.ts` (134 LOC) | `<div role="dialog" aria-modal="true">` + `is-hidden`/`is-visible` class toggle, manual focus, fade timeout |
| `#ai-coach-consent` | `src/ui/modals/ai-coach-consent.ts` (227 LOC) | Same as above + manual `escapeHandler`, manual overlay `<div data-action="ai-consent-dismiss">`, manual `restoreFocus` tracking |

### Target

Convert both root elements to `<dialog>` and use the platform:

```ts
const el = document.getElementById('ai-coach-consent') as HTMLDialogElement
el.showModal()                      // backdrop, focus trap, ARIA all native
el.addEventListener('cancel', ...)  // Escape key — preventable
el.addEventListener('close', ...)   // any close path — terminal
```

### Changes — `index.html`

- `<div id="disclaimer-banner" class="disclaimer-banner is-hidden" role="dialog" aria-modal="true" ...>` → `<dialog id="disclaimer-banner" class="disclaimer-banner" aria-labelledby="disclaimer-title">`
- `<div id="ai-coach-consent" class="ai-consent-modal is-hidden" role="dialog" aria-modal="true" ...>` → `<dialog id="ai-coach-consent" class="ai-consent-modal" aria-labelledby="ai-consent-title" aria-describedby="ai-consent-description">`
- Remove `<div class="ai-consent-modal__overlay" data-action="ai-consent-dismiss"></div>` (replaced by `::backdrop` + a `click`-on-backdrop dismiss handler that detects clicks outside `__panel`).
- Drop `aria-hidden` and `aria-modal` attrs (the `<dialog>` element provides them implicitly when opened via `showModal()`).

### Changes — CSS (`src/styles/app.css`)

- Drop `.is-hidden { display: none }` for `.disclaimer-banner` and `.ai-consent-modal` — `<dialog>` is hidden by default; `dialog[open]` makes it visible.
- Replace flex centering on the outer element with `dialog`-friendly equivalents (margin: auto on the dialog, panel inside).
- Move backdrop blur/colour from the outer element to `dialog::backdrop` with the same gradient/blur tokens.
- Keep panel transform/opacity transitions, keyed off `dialog[open]` and a small JS toggle of an `is-visible` class added on the next animation frame after `showModal()` — same fade-in behaviour as today.
- Remove `.ai-consent-modal__overlay` rules (element gone).

### Changes — TypeScript modules

`src/ui/modals/disclaimer.ts`:
- Remove `body` field and `hideTimeoutId` field from `DisclaimerBannerState`. (CSS `transitionend` or short `setTimeout` retained only for the `is-visible` class strip.)
- `showDisclaimerBanner()` → `element.showModal()` then `requestAnimationFrame(() => element.classList.add('is-visible'))`.
- `hideDisclaimerBanner({ immediate })` → `element.classList.remove('is-visible')`; on transitionend (or immediate) → `element.close()`.
- Keep `acceptDisclaimer`, storage helpers, init wiring.

`src/ui/modals/ai-coach-consent.ts`:
- Drop `escapeHandler`, `restoreFocus` from state (native).
- Drop `dismissButtons[0]`/overlay handler for the deleted overlay div; keep close-button and Cancel-button dismiss handlers.
- Add a single `cancel` listener that calls `cancelAICoachConsent()` (preserves the existing user flow when Escape is pressed).
- Add a `click` listener on the dialog itself that dismisses if `event.target === element` (i.e., user clicked outside the panel onto the backdrop area).
- `showAICoachConsent()` → `element.showModal()` + `is-visible` raf toggle, set focus on panel (still useful for screen-reader announcement timing).
- `hideAICoachConsent({ immediate })` → strip `is-visible`, then `element.close()` (immediate or after transition).

`src/index.ts`:
- Drop `escapeHandler: null` and `restoreFocus: null` lines from `aiCoachConsent` initial state.
- Drop `body: null` and `hideTimeoutId: null` lines from `disclaimerBanner` initial state.

### Public API

No call-site changes — `showAICoachConsent()`, `promptAICoachConsent()`, `hideAICoachConsent()`, `showDisclaimerBanner()`, `hideDisclaimerBanner()` keep their signatures.

## L5 — Toast queue with ARIA

### Decision: vanilla manager, no library

Sonner is React-only; the project is mid-migration and not yet on Vue. A small in-tree manager is the right call: zero new deps, fits the existing CSS token system, ARIA-compliant, and a clean target for Vue 3 to wrap later.

### Target shape

`src/ui/notifications.ts`:

```ts
interface ToastOptions {
  duration?: number      // ms; default 4000 for info/success/warning, 8000 for error
  closable?: boolean     // default true
}

export function showNotification(message: string, type: ToastVariant = 'info', opts?: ToastOptions): void
```

`ToastVariant = 'info' | 'success' | 'warning' | 'error'` — already in `src/types/common.ts`.

### Behaviour

- One persistent `<div id="toast-region" class="toast-region" aria-live="polite" aria-atomic="false">` mounted in `index.html`.
- Each toast: `<div class="toast toast--{variant}" role="status">` for non-error; `role="alert"` and `aria-live="assertive"` for `error`.
- Max 3 visible toasts; further calls queue (FIFO). When a visible toast dismisses, the next queued toast mounts.
- Auto-dismiss after `duration`; cleared on hover/focus, restarted on leave/blur (best-practice keep-open behaviour).
- Close button (×) per toast, rendered when `closable !== false`.
- CSS slide/fade in/out via `transition`, respecting `prefers-reduced-motion`.
- Module-private state (queue + visible map) lives in the module — exception to the "no module-level mutable state" rule, justified because it represents UI infrastructure not user data, and the equivalent pattern exists in chart/dashboard modules.

### Wiring

- Add `<div id="toast-region" class="toast-region"></div>` to `index.html`, near the end of `<body>`, before `<script>`.
- Add `.toast-region`, `.toast`, `.toast--info|success|warning|error` styles in `src/styles/app.css` using existing tokens. Position: `position: fixed; top: var(--space-16); right: var(--space-16); z-index: 4000;` so it sits above modals.
- `src/index.ts` `showNotification` delegator unchanged.
- Remove the `alert()` branch — no native dialogs.

### Backward compatibility

All ~30 call sites use `showNotification(message, type)` and pass one of the four variants — no source changes required outside `notifications.ts`. The third `opts` argument is additive.

## L6 — `marked` + `DOMPurify`

### Dependencies

```
npm install marked dompurify
npm install --save-dev @types/dompurify
```

(`marked` ships its own types since v5.)

### Changes — `src/utils/dom.ts`

Replace lines ~106–300 (the five Markdown helpers) with one function:

```ts
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({
  gfm: true,
  breaks: false,
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'a',
]
const ALLOWED_ATTR = ['href']

export function renderMarkdownToHTML(markdown = ''): string {
  if (!markdown) return ''
  const raw = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS, ALLOWED_ATTR })
}
```

Drop: `renderMarkdownTextSegment`, `formatMarkdownInline`, `applyBasicInlineFormatting`, `sanitizeMarkdownUrl`. Keep: `escapeHTML` (used elsewhere).

### Changes — `src/index.ts`

Drop the now-unused delegators:
- `renderMarkdownTextSegment(...)`
- `formatMarkdownInline(...)`

Keep `renderMarkdownToHTML(...)` — it is the only one used by `src/ai/chat.ts:382`.

### Loss-of-feature audit

The custom renderer produced `<h3>` for `#`, `<h4>` for `##`, `<h5>` for `###` (off-by-two heading shift). `marked` produces `<h1>` / `<h2>` / `<h3>`. The AI chat bubble already scopes `.ai-chat__*` styles, but `<h1>`/`<h2>` may render larger than intended. **Mitigation**: scope new `.ai-chat__bubble h1`, `.ai-chat__bubble h2` styles to match the previous visual weight, or use `marked` headings hook to shift levels. The plan picks the styling approach (smaller delta).

The custom renderer added classes (`ai-chat__code`, `ai-chat__quote`, `ai-chat__rule`) to `<pre>`, `<blockquote>`, `<hr>`. **Mitigation**: update `src/styles/app.css` to scope the same rules via `.ai-chat__bubble pre`, `.ai-chat__bubble blockquote`, `.ai-chat__bubble hr` selectors instead of relying on the deleted classes.

The custom inline link sanitizer rejected non-http/https URLs and bare `#anchor`. **Mitigation**: DOMPurify default URL policy already blocks `javascript:` and other dangerous schemes; the `afterSanitizeAttributes` hook forces `rel="noopener noreferrer"` and `target="_blank"`.

### Bundle impact

Approximately +45 kB min+gz for `marked` + `DOMPurify`. Removes ~200 LOC from `src/utils/dom.ts`. Net: small bundle increase, much smaller maintenance surface, CommonMark/GFM compliance.

## Cross-cutting verification

After each item:

1. `npm run typecheck` — 0 errors.
2. `npm run typecheck:strict` — 0 errors.
3. `npm run build` — clean.
4. Manual smoke (in `npm run preview`):
   - L4: trigger disclaimer (clear `localStorage`); trigger AI consent (try AI Coach with no consent); Escape closes consent; backdrop click closes consent; `Agree` persists acceptance.
   - L5: trigger save success, save error, import success — three toasts queue, ARIA inspected via DevTools.
   - L6: paste markdown into AI chat with bold/italic/lists/code/links/headings; verify rendering.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `<dialog>` polyfill needed for older browsers | CLAUDE.md states "Chrome, Edge, Firefox modern" — all support `<dialog>` natively since ~2022. |
| `marked` async API by default | Use `{ async: false }` and cast to `string`; we don't need streaming. |
| DOMPurify ESM import path | `import DOMPurify from 'dompurify'` works with Vite; no SSR. |
| Heading-level visual regression in AI chat | Add scoped `.ai-chat__bubble h1/h2/h3` rules in CSS. |
| Toast container z-index conflict with modals | `.toast-region` `z-index: 4000` — above the modal `z-index: 3200`. |
| Existing `is-hidden` rules used for non-modal elements | Keep the global `.is-hidden { display: none }` rule; only remove the modal-scoped variants. |

## Sequencing

The three items are independent, so order is by isolation:

1. **L6 first** — narrowest blast radius (one helper file + chat bubble + small CSS scoping).
2. **L4 second** — touches HTML + CSS + two modal modules.
3. **L5 last** — adds new region + new CSS, touches every existing toast call site implicitly via shared API.

## Out-of-scope follow-ups

- Vue 3 wrappers for dialog and toast — deferred to Phase 3 proper.
- Streaming markdown render for AI responses — deferred; current render is one-shot per message.
- Replacing `AllCommunityModule` with smaller AG Grid module set — separate L3 follow-up.
