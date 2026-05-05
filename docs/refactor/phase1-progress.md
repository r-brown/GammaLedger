# Phase 1 — Migration progress

> Working state of the Vite/ESM refactor. Updated as waves complete.
> Companion to `phase1-analysis.md` and `phase1-module-map.md`.

---

## What's done

### Step 1 — Analysis ✅
Reports written to `docs/refactor/phase1-analysis.md` and `phase1-module-map.md`.

### Step 2 — Vite setup ✅
- `package.json` (`type: "module"`, dev/build/preview scripts)
- `vite.config.js` (root `.`, outDir `dist`)
- `.gitignore` extended with `node_modules/`, `dist/`, `.vite/`
- Files relocated: `index.html` → repo root, `app.js` → `src/legacy/app.js`,
  `style.css` → `src/legacy/app.css`, `gammaledger-logo-*.png` → `public/`
- `index.html` now loads `/src/legacy/app.js` as `type="module"`
- Dev server (`npm run dev`) and prod build (`npm run build`) both pass

### Step 3 — Skeleton ✅
59 empty placeholder modules created across `core/`, `utils/`, `trades/`,
`calculations/`, `ui/`, `payoff/`, `ai/`, `imports/`, `database/`,
`integrations/`, `settings/`.

### Step 4 — Migration in progress

| Wave | Status | Modules |
| --- | --- | --- |
| 1 — Pure utilities | ✅ done | `core/config.js`, `core/sample-data.js`, `utils/dates.js`, `utils/dom.js`, `utils/formatting.js`, `utils/crypto.js` |
| 2 — Storage layer | ✅ partial | `core/storage.js` (safeLocalStorage only), `utils/import-csv.js` (parseCsvRow only). `saveToStorage` / `loadFromStorage` / `exportToCSV` deferred to Wave 11 — they have heavy `this.*` deps not yet migrated |
| 3 — Trade model | ⏳ next | `trades/legs.js`, `calculations/pnl.js`, `calculations/daysheld.js`, `trades/positions.js`, `trades/wheel.js`, `trades/pmcc.js`, `trades/spreads.js`, `trades/risk.js`, `calculations/stats.js`, `calculations/monte-carlo.js` |
| 4 — Agents | ✅ done | `ai/local-agent.js`, `ai/gemini-agent.js` (whole classes moved verbatim) |
| 5 — Integrations | pending | `integrations/gemini.js`, `integrations/finnhub.js`, `integrations/mcp.js`, `settings/default-fee.js` |
| 6 — Payoff | pending | `payoff/{render,pricing,series,summary}.js` |
| 7 — Imports | pending | `imports/{position-keys,log,robinhood,ofx,merge,controls}.js` |
| 8 — UI helpers | pending | `ui/{notifications,views,filters,sidebar}.js`, `ui/modals/{disclaimer,ai-coach-consent}.js` |
| 9 — Tables and charts | pending | `ui/tables/{highlights,active-positions,assigned-positions,recent-trades,trades-table}.js`, `ui/charts/{cumulative-pl,dashboard-charts}.js`, `ui/credit-playbook/{data,render,index}.js` |
| 10 — Share card / dashboard / chat | pending | `ui/share-card.js`, `ui/dashboard.js`, `ai/chat.js` |
| 11 — Form + database | pending | `trades/leg-form.js`, `database/persist.js` |
| 12 — Entry point | pending | `src/index.js`, then dissolve `src/legacy/` |

---

## Migration pattern in use

For class methods that have `this.*` dependencies, the body moves to a module
function and the class method becomes a thin delegator:

```js
// src/utils/dates.js
export function formatDate(dateString) { /* original body */ }

// src/legacy/app.js (top of file)
import * as dates from '../utils/dates.js';

class GammaLedger {
  formatDate(dateString) { return dates.formatDate(dateString); }
}
```

This preserves every `this.formatDate(...)` call site unchanged. Namespace
imports (`import * as dates from ...`) avoid name collisions with class
methods.

For class fields (e.g. `safeLocalStorage`), the class field references the
imported binding directly:

```js
import { safeLocalStorage } from '../core/storage.js';
class GammaLedger {
  safeLocalStorage = safeLocalStorage; // class field aliases the module export
}
```

For self-contained classes like `LocalInsightsAgent` and
`GeminiInsightsAgent`, the entire class moves with `export class` and is
re-imported by name — no other call-site changes needed.

---

## Bundle size baseline

| Snapshot | JS bundle | gzipped |
| --- | --- | --- |
| Pre-refactor (after Vite wrap of monolith) | 367.00 kB | 94.92 kB |
| After Wave 1 + 2 + 4 | 367.67 kB | 95.34 kB |

Bundle has held effectively flat — the small increase is named-export
boilerplate, not duplicated code.

---

## What `src/legacy/app.js` looks like now

- ~19,099 LOC (down from 21,440)
- Imports at top: 9 module imports (config, sample-data, dates, dom, fmt,
  crypto, storage, import-csv, two AI agents)
- Single class `GammaLedger` with 360+ methods, ~30 of which are now thin
  delegators
- Bootstrap section unchanged (DOMContentLoaded, error handlers,
  beforeunload cleanup)
- The two `Insights*Agent` classes have been removed from this file

---

## Smoke testing

Verification at the end of every wave:

1. `npm run build` exits 0
2. `node -e "import('./src/legacy/app.js').then(...)"` only fails on
   `document is not defined` — i.e. modules link, code parses, all imports
   resolve
3. Vite dev server (`npm run dev`) starts and serves `/src/legacy/app.js`
   as a module bundle

True UI smoke testing per the CLAUDE.md checklist (add trade, view
dashboard, run import, etc.) has **not** been performed in this session —
it requires a real browser. Highly recommended before merging the branch.

---

## Recommended next steps

1. **Manual smoke test now** — open the dev server in a real browser and
   walk the CLAUDE.md smoke checklist. The structural changes so far
   should be invisible to the user, but verify before piling on more
   waves.
2. **Wave 3 (trade model)** is the next big chunk. Start with
   `trades/legs.js` (small, pure-ish helpers), then `calculations/pnl.js`,
   then work outward. Many trade methods reference each other via `this`,
   so the delegator pattern keeps working.
3. **Wave 5 (integrations)** can run in parallel with Wave 3 — Finnhub
   and Gemini settings are largely independent of trade math.
4. **Wave 11 (database/persist)** must come after Wave 3, because
   `loadFromStorage` calls `enrichTradeData` (Wave 3) and the dashboard
   update (Wave 10).
5. **Wave 12 (index.js)** is last. The current end-state plan is to
   *keep* `class GammaLedger` and just relocate it to `src/index.js`,
   with `src/legacy/` deleted afterward. Open question — could
   alternatively dissolve into a plain object — but keep the class for
   now to minimize Phase-1 risk.

---

## Per-commit history (this branch)

```
docs: phase 1 codebase analysis and proposed module map
build: introduce Vite, move legacy files under src/legacy
refactor: scaffold phase 1 module skeleton
refactor: extract core/config + core/sample-data modules
refactor: extract utils/{dates,dom,formatting,crypto} modules
refactor: extract core/storage + utils/import-csv
refactor: move AI agent classes to src/ai/
```
