# GammaLedger — Refactor Progress Summary

> Single reference document covering all completed work, in-progress tasks, and open TODOs.
> Companion to `phase1-analysis.md`, `phase1-module-map.md`, `phase1-progress.md`,
> `phase2-analysis.md`, `phase2-domain-objects.md`, and `tech-stack.md`.
>
> Last updated: 2026-05-06 (Phase F complete — all 60 modules TypeScript)

---

## Quick Status

| Phase | Goal | Status |
|---|---|---|
| **Phase 1** | JS module migration (monolith → ES modules, Vite) | ✅ **Complete** |
| **Phase 2** | TypeScript migration (type safety) | 🔄 **In Progress — Steps 4 complete, Steps 5–8 remaining** |
| **Phase 3** | Vue 3 component migration | ⏳ Not started |

---

## Phase 1 — ES Module Migration

### What it was

`src/app.js` was a **21,440-line monolith** containing three classes (`GammaLedger`,
`LocalInsightsAgent`, `GeminiInsightsAgent`), ~462 methods, and all application logic
in a single file with no bundler and no module system.

### Goal

Split into ~60 ES modules under `src/`, build with **Vite**, keep
`localStorage` data intact, preserve all observable behavior.

### Steps completed

| Step | Description | Status |
|---|---|---|
| 1 | Codebase analysis → `phase1-analysis.md` + `phase1-module-map.md` | ✅ |
| 2 | Vite project setup (`package.json`, `vite.config.ts`, `.gitignore`) | ✅ |
| 3 | Skeleton: 59 empty placeholder modules across all subdirs | ✅ |
| 4 | Wave-by-wave extraction of all logic from the monolith | ✅ |

### Wave detail

| Wave | Modules extracted | Status |
|---|---|---|
| 1 — Pure utilities | `core/config.js`, `core/sample-data.js`, `utils/dates.js`, `utils/dom.js`, `utils/formatting.js`, `utils/crypto.js` | ✅ |
| 2 — Storage layer | `core/storage.js`, `utils/import-csv.js` | ✅ |
| 3 — Trade model | `trades/legs.js`, `calculations/pnl.js`, `calculations/daysheld.js`, `trades/positions.js`, `trades/wheel.js`, `trades/pmcc.js`, `trades/spreads.js`, `trades/risk.js`, `calculations/stats.js`, `calculations/monte-carlo.js` | ✅ |
| 4 — Agents | `ai/local-agent.js`, `ai/gemini-agent.js` | ✅ |
| 5 — Integrations | `integrations/gemini.js`, `integrations/finnhub.js`, `integrations/mcp.js`, `settings/default-fee.js` | ✅ |
| 6 — Payoff | `payoff/series.js`, `payoff/pricing.js`, `payoff/summary.js`, `payoff/render.js` | ✅ |
| 7 — Imports | `imports/position-keys.js`, `imports/log.js`, `imports/robinhood.js`, `imports/ofx.js`, `imports/merge.js`, `imports/controls.js` | ✅ |
| 8 — UI helpers | `ui/notifications.js`, `ui/sidebar.js`, `ui/filters.js`, `ui/modals/disclaimer.js`, `ui/modals/ai-coach-consent.js` | ✅ |
| 9 — Tables + charts | `ui/tables/highlights.js`, `ui/tables/active-positions.js`, `ui/tables/assigned-positions.js`, `ui/tables/recent-trades.js`, `ui/tables/trades-table.js`, `ui/charts/cumulative-pl.js`, `ui/charts/dashboard-charts.js`, `ui/credit-playbook/data.js`, `ui/credit-playbook/render.js`, `ui/credit-playbook/index.js` | ✅ |
| 10 — Share card / dashboard / chat | `ui/share-card.js`, `ui/dashboard.js`, `ai/chat.js` | ✅ |
| 11 — Form + database | `trades/leg-form.js`, `database/persist.js` | ✅ |
| 12 — Entry point | `src/index.js` promoted from `src/legacy/app.js`; legacy dir deleted; `src/utils/export.js` as re-export shim | ✅ |

### Migration results

| Metric | Before | After |
|---|---|---|
| `src/app.js` / `src/legacy/app.js` lines | 21,440 | **deleted** |
| `src/index.js` lines | 2 (placeholder) | 2,912 |
| Vite ES modules | 1 | 60 |
| Bundle size (JS) | 367 kB | 381 kB (+4%) |
| Bundle size (gzip) | 94.9 kB | 99.5 kB |
| TypeScript errors | — | 0 |

### Key files introduced

- `vite.config.ts` — Vite configuration with path aliases (`@core`, `@trades`, etc.)
- `tsconfig.json` — permissive baseline TypeScript config (`strict: false`, `allowJs: true`)
- `index.html` — moved to repo root; loads `/src/index.js` as `type="module"`

---

## Phase 2 — TypeScript Migration

### Goal

Add TypeScript for type safety without changing business logic.
Priority: financial calculation and data-model layers.
Constraint: JS and TS files coexist; app must work after every step.

---

### Step 1 — Pre-migration analysis ✅ Complete

Two analysis reports written before any TypeScript work:

| Document | Contents |
|---|---|
| `docs/refactor/phase2-analysis.md` | 16 sections; type-unsafe hotspots, date inconsistencies, untyped object bags, localStorage parsing risks, magic-string enums, DOM typing gaps |
| `docs/refactor/phase2-domain-objects.md` | 25 domain object shapes catalogued with full field tables, creation sites, consumer sites, persistence status |
| `docs/refactor/tech-stack.md` | UI layer audit + recommendations for ECharts, Zod, AG Grid, native `<dialog>`, Sonner, `marked`+DOMPurify, Vue 3 (Phase 3) |

Key findings:
- **Top risk**: `loadFromStorage` at `app.js:18985` — no per-field validation; malformed data from legacy imports can corrupt the DB silently on next save.
- **25 distinct domain object shapes** catalogued (Trade persisted, Trade enriched, Leg persisted, Leg normalized, LegSummary with 31 fields, LegLifecycleResult, Stats, etc.)
- **13 magic-string enum concepts** identified (order type, leg type, lifecycle status, strategy, etc.)
- **Persisted vs. runtime field split** documented: `RUNTIME_TRADE_FIELDS` strips 47 fields; `RUNTIME_LEG_FIELDS` strips 5 fields (including `externalId`, `importGroupId`, `importSource`) before `localStorage` save.
- **Open questions flagged** for human review: `tradeReasoning` in runtime fields (data loss bug?), `externalId` stripped on save (dedup problem?), field aliasing (`entryDate`/`openedDate`, `orderType`/`tradeType`/`order`), schema `version` as string `'2.5'` vs. number.

---

### Step 2 — TypeScript tooling setup ✅ Complete

| Item | Status | Notes |
|---|---|---|
| `npm install typescript @types/node vite-plugin-checker` | ✅ | devDependencies in `package.json` |
| `tsconfig.json` created | ✅ | Permissive baseline; `strict: false`, `allowJs: true`, `checkJs: false` |
| Path aliases configured | ✅ | `@core`, `@trades`, `@calculations`, `@ui`, `@utils`, `@types-gl` |
| `vite.config.js` → `vite.config.ts` | ✅ | With `checker({ typescript: true })` overlay |
| `package.json` scripts updated | ✅ | `build: tsc --noEmit && vite build`, `typecheck: tsc --noEmit` |

---

### Step 3 — Domain type library ✅ Complete

All type files created under `src/types/`:

| File | Contents | Status |
|---|---|---|
| `common.ts` | `ISODateString`, `DollarAmount`, `ContractCount`, `StrikePrice`, `OptionType`, `OrderType`, `LegType`, `LegAction`, `LegSide`, `TradeDirection`, `LifecycleStatus`, `StrategyType`, `WheelCoverage`, `CumulativePLRange`, `ToastVariant`, `QuoteState`, `UnderlyingType` | ✅ |
| `leg.ts` | `PersistedLeg`, `NormalizedLeg` | ✅ |
| `trade.ts` | `Trade` (persisted), `EnrichedTrade` (runtime) | ✅ |
| `leg-summary.ts` | `LegSummary` (31 fields), `VerticalSpreadShape` | ✅ |
| `lifecycle.ts` | `LegLifecycleResult`, `LifecycleMeta`, `ExitReason` | ✅ |
| `stats.ts` | `Stats`, `TickerPerformance`, `TickerPerformanceItem`, `AssignmentStats`, `AssignmentRecord` | ✅ |
| `storage.ts` | `StorageSchema`, `MCPContext`, `StoragePlRange` | ✅ |
| `state.ts` | `AppState`, `CurrentSort`, `FinnhubState`, `GeminiState`, `ShareCardState`, `ShareCardMetrics`, `AIChatState`, `ImportState` | ✅ |
| `ui.ts` | `FilterState`, `ToastOptions`, `QuoteEntry`, `PositionHighlightConfig`, `StatusMessage` | ✅ |
| `integrations.ts` | `FinnhubQuote`, `GeminiResponse`, `GeminiCandidate`, `GeminiRequestPayload` | ✅ |
| `wheel.ts` | `WheelCoverage` (type alias), `PMCCLegs` | ✅ |
| `spreads.ts` | `SpreadPair`, `SpreadPairVariant` | ✅ |
| `credit-playbook.ts` | `CreditPlaybookEntry`, `CreditPlaybookFilters`, `CreditPlaybookSort` | ✅ |
| `imports.ts` | `RobinhoodImportPayload`, `OFXImportPayload`, `RobinhoodTransaction`, `OFXTransaction`, `OFXSecurity`, `ImportSummary`, `ImportError`, `ImportLogEntry`, `ImportStats` | ✅ |
| `mcp.ts` | `MCPTrade`, `MCPAssignment`, `MCPBuildContext` | ✅ |
| `ai.ts` | `AIAgentContext`, `Message`, `MessageRole`, `AIChatSession` | ✅ |
| `index.ts` | Re-exports all of the above | ✅ |

---

### Step 4 — Module conversion to TypeScript ✅ Complete (all phases)

#### Phase A — Utils and Core ✅ Complete

| File | Status |
|---|---|
| `src/utils/dates.ts` | ✅ Converted |
| `src/utils/dom.ts` | ✅ Converted |
| `src/utils/formatting.ts` | ✅ Converted |
| `src/utils/crypto.ts` | ✅ Converted |
| `src/utils/import-csv.ts` | ✅ Converted |
| `src/utils/export.ts` | ✅ Converted (re-export shim) |
| `src/core/config.ts` | ✅ Converted |
| `src/core/storage.ts` | ✅ Converted |
| `src/core/state.ts` | ✅ Converted |
| `src/core/sample-data.ts` | ✅ Converted |

#### Phase B — Calculations ✅ Complete

| File | Status |
|---|---|
| `src/calculations/pnl.ts` | ✅ Converted |
| `src/calculations/daysheld.ts` | ✅ Converted |
| `src/calculations/stats.ts` | ✅ Converted |
| `src/calculations/monte-carlo.ts` | ✅ Converted |

#### Phase C — Trade logic ✅ Complete

| File | Status |
|---|---|
| `src/trades/legs.ts` | ✅ Converted |
| `src/trades/positions.ts` | ✅ Converted |
| `src/trades/wheel.ts` | ✅ Converted |
| `src/trades/pmcc.ts` | ✅ Converted |
| `src/trades/spreads.ts` | ✅ Converted |
| `src/trades/risk.ts` | ✅ Converted |
| `src/trades/leg-form.ts` | ✅ Converted |

#### Phase D — UI layer ✅ Complete

| File | Status |
|---|---|
| `src/ui/notifications.ts` | ✅ Converted |
| `src/ui/sidebar.ts` | ✅ Converted |
| `src/ui/filters.ts` | ✅ Converted |
| `src/ui/dashboard.ts` | ✅ Converted |
| `src/ui/share-card.ts` | ✅ Converted |
| `src/ui/views.ts` | ✅ Converted |
| `src/ui/modals/disclaimer.ts` | ✅ Converted |
| `src/ui/modals/ai-coach-consent.ts` | ✅ Converted |
| `src/ui/tables/highlights.ts` | ✅ Converted |
| `src/ui/tables/active-positions.ts` | ✅ Converted |
| `src/ui/tables/assigned-positions.ts` | ✅ Converted |
| `src/ui/tables/recent-trades.ts` | ✅ Converted |
| `src/ui/tables/trades-table.ts` | ✅ Converted |
| `src/ui/charts/cumulative-pl.ts` | ✅ Converted |
| `src/ui/charts/dashboard-charts.ts` | ✅ Converted |
| `src/ui/charts/destroy.ts` | ✅ Converted |
| `src/ai/local-agent.ts` | ✅ Converted |
| `src/ai/gemini-agent.ts` | ✅ Converted |
| `src/ai/chat.ts` | ✅ Converted |
| `src/settings/default-fee.ts` | ✅ Converted |

#### Phase E — Data IO ✅ Complete

##### imports/

| File | Status |
|---|---|
| `src/imports/position-keys.ts` | ✅ Converted — `.js` removed |
| `src/imports/log.ts` | ✅ Converted — `.js` removed |
| `src/imports/robinhood.ts` | ✅ Converted — `.js` removed |
| `src/imports/ofx.ts` | ✅ Converted — `.js` removed |
| `src/imports/merge.ts` | ✅ Converted — `.js` removed |
| `src/imports/controls.ts` | ✅ Converted — `.js` removed |

Key fixes applied during conversion:
- `Record<string, unknown>` for all options bags / generic context parameters
- `HTMLInputElement | null` / `HTMLButtonElement | null` casts for DOM elements
- `Set<number>()` explicit generic to fix sort arithmetic
- `(trade.importBatchId as string)` and similar `unknown` property access casts
- `{ ...(leg as Record<string, unknown>) }` for spread on dynamically-typed objects
- `(importResult.stats as Record<string, unknown>) || {}` for nested unknown access
- `parts.push(options.note as string)` for string array append

##### database/

| File | Status |
|---|---|
| `src/database/persist.ts` | ✅ Converted — `.js` removed |

Key fixes:
- Imported `LOCAL_STORAGE_KEY`, `LEGACY_STORAGE_KEYS`, `RUNTIME_TRADE_FIELDS`, `RUNTIME_LEG_FIELDS` from `@core/config`
- `snapshot: Record<string, unknown> = {}` to allow dynamic property assignment
- `fileInput as HTMLInputElement | null`, `(ev.target as FileReader).result`
- `metadata: Record<string, unknown> = {}` with `(metadata.fileName as string)` cast
- `(data.trades as Record<string, unknown>[])` for mapped array

##### integrations/

| File | Status |
|---|---|
| `src/integrations/mcp.ts` | ✅ Converted — `.js` removed |
| `src/integrations/gemini.ts` | ✅ Converted — `.js` removed |
| `src/integrations/finnhub.ts` | ✅ Converted — `.js` removed |

Key fixes:
- `mcp.ts`: `plByRange: Record<string, number | null> = {}`, `.getTime()` for Date arithmetic, `(b.totalPL as number)` cast, `out: Record<string, unknown>` for both `buildMCPTrade` and `buildMCPAssignment`
- `gemini.ts`: imported 6 constants from `@core/config`; `HTMLInputElement | null` / `HTMLSelectElement | null` casts; `payload: Record<string, unknown>` in `saveGeminiConfigToStorage`; `(event.target as HTMLSelectElement).value`; `String(DEFAULT_GEMINI_MAX_TOKENS)` for `.value` assignment
- `finnhub.ts`: imported `DEFAULT_FINNHUB_RATE_LIMIT`, `FINNHUB_RATE_LIMIT_STORAGE_KEY` from `@core/config`; `HTMLInputElement | null` casts; typed options object for `populateQuoteCell`; `String(DEFAULT_FINNHUB_RATE_LIMIT)` for `.value` assignment

##### payoff/

| File | Status |
|---|---|
| `src/payoff/pricing.ts` | ✅ Converted — `.js` removed |
| `src/payoff/render.ts` | ✅ Converted — `.js` removed |
| `src/payoff/series.ts` | ✅ Converted — `.js` removed |
| `src/payoff/summary.ts` | ✅ Converted — `.js` removed |

Key fixes:
- `trade: Record<string, unknown> = {}` parameter type for `extractPmccLegs` and `getFallbackUnderlyingPrice`
- `canvas as HTMLCanvasElement | null` cast in `render.ts`

#### Phase F — Entry point ✅ Complete

| File | Status |
|---|---|
| `src/index.ts` | ✅ Converted — `src/index.js` removed |

Key fixes applied during conversion:
- `ConstructorParameters<typeof GeminiInsightsAgent>[0]` — correct pattern for class constructor argument type (replaces invalid `Parameters<typeof Class>`)
- `document.getElementById('ticker') as HTMLInputElement | null` — typed DOM query in `autoFillUnderlyingPrice` (line 696) and `autoFillUnderlyingPricesForLegs` (line 733)
- `inputElement.value = String(price)` — number-to-string coercion for `.value` assignment (line 714)
- Added missing `container` variable in `autoFillUnderlyingPricesForLegs` — was referenced but never declared; fixed as `document.getElementById('add-trade-view') || document`
- `trade: Record<string, unknown> = {}` parameter type for `getUnderlyingPriceForPayoff`
- `declare currentFileHandle: FileSystemFileHandle | null` — typed as File System Access API handle (was `unknown`)
- `context: Record<string, unknown> = {}` with `(context.batchId as string)` cast in `importOfxContent` and `importRobinhoodCsvContent`

---

### Step 5 — Enable strict mode per module ❌ Not started

Per-directory `tsconfig.json` overrides with `strict: true` have not been created.
The global `tsconfig.json` has `strict: false`.

Planned order (per CLAUDE.md):
1. `src/calculations/` — highest value, P&L bugs are silent
2. `src/core/` — storage parsing and state management
3. `src/trades/` — domain logic
4. `src/utils/` — low risk
5. `src/ui/` — DOM types are noisy; do last

---

### Step 6 — localStorage migration guard ❌ Not started

`src/core/migration.ts` has not been created.
`loadFromStorage()` in `src/core/storage.ts` does not yet call `migrateSchema()`.

Required:
- Create `src/core/migration.ts` with `migrateSchema(raw: unknown): StorageSchema` and `emptySchema(): StorageSchema`
- Implement version 0 → 1 migration: ensure all trades have an `id` field
- Wire `migrateSchema()` into `loadFromStorage()` before returning data
- Write `docs/refactor/phase2-migrations.md` to log migration steps

---

### Step 7 — Production build validation ⚠️ Partially confirmed

Status of the three required commands:

| Command | Status |
|---|---|
| `npm run typecheck` (tsc --noEmit, 0 errors) | ✅ 0 errors — confirmed 2026-05-06 (Phase F) |
| `npm run build` (clean dist/) | ✅ Clean — 372.21 kB JS / 96.85 kB gzip — confirmed 2026-05-06 (Phase F) |
| `npm run preview` (production build check) | ⚠️ Not yet verified (needs browser smoke test) |

Build metrics after Phase F completion:

| Metric | Value |
|---|---|
| JS bundle (uncompressed) | 372.21 kB |
| JS bundle (gzip) | 96.85 kB |
| CSS bundle | 86.64 kB / 13.92 kB gzip |
| Modules transformed | 56 |
| TypeScript errors | 0 |
| Remaining `.js` files in `src/` | **0** |

---

### Step 8 — `docs/refactor/phase2-summary.md` ❌ Not created

Post-migration summary document has not been written.

---

## Open TODOs

### Critical — blockers for Phase 2 completion

1. **Create `src/core/migration.ts`** — the localStorage migration guard is a critical
   safety net. Without it, corrupt or legacy-format data can silently produce NaN
   cascades on load (see `phase2-analysis.md §5`).

3. **Enable strict mode** — `strict: false` globally means many type errors are
   masked. Start with `src/calculations/` (per-directory `tsconfig.json`).

4. **Run browser smoke test against production build** — `npm run preview` not yet
   verified after Phase F conversion. All 56 modules build cleanly; runtime correctness
   still needs a manual pass through the UI.

### Important — data integrity and correctness

6. **Resolve `tradeReasoning` in `RUNTIME_TRADE_FIELDS`** — this user-entered free-text
   field is currently stripped before every `localStorage` save. If intentional, document
   it; if a bug, remove it from the runtime set. See `phase2-analysis.md §16.1`.

7. **Resolve `externalId`/`importGroupId`/`importSource` stripped from legs on save** —
   without persisted import provenance, re-running the same OFX or Robinhood import will
   create duplicate legs. See `phase2-analysis.md §16.2`.

8. **Pick canonical field names** — three aliased pairs exist in the trade shape:
   - `entryDate` ↔ `openedDate` (both set by `enrichTradeData`, both read by consumers)
   - `exitDate` ↔ `closedDate` (same)
   - `orderType` ↔ `tradeType` ↔ `order` (leg field, three names for same concept)
   See `phase2-analysis.md §16.3 / §16.4`.

9. **`StorageSchema.version` type** — live code uses `'2.5'` (string literal); 
   Phase 2 specs assume `number`. Either update the constant or change the type.
   See `phase2-domain-objects.md §11`.

### Medium priority — type quality improvements

10. **Add runtime validation (`isValidSchema`) to `loadFromStorage`** — the `JSON.parse`
    of the primary DB key has no per-field validation today. A minimal type predicate
    or Zod schema should gate every load. See `phase2-analysis.md §5`.

11. **Validate Finnhub API response shape** — `{ c, h, l, o, pc, t }` is assumed but
    never checked. A breaking Finnhub API change silently produces NaN quotes across all
    active positions.

12. **`LifecycleMeta.matchedPairs` initialized as `false` (boolean) then overwritten
    with a number** — change the initial value to `0` so the type is consistently
    `number`. See `phase2-domain-objects.md §6`.

13. **`hasCashSettlementEvent` and `activityAfterExpiration` in `LifecycleMeta` are
    conditionally added** — they should be declared as required (`boolean`) with
    default `false` at initialization. See `phase2-domain-objects.md §6`.

14. **`multiplier || 1` in `summarizeLegs`** — a zero multiplier (invalid data) silently
    becomes `1` at `app.js:691, 964`. TypeScript types won't prevent this, but a
    runtime assertion would. See `phase2-analysis.md §6.2`.

### Low priority — Phase 3 prep

15. **Chart.js is loaded via unversioned CDN** (`cdn.jsdelivr.net/npm/chart.js`).
    No npm package, no `@types/chart.js`. Consider migrating to
    **Apache ECharts** (npm, built-in TS types, no destroy-recreate pattern) — see
    `tech-stack.md Priority 1`.

16. **All trade tables do full DOM rebuild** on every data change — no virtual
    scrolling. At 2,000+ trades, visible paint pauses occur. **AG Grid Community**
    is the recommended replacement — see `tech-stack.md Priority 3`.

17. **AI chat uses a 250-line custom Markdown renderer** — replace with
    `marked` + `DOMPurify` — see `tech-stack.md Priority 6`.

18. **Modals use `is-hidden` class-toggle** with manual focus trapping — replace
    with native `<dialog>` element — see `tech-stack.md Priority 4`.

19. **`Infinity` as a sentinel in P&L/risk** — typed as `number` in TS (valid
    at runtime), but not explicitly signaled. Consider a tagged union
    `{ kind: 'unlimited' } | { kind: 'finite'; value: number }` for Phase 3.
    See `phase2-analysis.md §16.7`.

---

## File Inventory — Current State

### TypeScript only (no `.js` counterpart)

```
src/types/             ← all 17 type files
src/utils/             ← all 6 utils (dates, dom, formatting, crypto, import-csv, export)
src/core/              ← all 4 core files (config, storage, state, sample-data)
src/calculations/      ← all 4 calculation files (pnl, daysheld, stats, monte-carlo)
src/trades/            ← all 7 trade files (legs, positions, wheel, pmcc, spreads, risk, leg-form)
src/ai/                ← all 3 AI files (local-agent, gemini-agent, chat)
src/settings/          ← default-fee.ts
src/ui/                ← all UI files (notifications, sidebar, filters, dashboard, share-card,
                          views, modals/disclaimer, modals/ai-coach-consent, tables/*, charts/*)
src/imports/           ← all 6 import files (position-keys, log, robinhood, ofx, merge, controls)
src/database/          ← persist.ts
src/integrations/      ← finnhub.ts, gemini.ts, mcp.ts
src/payoff/            ← pricing.ts, render.ts, series.ts, summary.ts
src/index.ts           ← entry point (2,975 lines — Phase F complete)
```

### JavaScript files remaining

**None.** Phase F is complete: all 60 modules under `src/` are now TypeScript.

---

## Smoke Test Checklist

Run after every module conversion and strict-mode activation:

- [ ] `npm run typecheck` exits with 0 errors for all converted files
- [ ] `npm run build` exits 0 with a clean `dist/`
- [ ] App loads in browser without console errors
- [ ] Dashboard renders with existing `localStorage` data
- [ ] Add a new trade — it persists after reload
- [ ] Wheel tracker shows open positions correctly
- [ ] PMCC tracker links legs correctly
- [ ] P&L values are numerically correct (not NaN, not string-concatenated)
- [ ] Date fields display correctly (no epoch timestamps, no `Invalid Date`)
- [ ] CSV export produces a valid file with correct column types
- [ ] CSV import (Robinhood, OFX) reads back correctly and all fields are typed
- [ ] Charts render without errors
- [ ] All modals open and close correctly
- [ ] Existing `localStorage` data survives a page reload

---

## Phase 3 — Vue 3 (Planned)

Not started. Recommended prerequisites (from `tech-stack.md`):

1. Phase 2 TypeScript migration complete — types must be stable before wrapping in components
2. ECharts migration complete — `vue-echarts` replaces raw Chart.js
3. AG Grid migration complete — `ag-grid-vue3` replaces DOM-rebuild tables
4. Native `<dialog>` modals — clean boundary for Vue slot-based dialog wrappers
5. Sonner toasts — replaces `showNotification` with `toast()` API

The single `class GammaLedger` (with ~400 methods) is the main target for decomposition
into Vue 3 composables and single-file components. Each feature domain identified in
`phase1-analysis.md §10` maps to one or more composables.

