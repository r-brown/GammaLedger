# GammaLedger — Refactor Progress

> Single reference document covering all completed work, in-progress state, and open todos.
> Consolidates: `phase1-analysis.md`, `phase1-module-map.md`, `phase1-progress.md`,
> `phase2-analysis.md`, `phase2-domain-objects.md`, `phase2-migrations.md`,
> `phase2-summary.md`, and `tech-stack.md`.
>
> Last updated: 2026-05-07

---

## Quick Status

| Phase | Goal | Status |
|---|---|---|
| **Phase 1** | JS module migration (21K-line monolith → 60 ES modules, Vite) | ✅ Complete |
| **Phase 2** | TypeScript migration (type safety across all modules) | ✅ Complete — M1/M2/M3 resolved; M4 smoke test pending |
| **Phase 3** | Vue 3 component migration | ⏳ Not started |

---

## Phase 1 — ES Module Migration

### Starting point

`src/app.js` was a **21,440-line monolith** with:
- 3 classes: `GammaLedger` (~360 methods), `LocalInsightsAgent` (12 methods), `GeminiInsightsAgent` (16 methods)
- ~462 total methods; ~160 `this.*` state properties on `GammaLedger`
- All state on `this` — no module system, no bundler, no transpilation
- 2 CDN libraries: Chart.js (11 `new Chart()` sites), html2canvas
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
9. **`payoff/` earns its own directory** — ~1,300 LOC of strategy-specific payoff math + Chart.js,
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
    charts/                  cumulative-pl, dashboard-charts, destroy
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

Called by both `loadFromStorage()` (primary + legacy keys) and `parseStorageSchema()` (user JSON imports):

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

**M4 — Manual smoke checklist items still pending**
Browser automation timed out before completing deeper interactive workflows. Unverified:
- [ ] Add a new trade and confirm it persists after reload
- [ ] Wheel tracker shows open positions correctly
- [ ] PMCC tracker links legs correctly
- [ ] CSV export produces a valid file with correct column types
- [ ] CSV import (Robinhood, OFX) reads back correctly with all fields typed
- [ ] All modals open and close correctly (disclaimer, AI consent, trade detail)
- [ ] All Trades table renders, sorts, and filters correctly

---

### 🟢 Low priority — Phase 3 prerequisites

**L1 — Chart.js loaded via unversioned CDN** *(Priority 1)*
`cdn.jsdelivr.net/npm/chart.js` with no version pin. 11 `new Chart()` sites all use
`destroy()` + `new Chart()` — no incremental update. No `@types/chart.js`.
**Replace with Apache ECharts** (`npm install echarts`, built-in TS types, `chart.setOption()` delta updates, built-in heatmap series):

| | Chart.js (current) | ECharts |
|---|---|---|
| Delivery | CDN unversioned | npm, tree-shakeable |
| TS types | external `@types` | built-in `.d.ts` |
| Update without destroy | ❌ | ✅ `chart.setOption(delta)` |
| Financial candlestick/waterfall | ❌ | ✅ built-in series types |
| Heatmap series | ❌ | ✅ replaces hand-rolled CSS grid |
| Large dataset (100k pts) | slowdown | `series.large: true` progressive render |
| Payoff annotations | custom canvas plugin | `markLine` / `markArea` declarative |
| Size (tree-shaken) | ~180 kB | ~100–120 kB for types used |
| License | MIT | Apache 2.0 |

Migrate each of the 11 chart methods one-by-one (each is a self-contained method — ideal for incremental conversion). Remove `<script src="…chart.js">` from `index.html` when done.

> **Why not alternatives:** Recharts/Victory are React-only. Highcharts is proprietary. D3 is lower-level (same work). Lightweight-charts covers OHLC only. Plotly is 3× the size.

**L2 — Add Zod/Valibot for storage + form validation** *(Priority 2)*
~200 lines of imperative `Number(x) || 0` coercion in `normalizeLeg` and form submission. The same schema doubles as the TypeScript type source via `z.infer<>`, replacing the separate `interface Trade`:

```bash
npm install zod    # or: npm install valibot  (~3 kB alternative)
```

```ts
const LegSchema = z.object({
  type:     z.enum(['CALL', 'PUT', 'STOCK', 'CASH']),
  quantity: z.number().finite().positive(),
  premium:  z.number().finite(),
  fees:     z.number().finite().min(0),
  // …
})

// localStorage guard — eliminates the #1 silent-bug source from pre-migration analysis
const result = z.array(TradeSchema).safeParse(JSON.parse(raw))
if (!result.success) { return [] }
return result.data  // typed as Trade[]
```

**L3 — All trade tables do full DOM rebuild** *(Priority 3)*
Five tables use `tbody.innerHTML = ''` + `insertRow()` loops on every data change. At 2,000+ trades, visible paint pauses occur. **Replace with AG Grid Community** (`npm install ag-grid-community`). Start with the All Trades table:

| | Current (DOM rebuild) | AG Grid Community |
|---|---|---|
| Virtual scrolling | ❌ all rows in DOM | ✅ only visible rows rendered |
| 2000-row performance | freeze | smooth 60 fps |
| Column sort | 120 lines custom | built-in, multi-column |
| Column filter | custom `<select>` | built-in per-column filter UI |
| Column resize/reorder | ❌ | ✅ drag-and-drop |
| Row selection/checkboxes | custom Set + DOM sync | built-in selection model |
| CSV export | custom `export.ts` | `gridApi.exportDataAsCsv()` |
| TS types | ❌ | `ColDef<Trade>` generic |
| License | — | MIT (Community) |

Active Positions and Credit Playbook tables can follow. **TanStack Table** is headless and saves nothing in vanilla JS since you still write all DOM manipulation yourself.

**L4 — Modals use `is-hidden` class-toggle** *(Priority 4)*
Three modal types with manual `escapeHandler` and partial focus trapping. **Replace with native `<dialog>` element** — no library needed, all evergreen browsers supported:

```ts
const el = document.getElementById('trade-modal') as HTMLDialogElement
el.showModal()   // built-in focus trap, backdrop, Escape key, ARIA role="dialog"
el.close()
el.addEventListener('close', cleanupPayoffChart)
```

Replaces the `is-hidden` class-toggle hack across all three modal types. Clean boundary for Vue 3 slot-based dialog wrappers.

**L5 — `showNotification` has no queue or ARIA** *(Priority 5)*
40-line method; no queue, no `role="status"`. **Replace with Sonner** (3 kB, framework-agnostic, ARIA-compliant):

```bash
npm install sonner
```

```ts
import { toast } from 'sonner'
toast.success('Trade saved')
toast.promise(saveDatabase(), { loading: 'Saving…', success: 'Saved!', error: 'Failed' })
```

**L6 — Custom Markdown renderer in AI chat** *(Priority 6)*
250-line hand-rolled parser (handles bold, italic, headings, lists, blockquotes, fenced code; no streaming). **Replace with `marked` + `DOMPurify`**:

```bash
npm install marked dompurify
npm install --save-dev @types/marked @types/dompurify
```

```ts
import { marked } from 'marked'
import DOMPurify from 'dompurify'

messageEl.innerHTML = DOMPurify.sanitize(marked.parse(content) as string)
```

`marked` is 25 kB min+gz and CommonMark-compliant. Always sanitize before DOM insertion.

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

Everything is raw DOM imperativism — no virtual DOM, no template engine, no reactivity layer. The `class GammaLedger` writes directly to the page using `insertRow()`, `insertCell()`, `document.createElement()`, and `innerHTML = ''` to fully rebuild every table on every data change.

Key pain points by area:

| Area | Current implementation | Pain |
|---|---|---|
| Charts | Chart.js 4 via unversioned CDN; all updates via `destroy()` + `new Chart()` | Reliability risk; no partial re-render; no TS types |
| Ticker heatmap | Hand-rolled CSS grid with inline `rgba()` strings | Not a Chart.js chart at all; hard to maintain |
| Payoff annotations | 60-line `priceLabelPlugin` for canvas annotations | Fragile custom plugin replaced by `markLine`/`markArea` in ECharts |
| Tables | Five tables: full `tbody.innerHTML = ''` + `insertRow()` rebuild | 2,000+ trade DOM freeze; 120+ lines custom sort; no pagination |
| Forms | Leg rows via `insertAdjacentHTML`/`createElement`; validation is imperative error array | Schema-less; silent numeric coercion |
| Modals | `is-hidden` class toggle; only disclaimer has a focus trap | Partial a11y; no shared abstraction |
| Toasts | 40-line method, no queue, no ARIA | Missing `role="status"` |
| AI chat Markdown | 250-line custom parser | No streaming; CommonMark edge cases |

### Entry criteria

| Criterion | Status |
|---|---|
| Phase 2 TypeScript complete — types stable before wrapping in components | ✅ |
| L1 ECharts migration — `vue-echarts` wraps ECharts; migrating Chart.js directly is riskier | ⏳ |
| L2 Zod/Valibot — typed storage schema before Vue binds to data | ⏳ |
| L3 AG Grid migration — `ag-grid-vue3` wraps AG Grid; DOM-rebuild tables + Vue = unmaintainable | ⏳ |
| L4 Native `<dialog>` — clean slot boundary for Vue modal wrappers | ⏳ |

### Recommended sequencing

```
1. ECharts migration    (npm, built-in types, no destroy-recreate; vue-echarts wrapper ready)
2. AG Grid migration    (virtual scrolling, ~300 lines sort/filter code removed; ag-grid-vue3 wrapper ready)
3. Zod/Valibot          (eliminates silent-zero type risks before Vue binds to data)
4. Native <dialog>      (clean slot boundary for Vue wrappers)
5. marked + DOMPurify   (AI chat; 250 lines removed)
6. Sonner               (toasts; 40 lines removed)
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
| AG Grid Community | ~200 kB | ~300 lines table render code |
| Zod | 12 kB | ~200 lines validation |
| marked + DOMPurify | 45 kB | ~250 lines custom Markdown |
| Sonner | 3 kB | ~40 lines `showNotification` |
| **Net delta** | **~+190 kB bundled** | Chart.js CDN dependency eliminated |

Vite + TypeScript tree-shaking will reduce actual shipped sizes for ECharts and AG Grid below the listed totals.
