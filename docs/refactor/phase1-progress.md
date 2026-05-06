# Phase 1 — Migration progress

> Working state of the Vite/ESM refactor. Updated as waves complete.
> Companion to `phase1-analysis.md` and `phase1-module-map.md`.

---

## What's done

### Step 1 — Analysis ✅
Reports written to `docs/refactor/phase1-analysis.md` and `phase1-module-map.md`.

### Step 2 — Vite setup ✅
- `package.json` (`type: "module"`, dev/build/preview scripts)
- `vite.config.ts` (root `.`, outDir `dist`, `@` path aliases, `vite-plugin-checker`)
- `.gitignore` extended with `node_modules/`, `dist/`, `.vite/`
- Files relocated: `index.html` → repo root, `app.js` → `src/legacy/app.js` (now `src/index.js`),
  `style.css` → `src/legacy/app.css` (now `src/styles/app.css`), `gammaledger-logo-*.png` → `public/`
- `index.html` loads `/src/index.js` as `type="module"` and `/src/styles/app.css`
- Dev server (`npm run dev`) and prod build (`npm run build`) both pass

### Step 3 — Skeleton ✅
59 empty placeholder modules created across `core/`, `utils/`, `trades/`,
`calculations/`, `ui/`, `payoff/`, `ai/`, `imports/`, `database/`,
`integrations/`, `settings/`.

### Step 4 — Migration ✅ **COMPLETE**

| Wave | Status | Modules |
| --- | --- | --- |
| 1 — Pure utilities | ✅ done | `core/config.js`, `core/sample-data.js`, `utils/dates.js`, `utils/dom.js`, `utils/formatting.js`, `utils/crypto.js` |
| 2 — Storage layer | ✅ done | `core/storage.js` (safeLocalStorage), `utils/import-csv.js` (parseCsvRow) |
| 3 — Trade model | ✅ done | `trades/legs.js`, `calculations/pnl.js`, `calculations/daysheld.js`, `trades/positions.js`, `trades/wheel.js`, `trades/pmcc.js`, `trades/spreads.js`, `trades/risk.js`, `calculations/stats.js`, `calculations/monte-carlo.js` |
| 4 — Agents | ✅ done | `ai/local-agent.js`, `ai/gemini-agent.js` (whole classes moved verbatim) |
| 5 — Integrations | ✅ done | `integrations/gemini.js`, `integrations/finnhub.js`, `integrations/mcp.js`, `settings/default-fee.js` |
| 6 — Payoff | ✅ done | `payoff/series.js`, `payoff/pricing.js`, `payoff/summary.js`, `payoff/render.js` |
| 7 — Imports | ✅ done | `imports/position-keys.js`, `imports/log.js`, `imports/robinhood.js`, `imports/ofx.js`, `imports/merge.js`, `imports/controls.js` |
| 8 — UI helpers | ✅ done | `ui/notifications.js`, `ui/sidebar.js`, `ui/filters.js`, `ui/modals/disclaimer.js`, `ui/modals/ai-coach-consent.js` |
| 9 — Tables and charts | ✅ done | `ui/tables/highlights.js`, `ui/tables/active-positions.js`, `ui/tables/assigned-positions.js`, `ui/tables/recent-trades.js`, `ui/tables/trades-table.js`, `ui/charts/cumulative-pl.js`, `ui/charts/dashboard-charts.js`, `ui/credit-playbook/data.js`, `ui/credit-playbook/render.js`, `ui/credit-playbook/index.js` |
| 10 — Share card / dashboard / chat | ✅ done | `ui/share-card.js`, `ui/dashboard.js`, `ai/chat.js` |
| 11 — Form + database | ✅ done | `trades/leg-form.js`, `database/persist.js` |
| 12 — Entry point | ✅ done | `src/legacy/app.js` → `src/index.js`, `src/legacy/app.css` → `src/styles/app.css`, `src/legacy/` deleted, `src/utils/export.js` converted to re-export shim |

---

## Migration results

| Metric | Before | After |
| --- | --- | --- |
| `src/legacy/app.js` lines | 18,546 | **deleted** (promoted to `src/index.js`) |
| `src/index.js` lines | 2 (placeholder) | 2,912 |
| Vite modules transformed | 1 | 60 |
| Bundle size (JS) | 367 kB | 381 kB |
| Bundle size (gzip) | 94.9 kB | 99.5 kB |
| TypeScript errors | — | 0 |
| `src/legacy/` directory | exists | **deleted** |

Small bundle increase (~4%) is expected — module boilerplate, no duplicated logic.

## Migration pattern in use

For class methods that have `this.*` dependencies, the body moves to a module
function and the class method becomes a thin delegator:

```js
// src/utils/dates.js
export function formatDate(dateString) { /* original body */ }

// src/index.js (top of file)
import * as dates from './utils/dates.js';

class GammaLedger {
  formatDate(dateString) { return dates.formatDate(dateString); }
}
```

For destructured option params, the delegator normalises to a plain `options` object:

```js
// class method (delegator)
refreshAssignedPositionsQuotes(options = {}) {
  return finnhubModule.refreshAssignedPositionsQuotes.call(this, options);
}
// module function (full implementation, destructures internally)
export function refreshAssignedPositionsQuotes({ force = false, immediate = false } = {}) { ... }
```

---

## What `src/index.js` looks like now

- 2,912 LOC (promoted from `src/legacy/app.js` with import paths adjusted)
- Imports at top: 36 module imports
- Single class `GammaLedger` with ~400 methods, almost all thin delegators
- `constructor()` and `bindEvents()` remain full implementations (highly stateful)
- Bootstrap section: `DOMContentLoaded`, global error handlers, `beforeunload`
- `src/utils/export.js` is now a re-export shim pointing to `database/persist.js`

---

## Notable deviations from the original module map

- `utils/export.js` — planned for `exportToCSV` etc., but those landed in
  `database/persist.js` during Wave 11. `utils/export.js` is now a re-export shim.
- `vite.config.ts` — already converted to TypeScript as part of Phase 2 tooling setup
  (committed earlier); listed in phase1 plan as a JS file.

---

## Module extraction scripts

Automated scripts under `scripts/` were used for bulk extraction:
- `wire-modules.mjs` — wires risk.js and spreads.js delegates
- `extract-wave5.mjs` — Wave 5 integrations
- `extract-wave6-7.mjs` — Waves 6-7 payoff and imports
- `extract-wave8-11.mjs` — Waves 8-11 UI, charts, database
- `extract-remaining.mjs` — final UI tables and stats
- `extract-final.mjs` — multi-line sig fixes and remaining helpers

---

## Smoke testing

Run after every module conversion:

1. `npm run build` exits 0 ✅
2. Dev server (`npm run dev`) starts and serves correctly — HTTP 200 ✅
3. 60 ES modules resolved and bundled ✅
4. `npm run typecheck` exits with 0 errors ✅

True UI smoke testing (add trade, view dashboard, run import, etc.) should be
performed in a real browser before merging — requires DOM interaction.

---

## Recommended next steps

1. **Browser smoke test** — open `npm run dev` and walk the CLAUDE.md checklist
2. **Phase 2** — TypeScript migration per CLAUDE.md Phase 2 instructions
