# GammaLedger — Refactor Progress

> Single reference document covering all completed work, in-progress state, and open todos.
> Consolidates: `phase1-analysis.md`, `phase1-module-map.md`, `phase1-progress.md`,
> `phase2-analysis.md`, `phase2-domain-objects.md`, `phase2-migrations.md`,
> `phase2-summary.md`, and `tech-stack.md`.
>
> Last updated: 2026-05-08 — Phase 3 prerequisites L4/L5/L6 complete

---

## Quick Status

| Phase | Goal | Status |
|---|---|---|
| **Phase 1** | JS module migration (21K-line monolith → 60 ES modules, Vite) | ✅ Complete |
| **Phase 2** | TypeScript migration (type safety across all modules) | ✅ Complete — M1/M2/M3 resolved |
| **Phase 3** | Vue 3 component migration | ⏳ Not started |

---

## Phase 1 — ES Module Migration

### Starting point

`src/app.js` was a **21,440-line monolith** with:
- 3 classes: `GammaLedger` (~360 methods), `LocalInsightsAgent` (12 methods), `GeminiInsightsAgent` (16 methods)
- ~462 total methods; ~160 `this.*` state properties on `GammaLedger`
- All state on `this` — no module system, no bundler, no transpilation
- 1 remaining CDN library: html2canvas; charts now use npm-managed Apache ECharts
- 119 distinct `getElementById` IDs, 94 `addEventListener` calls, 0 inline HTML handlers
- 11 localStorage keys (+4 legacy migration keys)
- 6 top-level views: `dashboard`, `add-trade`, `trades-list`, `credit-playbook`, `import`, `settings`

### Goal

Split into ~60 ES modules under `src/`, build with **Vite**, keep `localStorage` data
intact, preserve all observable behavior. No logic changes; pure relocation.

### Key analysis findings (pre-migration)

1. **`this`-coupling is pervasive** — almost every method references `this.trades`, `this.charts`,
   etc. Pure functions need state passed in; `class GammaLedger` remains as the orchestrator.
2. **Two localStorage access styles** — direct `localStorage.*` (28 sites) vs. `safeLocalStorage`
   wrapper (6 sites, Gemini config only). Unified through `core/storage.ts`.
3. **`enrichTradeData` is ~280 lines** pulling from leg model, lifecycle, formatters, and dates.
   Kept intact in `trades/positions.ts`.
4. **`bindEvents` (lines 6120–6307) is the central wiring hub** — references DOM IDs from every
   feature area. Kept cohesive; each feature module exports `init*()`, wired from `index.ts`.
5. **AI agent classes are already self-contained** — trivial first extraction wins.
6. **`BUILTIN_SAMPLE_DATA` is 1,200 lines of static data** — moved to `core/sample-data.ts`.
7. **No circular dependencies** in the monolith — preserved by keeping `state.ts` lowest.
8. **Credit Playbook data extractors** (`extractSpreadPair`, etc.) genuinely belong in
   `trades/spreads.ts`; the filter/render UI stays under `ui/credit-playbook/`.
9. **`payoff/` earns its own directory** — ~1,300 LOC of strategy-specific payoff math + ECharts,
   not generic chart code.

### Module structure

```
src/
  index.ts                   ← entry point: GammaLedger class (thin delegators) + bootstrap
  core/                      config, migration, sample-data, state, storage
  utils/                     crypto, dates, dom, export (re-export shim), formatting, import-csv
  trades/                    leg-form, legs, pmcc, positions, risk, spreads, wheel
  calculations/              daysheld, monte-carlo, pnl, stats
  ui/
    tables/                  active-positions, assigned-positions, highlights, recent-trades, trades-table
    charts/                  cumulative-pl, dashboard-charts, destroy, echarts
    modals/                  ai-coach-consent, disclaimer
    credit-playbook/         data, index, render
    dashboard, filters, notifications, share-card, sidebar, views
  payoff/                    pricing, render, series, summary
  ai/                        chat, gemini-agent, local-agent
  imports/                   controls, log, merge, ofx, position-keys, robinhood
  database/                  persist
  integrations/              finnhub, gemini, mcp
  settings/                  default-fee
  types/                     (Phase 2 — 17 type files, re-exported via @types-gl)
  styles/                    app.css
```

**Key module ownership:**

| Module | State owned | Key dependencies |
|---|---|---|
| `core/config.ts` | `APP_CONFIG` and all derived constants | — |
| `core/storage.ts` | `safeLocalStorage`; legacy migration | `core/config.ts` |
| `calculations/pnl.ts` | — | `trades/legs.ts` |
| `calculations/stats.ts` | `latestStats` | `calculations/pnl.ts`, `trades/positions.ts` |
| `trades/positions.ts` | `currentEditingId`, `currentSort` | `trades/legs.ts`, `calculations/*`, `utils/*` |
| `integrations/finnhub.ts` | `finnhub` struct, quote refresh | `core/storage.ts`, `utils/crypto.ts` |
| `integrations/gemini.ts` | `gemini` struct | `core/storage.ts`, `utils/crypto.ts` |
| `database/persist.ts` | `currentFileHandle`, `hasUnsavedChanges` | `core/storage.ts`, `core/sample-data.ts` |
| `ui/dashboard.ts` | orchestrator | `calculations/stats.ts`, all charts, all tables |
| `ai/chat.ts` | `aiChatMessages`, session | `ai/local-agent.ts`, `ai/gemini-agent.ts` |

### Migration sequence (12 waves, 57 steps)

| Wave | Modules | Status |
|---|---|---|
| 1 — Pure utilities | `core/config`, `core/sample-data`, `utils/dates`, `utils/dom`, `utils/formatting`, `utils/crypto` | ✅ |
| 2 — Storage layer | `core/storage`, `utils/import-csv` | ✅ |
| 3 — Trade model | `trades/legs`, `calculations/pnl`, `calculations/daysheld`, `trades/positions`, `trades/wheel`, `trades/pmcc`, `trades/spreads`, `trades/risk`, `calculations/stats`, `calculations/monte-carlo` | ✅ |
| 4 — Agents | `ai/local-agent`, `ai/gemini-agent` | ✅ |
| 5 — Integrations | `integrations/gemini`, `integrations/finnhub`, `integrations/mcp`, `settings/default-fee` | ✅ |
| 6 — Payoff | `payoff/series`, `payoff/pricing`, `payoff/summary`, `payoff/render` | ✅ |
| 7 — Imports | `imports/position-keys`, `imports/log`, `imports/robinhood`, `imports/ofx`, `imports/merge`, `imports/controls` | ✅ |
| 8 — UI helpers | `ui/notifications`, `ui/sidebar`, `ui/filters`, `ui/modals/disclaimer`, `ui/modals/ai-coach-consent` | ✅ |
| 9 — Tables + charts | `ui/tables/*`, `ui/charts/*`, `ui/credit-playbook/*` | ✅ |
| 10 — Share card / dashboard / chat | `ui/share-card`, `ui/dashboard`, `ai/chat` | ✅ |
| 11 — Form + database | `trades/leg-form`, `database/persist` | ✅ |
| 12 — Entry point | `src/index.ts` promoted; `src/legacy/` deleted; `utils/export.ts` as re-export shim | ✅ |

**Migration pattern for `this`-coupled methods:**

```ts
// src/utils/dates.ts
export function formatDate(dateString: string): string { /* body */ }

// src/index.ts — thin delegator stays on the class
import * as dates from './utils/dates.ts'
class GammaLedger {
  formatDate(dateString: string) { return dates.formatDate(dateString) }
}
```

### Phase 1 results

| Metric | Before | After |
|---|---|---|
| Monolith LOC | 21,440 | **deleted** |
| `src/index.ts` LOC | 2 | 1,711 (post-Phase 2 parity review) |
| ES modules | 1 | 60 |
| JS bundle (uncompressed) | 367 kB | 374.59 kB (+2%) |
| JS bundle (gzip) | 94.9 kB | 96.89 kB (+2%) |
| TypeScript errors | — | 0 |

Post-Phase 1 parity review also moved remaining function bodies out of `src/index.ts`
into their owner modules (see Phase 2 Step 8 below).

---

## Phase 2 — TypeScript Migration

### Goal

Add TypeScript for type safety without changing business logic. Priority: financial
calculation and data-model layers. JS/TS coexist throughout; app must work after every step.

### Pre-migration analysis — key findings

The following risks were identified across all source files before any TypeScript work:

**Financial value type leaks**
- `normalizeLeg` coerces every numeric field with double `Number()` calls; silent-zero
  fallback for `premium`/`fees` makes corrupt import rows indistinguishable from real zeros.
- `Number(x) || 0` pattern across `summarizeLegs` silently promotes missing data to zero;
  the `multiplier || 1` variant also masks zero-multiplier bugs.
- `parseFloat(x.toFixed(2))` in P&L calculations introduces a locale-fragile string round-trip
  (safe today; documented risk).

**Date type inconsistencies**
- Trade-level: `openedDate`/`closedDate` are canonical ISO strings; legacy keys `entryDate`/
  `exitDate` are inbound aliases normalized before persistence.
- Timestamps differ: `exportDate` (string) vs. `timestamp` (Unix ms number in legacy).
  `migrateSchema` normalizes on load.

**Untyped object shapes**
- `loadFromStorage` had no per-field validation — malformed import data could corrupt the DB
  on next save. Fixed by `migrateSchema()` + `parseStorageSchema()`.
- 25 distinct domain object shapes passed as plain objects between modules.
- 13 magic-string enum concepts identified and typed in `src/types/common.ts`.

**Storage schema**
- Live persisted version is the string literal `'2.5'` (not numeric).
- `RUNTIME_TRADE_FIELDS` strips 46 transient fields before save; `RUNTIME_LEG_FIELDS` strips 2.
- `tradeReasoning` is a legacy alias normalized into `notes` on load.
- `externalId`, `importGroupId`, `importSource` are persisted on legs when present.

### Step-by-step completion

| Step | Description | Status |
|---|---|---|
| 1 | Pre-migration analysis (`phase2-analysis.md`, `phase2-domain-objects.md`) | ✅ |
| 2 | TypeScript tooling: `tsc`, `vite-plugin-checker`, `tsconfig.json`, path aliases | ✅ |
| 3 | Domain type library (`src/types/` — 17 files) | ✅ |
| 4A | Phase A conversions: `utils/*`, `core/*` | ✅ |
| 4B | Phase B conversions: `calculations/*` | ✅ |
| 4C | Phase C conversions: `trades/*` | ✅ |
| 4D | Phase D conversions: all `ui/*`, `ai/*`, `settings/*` | ✅ |
| 4E | Phase E conversions: `imports/*`, `database/*`, `integrations/*`, `payoff/*` | ✅ |
| 4F | Phase F conversion: `src/index.ts` | ✅ |
| 5 | Strict mode per directory (5 subproject configs) | ✅ |
| 6 | `localStorage` migration guard (`src/core/migration.ts`) | ✅ |
| 7 | Production build validation | ✅ |
| 8 | Phase 2 summary + post-parity review (function bodies moved to owner modules) | ✅ |
| 9 | M1 — strict configs wired for `imports/`, `integrations/`, `payoff/` | ✅ |
| 10 | M2 — Gemini response types + runtime guards (`src/types/integrations.ts`) | ✅ |
| 11 | M3 — `RiskValue` tagged union + `toRiskValue` + `EnrichedTrade.riskValue` | ✅ |

### Type library (`src/types/`)

| File | Types defined |
|---|---|
| `common.ts` | `ISODateString`, `DollarAmount`, `ContractCount`, `StrikePrice`, `OptionType`, `OrderType`, `LegType`, `LegAction`, `LegSide`, `TradeDirection`, `LifecycleStatus`, `StrategyType`, `WheelCoverage`, `CumulativePLRange`, `ToastVariant`, `QuoteState`, `UnderlyingType`, **`RiskValue` (M3)** |
| `leg.ts` | `PersistedLeg`, `NormalizedLeg` |
| `trade.ts` | `Trade` (persisted), `EnrichedTrade` (runtime) — **includes `riskValue: RiskValue` (M3)** |
| `leg-summary.ts` | `LegSummary` (31 fields), `VerticalSpreadShape` |
| `lifecycle.ts` | `LegLifecycleResult`, `LifecycleMeta`, `ExitReason` |
| `stats.ts` | `Stats`, `TickerPerformance`, `TickerPerformanceItem`, `AssignmentStats`, `AssignmentRecord` |
| `storage.ts` | `StorageSchema`, `MCPContext`, `StoragePlRange` |
| `state.ts` | `AppState`, `CurrentSort`, `FinnhubState`, `GeminiState`, `ShareCardState`, `ShareCardMetrics`, `AIChatState`, `ImportState` |
| `ui.ts` | `FilterState`, `ToastOptions`, `QuoteEntry`, `PositionHighlightConfig`, `StatusMessage` |
| `integrations.ts` | `FinnhubQuote`, `GeminiState`, **`GeminiApiPart`, `GeminiApiContent`, `GeminiApiCandidate`, `GeminiPromptFeedback`, `GeminiApiError`, `GeminiApiResponse`, `isGeminiApiResponse()`, `isGeminiApiCandidate()`, `extractGeminiText()`, `extractGeminiError()` (M2)** |
| `wheel.ts` | `WheelCoverage`, `PMCCLegs` |
| `spreads.ts` | `SpreadPair`, `SpreadPairVariant` |
| `credit-playbook.ts` | `CreditPlaybookEntry`, `CreditPlaybookFilters`, `CreditPlaybookSort` |
| `imports.ts` | `RobinhoodImportPayload`, `OFXImportPayload`, `RobinhoodTransaction`, `OFXTransaction`, `OFXSecurity`, `ImportSummary`, `ImportError`, `ImportLogEntry`, `ImportStats` |
| `mcp.ts` | `MCPTrade`, `MCPAssignment`, `MCPBuildContext` |
| `ai.ts` | `AIAgentContext`, `Message`, `MessageRole`, `AIChatSession` |
| `index.ts` | Re-exports all of the above via `@types-gl` |

Key modeling decisions:
- `StorageSchema.version` is the string literal `'2.5'` via `CURRENT_STORAGE_VERSION`.
- `Trade` (persisted) and `EnrichedTrade` (runtime) are distinct — no runtime fields leak to storage.
- Dynamic/external surfaces use `unknown` and `Record<string, unknown>`; no `any`.

### Module conversions — notable fixes by area

| Area | Key fix pattern applied |
|---|---|
| `imports/*` | `Record<string, unknown>` for options bags; `HTMLInputElement | null` DOM casts; `Set<number>()` explicit generic |
| `database/persist.ts` | Typed persistence context; `(ev.target as FileReader).result` |
| `integrations/mcp.ts` | `plByRange: Record<string, number | null> = {}`; `(b.totalPL as number)` cast |
| `integrations/gemini.ts` | `HTMLInputElement | HTMLSelectElement | null`; `String(DEFAULT_GEMINI_MAX_TOKENS)` for `.value` |
| `integrations/finnhub.ts` | `HTMLInputElement | null`; typed options for `populateQuoteCell` |
| `payoff/*` | `trade: Record<string, unknown>` parameter; `canvas as HTMLCanvasElement | null` |
| `src/index.ts` | `ConstructorParameters<typeof GeminiInsightsAgent>[0]`; added missing `container` variable; `declare currentFileHandle: FileSystemFileHandle \| null` |
| Runtime fix (Step 7) | `ui/modals/ai-coach-consent.ts`, `ui/modals/disclaimer.ts`, `ui/sidebar.ts`, `ui/share-card.ts` — replaced host-scope `declare const` shims with real `@core/config` imports |

### Post-Step 8 parity review

Function bodies moved out of `src/index.ts` into their owner modules:

- `src/ai/chat.ts`: `handleAIChatSubmit()`, `handleAIQuickPrompt()`
- `src/trades/leg-form.ts`: `autoFillUnderlyingPrice()`, `autoFillUnderlyingPricesForLegs()`
- `src/ui/share-card.ts`: `waitForShareCardChartRender()`, `downloadShareCard()`
- `src/integrations/finnhub.ts`: `getCurrentPrice()`, `performFinnhubFetch()`, `enforceFinnhubRateLimit()`, `loadFinnhubConfigFromStorage()`, `ensureFinnhubEncryptionKey()`, `encryptAndStoreFinnhubApiKey()`
- `src/integrations/gemini.ts`: `loadGeminiConfigFromStorage()`, `ensureGeminiEncryptionKey()`, `encryptAndStoreGeminiApiKey()`
- `src/payoff/render.ts`: `renderTradePayoffChart()`
- `src/payoff/pricing.ts`: `getUnderlyingPriceForPayoff()`
- `src/database/persist.ts`: `saveDatabase()`, `saveWithFileSystemAPI()`, `loadDatabase()`, `loadWithFileSystemAPI()`, `loadFromStorage()`
- `src/imports/controls.ts`: OFX and Robinhood file import wrappers
- Fixed payoff regression: `calculateSpreadBreakeven()` now forwards its argument object to the extracted payoff helper

### Strict mode coverage

Root `tsconfig.json` remains `strict: false` (backward-compatibility layer).
Eight strict subprojects enforced via `npm run typecheck:strict`:

| Directory | Status | Key strict fix |
|---|---|---|
| `src/calculations/` | ✅ `strict: true`, clean | Nullable Date guard in `stats.ts` |
| `src/core/` | ✅ `strict: true`, clean | Typed date helpers in `sample-data.ts` |
| `src/trades/` | ✅ `strict: true`, clean | `typeof currentStrike === 'number'` guard in `spreads.ts` |
| `src/utils/` | ✅ `strict: true`, clean | Typed persistence context for `export.ts` re-export |
| `src/ui/` | ✅ `strict: true`, clean | DOM element narrowing throughout |
| `src/imports/` | ✅ `strict: true`, clean | M1 — `Record<string, unknown>` options bags |
| `src/integrations/` | ✅ `strict: true`, clean | M1 — `HTMLInputElement \| HTMLSelectElement \| null` casts |
| `src/payoff/` | ✅ `strict: true`, clean | M1 — `canvas as HTMLCanvasElement \| null` |

### localStorage migration guard (`src/core/migration.ts`)

`parseStorageSchema()` migrates legacy shapes, validates the Zod storage payload, and is called by
localStorage load/save paths plus user JSON imports:

| Rule | Behavior |
|---|---|
| Non-object input | Returns `emptySchema()` |
| Legacy array payload | Wraps as `{ version: 0, trades: raw }` |
| Missing/non-array `trades` | Becomes `[]` |
| Non-object trade entry | Discarded |
| Missing/blank trade `id` | Becomes `legacy-${index}` |
| Missing/blank leg `id` | Becomes `legacy-${tradeIndex}-leg-${legIndex}` |
| Missing `exportDate` | Filled from legacy `timestamp` or current time |
| Non-current `version` | Rewritten to `'2.5'` |

### Production build validation (2026-05-06)

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | Clean |
| `npm run preview` | Served at `http://127.0.0.1:4173/` |
| Browser console | 0 warnings/errors on dashboard and reload paths |
| Realized P&L (sample data) | `$3,089.75` — stable across reload |
| Active Positions | `7` — stable across reload |
| Dashboard canvases | 8 rendered |

Final bundle metrics:

| Metric | Phase 1 baseline | Phase 2 final |
|---|---:|---:|
| JS bundle | 381 kB | 374.59 kB |
| JS bundle gzip | 99.5 kB | 96.89 kB |
| CSS bundle | — | 86.64 kB / 13.92 kB gzip |
| Modules transformed | 60 | 58 |
| `.js` files in `src/` | many | **0** |
| TypeScript `any` usages | — | **0** |
| `@ts-ignore` usages | — | **0** |

---

## File Inventory

### Source modules (all TypeScript — 0 `.js` files in `src/`)

```
src/
  index.ts                   (1,711 lines — post-parity review)
  types/     17 type files   re-exported via @types-gl
  core/       5 files        config, migration, sample-data, state, storage
  utils/      6 files        crypto, dates, dom, export, formatting, import-csv
  calculations/ 4 files      daysheld, monte-carlo, pnl, stats
  trades/     7 files        leg-form, legs, pmcc, positions, risk, spreads, wheel
  ai/         3 files        chat, gemini-agent, local-agent
  settings/   1 file         default-fee
  ui/        19 files        notifications, sidebar, filters, dashboard, share-card, views,
                             modals/ai-coach-consent, modals/disclaimer,
                             tables/active-positions, tables/assigned-positions,
                             tables/highlights, tables/recent-trades, tables/trades-table,
                             charts/cumulative-pl, charts/dashboard-charts, charts/destroy,
                             credit-playbook/data, credit-playbook/index, credit-playbook/render
  imports/    6 files        controls, log, merge, ofx, position-keys, robinhood
  database/   1 file         persist
  integrations/ 3 files      finnhub, gemini, mcp
  payoff/     4 files        pricing, render, series, summary
  styles/                    app.css
```

### Strict subproject configs

```
src/calculations/tsconfig.json
src/core/tsconfig.json
src/trades/tsconfig.json
src/utils/tsconfig.json
src/ui/tsconfig.json
src/imports/tsconfig.json       ← M1
src/integrations/tsconfig.json  ← M1
src/payoff/tsconfig.json        ← M1
```

---

## Open Points

### 🔴 High priority — none

No blocking issues.

---

### 🟡 Medium priority

No blocking issues.

---

### 🟢 Low priority — Phase 3 prerequisites

**L1 — Chart.js loaded via unversioned CDN** *(Priority 1 — ✅ Complete)*
Replaced the unversioned Chart.js CDN dependency with npm-managed Apache ECharts
(`echarts@6.0.0`). Runtime chart hosts now use ECharts DOM roots, a tree-shaken
registry in `src/ui/charts/echarts.ts`, and `chart.setOption()` updates instead of
destroy/recreate on every render.

| | Chart.js (removed) | ECharts (current) |
|---|---|---|
| Delivery | CDN unversioned | npm, tree-shaken through `echarts/core` |
| TS types | external `@types` needed | built-in `.d.ts` |
| Update without destroy | ❌ | ✅ `chart.setOption(delta)` |
| Heatmap series | ❌ hand-rolled DOM grid | ✅ ECharts heatmap series |
| Payoff annotations | custom canvas plugin | ✅ declarative `markLine` |
| License | MIT | Apache 2.0 |

Completed scope:
- Removed `<script src="https://cdn.jsdelivr.net/npm/chart.js">` from `index.html`.
- Migrated dashboard charts, cumulative P&L, ticker heatmap, payoff diagrams, and share-card export chart to ECharts.
- Replaced payoff/current-price canvas plugin and Monte Carlo baseline drawing with declarative `markLine`.
- Kept existing `this.charts` / `tradeDetailCharts` lifecycle compatible through the shared chart cleanup helper.

Verification:
- `npm run typecheck`
- `npm run build`
- `rg "chart\\.js|Chart\\.js|new Chart\\(|cdn\\.jsdelivr\\.net/npm/chart\\.js" src index.html dist package.json package-lock.json` returns no matches.

**L2 — Add Zod/Valibot for storage + form validation** *(Priority 2 — ✅ Complete)*
Added npm-managed Zod (`zod@4.4.3`) and centralized validation in `src/core/schema.ts`.
The schemas now cover storage payloads, importable storage shape checks, normalized leg input,
and add/edit trade form input.

Completed scope:
- Replaced the hand-written storage field validators in `src/core/migration.ts` with Zod schemas and shared issue formatting.
- Routed localStorage save/load, legacy-key migration, and user JSON import processing through `parseStorageSchema()`.
- Validated `normalizeLeg()` through `NormalizedLegInputSchema` so date, numeric, and import provenance fields are coerced consistently.
- Replaced add/edit trade form imperative numeric parsing with `TradeFormInputSchema` and `LegFormInputSchema`.
- Added schema-derived TypeScript aliases with `z.infer<>` for the new validation surfaces.

Verification:
- `npm run typecheck`
- focused schema smoke test covering valid/invalid leg form inputs and valid/invalid storage payloads
- `npm run build`

**L3 — All trade tables do full DOM rebuild** *(Priority 3 — ✅ Complete)*
Added AG Grid Community (`ag-grid-community@35.2.1`) and migrated the trade-facing tables from
`tbody.innerHTML = ''` + `insertRow()` rebuilds to virtualized AG Grid hosts.

| | Previous trade tables | Current AG Grid tables |
|---|---|---|
| Row rendering | every row rebuilt into the DOM | AG Grid virtual rows |
| Column sort | custom header listeners + table class toggles | AG Grid column sort state |
| Column filter | external controls only | external controls + AG column filter UI |
| Column resize/reorder | ❌ | ✅ AG Grid columns |
| Merge selection | checkbox DOM sync over all rows | AG Grid selection column mirrors `tradeMergeSelection` |
| Payoff detail | one hidden payoff row per trade | single reusable `#trades-grid-detail` panel |
| Quote cells | table-row side effects | AG cell renderers register with existing quote refresh maps |
| TS types | ad hoc table DOM | typed `ColDef<>` + `GridApi<>` surfaces |
| License | — | MIT (Community) |

Completed scope:
- Replaced `#trades-table` markup with an AG Grid root plus merge-selection toolbar and reusable payoff-detail panel.
- Preserved external filters/search, edit/delete actions, merge group selection, and payoff chart generation.
- Updated merge-select-all logic to use `currentFilteredTrades` instead of querying all rendered checkboxes, which keeps it correct under virtualization.
- Migrated Active Positions, Recent Closed Trades, Assigned Positions, and Credit Playbook to AG Grid roots.
- Preserved Finnhub quote-refresh integration for quote-backed dashboard and Credit Playbook cells.
- Added AG Grid Quartz styling integrated with the existing design tokens.

Verification:
- `npm run typecheck`
- `npm run build`

Follow-up scope: consider replacing `AllCommunityModule` with a smaller AG Grid module set once the exact column/filter feature surface settles.

**L4 — Modals use `is-hidden` class-toggle** *(Priority 4 — ✅ Complete)*
Converted `#disclaimer-banner` and `#ai-coach-consent` from `<div role="dialog">` with manual `is-hidden`/`is-visible` toggling to native `<dialog>` elements driven by `showModal()` / `close()`.

Completed scope:
- `index.html`: outer elements changed to `<dialog>`; removed the manual `<div class="ai-consent-modal__overlay">` (replaced by native `::backdrop`).
- `src/styles/app.css`: dropped `.is-hidden { display: none }` rules (`<dialog>` is hidden by default); moved backdrop blur/gradient onto `dialog::backdrop`; kept the panel slide-in transition keyed off `[open].is-visible` so `requestAnimationFrame` fades remain.
- `src/ui/modals/disclaimer.ts`: rewrote to use `dialog.showModal()` / `dialog.close()`; dropped `body` and `hideTimeoutId` from state.
- `src/ui/modals/ai-coach-consent.ts`: rewrote to use `dialog.showModal()` / `dialog.close()`; replaced manual `escapeHandler` with native `cancel` event; replaced manual overlay-click dismissal with a click handler that fires when `event.target === dialog`; dropped `restoreFocus` (native).
- `src/index.ts`: narrowed `disclaimerBanner` and `aiCoachConsent` `declare` types; trimmed init blocks; removed stale `cleanup()` references to dropped fields.

Verification:
- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run build`

**L5 — `showNotification` has no queue or ARIA** *(Priority 5 — ✅ Complete)*
Sonner is React-only, so the project replaced the `alert()` / `console.log` stub with a vanilla queued toast manager that fits the existing CSS token system and preserves the public `showNotification(message, type)` signature.

Completed scope:
- Added `<div id="toast-region" role="region" aria-label="Notifications">` to `index.html`.
- Added `.toast-region`, `.toast`, `.toast--info|success|warning|error`, `.toast__message`, `.toast__close` styles in `src/styles/app.css` (with a `prefers-reduced-motion` guard).
- Reimplemented `src/ui/notifications.ts`: queue + visible map (max 3 visible), per-toast `setTimeout` auto-dismiss (4 s default, 8 s for `error`), pause-on-hover/focus, manual close button, `role="status"`/`aria-live="polite"` for non-error and `role="alert"`/`aria-live="assertive"` for error.
- Backwards-compatible: every existing call site keeps its two-argument signature; an optional `options` argument is additive.

Verification:
- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run build`

**L6 — Custom Markdown renderer in AI chat** *(Priority 6 — ✅ Complete)*
Replaced the 200-line hand-rolled CommonMark subset in `src/utils/dom.ts` (`renderMarkdownToHTML`, `renderMarkdownTextSegment`, `formatMarkdownInline`, `applyBasicInlineFormatting`, `sanitizeMarkdownUrl`) with `marked@18` + `dompurify@3`.

Completed scope:
- Installed `marked`, `dompurify`, `@types/dompurify`. (`marked` ships its own types since v5.)
- New `renderMarkdownToHTML(markdown)` calls `marked.parse(markdown, { async: false })` then `DOMPurify.sanitize(...)` against an `ALLOWED_TAGS` / `ALLOWED_ATTR` whitelist that matches the previous output surface.
- DOMPurify `afterSanitizeAttributes` hook forces `target="_blank" rel="noopener noreferrer"` on every `<a>` tag.
- `src/index.ts`: dropped four dead delegators (`renderMarkdownTextSegment`, `formatMarkdownInline`, `applyBasicInlineFormatting`, `sanitizeMarkdownUrl`); simplified the surviving delegator to drop `.call(this, …)` since the helper is now stateless.
- `src/styles/app.css`: replaced `.ai-chat__code` / `.ai-chat__quote` / `.ai-chat__rule` class selectors (no longer emitted) with scoped `.ai-chat__bubble pre` / `blockquote` / `hr` rules; added `h1`–`h6` size compensation inside chat bubbles (the previous renderer shifted heading levels by two).

Verification:
- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run build` (bundle delta: +20.77 kB gzip, well under the 45 kB estimate)

---

### Libraries to skip

| Library | Reason |
|---|---|
| React | Vue 3 is the Phase 3 plan |
| Svelte | No ecosystem alignment with Phase 3 |
| Tailwind | Collides with existing `app.css` design system mid-refactor |
| Highcharts | Proprietary license |
| Lodash | Native array methods + `es-toolkit` (3 kB) suffice |
| Moment.js | Native `Intl` + `date-fns` cover all current date formatting |

---

## Phase 3 — Vue 3 (Planned)

### Current UI layer (pre-Phase 3)

Most UI remains raw DOM imperativism — no virtual DOM, no template engine, no reactivity layer. The `class GammaLedger` still writes directly to the page for forms, modals, cards, and controls, while trade-facing tables now delegate row rendering to AG Grid.

Key pain points by area:

| Area | Current implementation | Pain |
|---|---|---|
| Charts | Apache ECharts 6 via npm; chart roots use `setOption()` and shared disposal | Ready for `vue-echarts`; still invoked from `GammaLedger` delegators |
| Ticker heatmap | ECharts heatmap series | Ready for component wrapper |
| Payoff annotations | ECharts `markLine` annotations | Declarative chart options, ready for component wrapper |
| Tables | All trade-facing tables use AG Grid Community | Ready for `ag-grid-vue3`; custom cell renderers still live in vanilla callbacks |
| Forms | Leg rows via `insertAdjacentHTML`/`createElement`; Zod validates trade + leg inputs before save | DOM remains imperative; schemas are ready for Vue form bindings |
| Modals | Native `<dialog>` + `::backdrop`; both modals use `showModal()` / `close()` | Ready for Vue slot-based wrappers |
| Toasts | Vanilla queued manager (`role="status"` / `role="alert"`, max-3 queue, auto-dismiss) | Ready for Vue composable wrap |
| AI chat Markdown | `marked` + `DOMPurify` with allow-list sanitizer | CommonMark/GFM compliant |

### Entry criteria

| Criterion | Status |
|---|---|
| Phase 2 TypeScript complete — types stable before wrapping in components | ✅ |
| L1 ECharts migration — `vue-echarts` wraps ECharts; migrating Chart.js directly is riskier | ✅ |
| L2 Zod/Valibot — typed storage schema before Vue binds to data | ✅ |
| L3 AG Grid migration — `ag-grid-vue3` wraps AG Grid; DOM-rebuild tables + Vue = unmaintainable | ✅ |
| L4 Native `<dialog>` — clean slot boundary for Vue modal wrappers | ✅ |
| L5 Queued ARIA toast manager — clean boundary for Vue composable wrap | ✅ |
| L6 `marked` + `DOMPurify` for AI chat — replaces hand-rolled Markdown | ✅ |

### Recommended sequencing

```
1. ECharts migration    ✅ Done (npm, built-in types, no destroy-recreate; vue-echarts wrapper ready)
2. Zod/Valibot          ✅ Done (storage/form schemas; eliminates silent-zero type risks before Vue binds)
3. AG Grid migration    ✅ Done (trade tables virtualized; column sort/filter/resize; ag-grid-vue3 wrapper ready)
4. Native <dialog>      ✅ Done (disclaimer + AI consent on <dialog>; ::backdrop; cancel + click-outside dismiss)
5. marked + DOMPurify   ✅ Done (AI chat; ~200 lines of custom parser removed; DOMPurify allow-list)
6. Toast manager        ✅ Done (vanilla queue with ARIA role=status/alert; preserves showNotification API)
7. Vue 3                (decompose GammaLedger into feature composables + SFCs)
```

> **Vue 3 wrapper note:** L1 and L3 are chosen now because `vue-echarts` wraps ECharts and `ag-grid-vue3` wraps AG Grid — selecting these libraries before the Vue migration means zero chart or table logic changes when Vue 3 lands.

### Vue 3 decomposition targets

The `class GammaLedger` (~400 delegator methods) maps onto these composables,
based on the feature domains in the Phase 1 analysis:

| Composable | Methods absorbed | State owned |
|---|---|---|
| `useTrades` | trade CRUD, sort, filter, lifecycle | `trades`, `currentSort`, `currentFilteredTrades` |
| `useStats` | `calculateAdvancedStats`, `calculateAssignmentStats`, ticker perf | `latestStats` |
| `useCharts` | all `update*Chart`, `renderTickerHeatmap` | `charts` Map |
| `usePayoff` | per-trade payoff render, series, pricing | `tradeDetailCharts` Map |
| `useFinnhub` | quote fetch, rate limit, encryption, refresh schedule | `finnhub` struct, quote state |
| `useGemini` | API key, model, tokens, encryption | `gemini` struct |
| `useAIChat` | session, messages, markdown render | `aiChatMessages`, `aiChatSessionId` |
| `useImport` | OFX/Robinhood parsers, merge UX | `importLog`, `importMergeSelection` |
| `useDatabase` | File System Access, load/save, migration | `currentFileHandle`, `hasUnsavedChanges` |
| `useCreditPlaybook` | filter, sort, entry extraction, quote refresh | `creditPlaybook*` slots |
| `useShareCard` | render, refresh, html2canvas download | `shareCard` struct |

### Estimated bundle impact

| Addition | Size min+gz | Replaces |
|---|---|---|
| ECharts (tree-shaken) | ~110 kB | Chart.js CDN (~180 kB, removed from HTML) |
| AG Grid Community | ~300 kB JS gzip + ~43 kB CSS gzip with current AllCommunityModule/Quartz import | Trade table DOM rebuild paths |
| Zod | 12 kB | ~200 lines validation |
| marked + DOMPurify | 45 kB | ~250 lines custom Markdown |
| Toast manager (in-tree) | ~0 kB | ~7 lines `showNotification` stub (and ~120 LOC added) |
| **Net delta** | **~+190 kB bundled** | Chart.js CDN dependency eliminated |

ECharts is tree-shaken through `echarts/core`; AG Grid currently imports `AllCommunityModule` for the complete Community feature surface.
