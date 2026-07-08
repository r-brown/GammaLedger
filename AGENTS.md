# GammaLedger — AI Agent Code Context

## Project Overview

GammaLedger is a **privacy-first, local-first options trading journal and analytics dashboard**.
It is a single-page web application (SPA) built with **TypeScript + Vite**, compiled from
~60 ES modules into a single JS bundle served from `dist/`. No server-side component.

- **Live app**: https://gammaledger.com
- **GitHub**: https://github.com/r-brown/GammaLedger
- **License**: AGPLv3 (commercial license available separately)

---

## Running the App

```bash
npm install         # first time only
npm run dev         # Vite dev-server at http://localhost:5173
npm run build       # typecheck + Vite production bundle → dist/
npm run preview     # serve the production build locally
npm run typecheck   # tsc --noEmit + all 8 strict subproject checks
```

Supported browsers: Chrome, Edge, Firefox (modern versions). Chrome/Edge required for the
File System Access API (save/load `.json` database files directly).

---

## Repository Structure

```
src/
  index.ts           # 1,711 lines — GammaLedger class + bootstrap; entry point
  styles/app.css     # ~4,700 lines — full design system with light/dark tokens
  core/              # config, migration, sample-data, state, storage
  utils/             # crypto, dates, dom, export, formatting, import-csv
  trades/            # leg-form, legs, pmcc, positions, risk, spreads, wheel
  calculations/      # daysheld, monte-carlo, pnl, stats
  ai/                # chat, gemini-agent, local-agent
  ui/
    charts/          # cumulative-pl, dashboard-charts, destroy
    tables/          # active-positions, assigned-positions, highlights, recent-trades, trades-table
    modals/          # ai-coach-consent, disclaimer
    credit-playbook/ # data, index, render
    dashboard.ts, filters.ts, notifications.ts, share-card.ts, sidebar.ts, views.ts
  imports/           # controls, log, merge, ofx, position-keys, robinhood
  database/          # persist
  integrations/      # finnhub, gemini, mcp
  settings/          # default-fee
  types/             # 17 domain type files, re-exported via @types-gl
index.html           # SPA shell; all views defined here
tsconfig.json        # root: strict: false (broad compat layer)
vite.config.ts
package.json
mcp/                 # GammaLedger MCP server (Python, uv-managed)
  pyproject.toml
  src/gammaledger_mcp/  server.py, database.py, prompts/
  tests/
tests/               # Reference JSON fixtures for manual smoke testing
docs/superpowers/
  plans/                 # Feature implementation plans
  specs/                 # Feature design specs
```

---

## Architecture

### Delegation Pattern — Not Pure ES Modules

All feature modules export plain functions that use the **`.call(this, …)` delegation
pattern**. The `GammaLedger` class in `src/index.ts` imports every module and wires its
methods as thin delegators:

```ts
// src/utils/dates.ts
export function formatDate(dateString: string): string { /* … */ }

// src/index.ts — GammaLedger delegates to the module function
import * as dates from './utils/dates.js'
class GammaLedger {
  formatDate(d: string) { return dates.formatDate.call(this, d) }
}
```

**Consequences for all new code:**

1. Feature modules receive the full `GammaLedger` instance as `this`
2. Every module's exported functions declare a `this: SomeContext` interface (structural typing)
   covering only the subset of `GammaLedger` they need
3. There is **no module-level state** — all mutable state lives on the class instance

### Key Classes

| Class | File | Purpose |
|---|---|---|
| `GammaLedger` | `src/index.ts` | Main class — instantiated as `window.tracker`; owns all state |
| `LocalInsightsAgent` | `src/ai/local-agent.ts` | Offline rule-based AI coach |
| `GeminiInsightsAgent` | `src/ai/gemini-agent.ts` | Gemini AI integration; falls back to `LocalInsightsAgent` |

### Path Aliases (`tsconfig.json` + `vite.config.ts`)

| Alias | Resolves to |
|---|---|
| `@core/*` | `src/core/*` |
| `@trades/*` | `src/trades/*` |
| `@calculations/*` | `src/calculations/*` |
| `@ui/*` | `src/ui/*` |
| `@utils/*` | `src/utils/*` |
| `@types-gl` | `src/types/index.ts` (barrel export) |
| `@types-gl/*` | `src/types/*` |

### TypeScript Configuration

Root `tsconfig.json` is `strict: false` (broad compatibility layer). Seven subdirectories
have their own `tsconfig.json` with `strict: true`, checked via `npm run typecheck:strict`:

```
src/calculations/tsconfig.json   strict: true
src/core/tsconfig.json           strict: true
src/trades/tsconfig.json         strict: true
src/utils/tsconfig.json          strict: true
src/ui/tsconfig.json             strict: true
src/imports/tsconfig.json        strict: true
src/integrations/tsconfig.json   strict: true
```

New modules placed in these directories must satisfy strict checks before the plan task is
marked complete.

### Application Constants (`src/core/config.ts`)

All constants are exported from here and re-imported in `src/index.ts`. Key ones:

- `APP_CONFIG` — frozen object with `GEMINI`, `STORAGE`, `SHARE_CARD`, `PL_RANGES` sub-objects
- `RUNTIME_TRADE_FIELDS` — `Set<string>` of fields computed at runtime; never read back from raw storage as canonical values (but written into persisted JSON for the MCP server via `mcpContext`)
- `RUNTIME_LEG_FIELDS` — `Set<string>` of leg-level OFX-excluded fields
- `CURRENT_STORAGE_VERSION` — string `'2.5'`
- All `localStorage` key constants (e.g. `LOCAL_STORAGE_KEY`, `GEMINI_STORAGE_KEY`)

---

## Data Storage

| Storage | Key / Mechanism | Contents |
|---|---|---|
| `localStorage` | `GammaLedgerLocalDatabase` | Full trade database (JSON string) |
| `localStorage` | `GammaLedgerGeminiConfig` | Gemini model/endpoint config |
| `localStorage` | `GammaLedgerGeminiSecret` | Encrypted Gemini API key |
| `localStorage` | `GammaLedgerGeminiMaxTokens` | Gemini max output tokens |
| `localStorage` | `GammaLedgerDisclaimerAcceptedAt` | Disclaimer acceptance timestamp |
| `localStorage` | `GammaLedgerSidebarCollapsed` | Sidebar UI preference |
| `localStorage` | `GammaLedgerDefaultFeePerContract` | Default commission fee |
| `localStorage` | `GammaLedgerFinnhubRateLimit` | Finnhub API rate limit setting |
| `localStorage` | `GammaLedgerAICoachConsentAt` | AI coach consent timestamp |
| File System | JSON file via File System Access API | Portable database backup |

Always use `safeLocalStorage` from `src/core/storage.ts` — never access `localStorage`
directly. The wrapper handles quota errors, private-mode failures, and logs warnings.

---

## Data Model

### Trade Object

```ts
// Minimal persisted shape: src/types/trade.ts — interface Trade
{
  id: string               // 'TRD-XXXX'
  ticker: string           // e.g. 'SPY'
  strategy: string         // one of 63 supported strategy names
  status: 'Open' | 'Closed' | 'Expired' | 'Assigned' | 'Rolling'
  underlyingType: 'Stock' | 'ETF' | 'Index' | 'Future'
  openedDate: ISODate | ''
  closedDate: ISODate | ''
  expirationDate: ISODate | ''
  exitReason: string
  notes: string            // markdown supported
  legs: PersistedLeg[]
}

// Runtime-enriched shape: src/types/trade.ts — interface EnrichedTrade
// All fields below are in RUNTIME_TRADE_FIELDS and computed by enrichTradeData()
{
  …Trade,
  pl, roi, weeklyROI, monthlyROI, annualizedROI,
  tradeType, tradeDirection, lifecycleStatus, lifecycleMeta,
  capitalAtRisk, maxRisk, maxRiskLabel, riskIsUnlimited,
  riskValue: RiskValue,    // tagged union — see below
  totalFees, totalCredit, totalDebit, cashFlow,
  entryPrice, exitPrice, daysHeld, dte,
  strikePrice, displayStrike, activeStrikePrice, quantity, multiplier,
  primaryLeg, legsCount, openContracts, closeContracts, openLegs, rollLegs,
  partialClose, rolledForward, autoExpired,
  pmccShortExpiration, longExpirationDate,
  wheelCoverage, shares, effectiveCostBasis,
  marketValue, unrealizedPL, marketPriceSource
}
```

### Leg Object

```ts
// src/types/leg.ts — interface PersistedLeg
{
  id: string                       // 'TRD-XXXX-L1'
  orderType: 'BTO' | 'STO' | 'BTC' | 'STC'
  type: 'CALL' | 'PUT' | 'STOCK' | 'CASH'
  quantity: number
  multiplier: number               // 100 for standard equity options
  strike: number
  premium: number
  fees: number
  executionDate: ISODate
  expirationDate: ISODate
}
```

### RiskValue Tagged Union

`maxRisk` / `capitalAtRisk` can be `Infinity` for unlimited-risk strategies.
Prefer the typed `riskValue` field in new code:

```ts
import { isFiniteRisk } from '@trades/risk'

if (isFiniteRisk(trade.riskValue)) {
  display(trade.riskValue.amount)  // narrowed to number — no Infinity check
} else {
  display('Unlimited')
}

// Helpers exported from src/trades/risk.ts:
// UNLIMITED_RISK, finiteRisk(amount), toRiskValue(maxRisk), isFiniteRisk(v)
```

### Storage Schema

`localStorage` compound document under `GammaLedgerLocalDatabase`:
```ts
{ version: '2.5', trades: Trade[], exportDate: ISOTimestamp, mcpContext?: MCPContext }
```

`src/core/schema.ts` owns the Zod schemas for storage, normalized leg input, and add/edit
trade form input. `src/core/migration.ts` → `parseStorageSchema(raw)` is the mandatory
guard that migrates and validates any payload (including legacy formats) before it reaches
the application. It is used by localStorage load/save paths and user JSON imports.

Form validation uses `TradeFormInputSchema` and `LegFormInputSchema`. New form or
persistence code should reuse those schemas instead of adding ad hoc `Number(x) || 0`
coercion paths.

---

## Type Library (`src/types/`)

Import with `import type { Trade, EnrichedTrade } from '@types-gl'`.
Sub-module imports: `import type { RiskValue } from '@types-gl/common'`.

| File | Key types |
|---|---|
| `common.ts` | `ISODate`, `DollarAmount`, `StrikePrice`, `LegType`, `OrderType`, `LifecycleStatus`, `RiskValue`, `GeminiModel`, `ToastVariant`, etc. |
| `leg.ts` | `PersistedLeg`, `NormalizedLeg` |
| `trade.ts` | `Trade` (persisted), `EnrichedTrade` (runtime) |
| `leg-summary.ts` | `LegSummary` (31 fields), `VerticalSpreadShape` |
| `lifecycle.ts` | `LegLifecycleResult`, `LifecycleMeta`, `ExitReason` |
| `stats.ts` | `Stats`, `TickerPerformance`, `AssignmentStats` |
| `storage.ts` | `StorageSchema`, `MCPContext` |
| `state.ts` | `AppState`, `FinnhubState`, `GeminiState`, `AIChatState`, `ImportState` |
| `integrations.ts` | `FinnhubQuote`, `GeminiApiResponse` + runtime guards `isGeminiApiResponse()`, `extractGeminiText()`, `extractGeminiError()` |
| `imports.ts` | `OFXImportPayload`, `RobinhoodImportPayload`, `ImportLogEntry` |
| `ai.ts` | `AIAgentContext`, `Message`, `AIChatSession` |
| `index.ts` | Barrel — re-exports everything |

---

## Key Methods Reference

### `GammaLedger` class (`src/index.ts`)

| Method | Delegated to | Description |
|---|---|---|
| `init()` | — | Bootstrap: load storage, bind events, render dashboard |
| `updateDashboard()` | `ui/dashboard.ts` | Recompute stats, re-render all dashboard widgets |
| `calculateAdvancedStats()` | `calculations/stats.ts` | Core analytics — P&L, win rate, Sharpe, drawdown |
| `enrichTradeData(trade)` | `trades/legs.ts` | Compute all `RUNTIME_TRADE_FIELDS` for one trade |
| `calculatePL(trade)` | `calculations/pnl.ts` | Realized/unrealized P&L from leg cash flows |
| `summarizeLegs(legs)` | `trades/legs.ts` | Aggregate leg-level data (cash flow, contracts) |
| `normalizeLeg(leg, i)` | `trades/legs.ts` | Normalize raw leg (order type, action, side) |
| `assessRisk(trade, sum)` | `trades/risk.ts` | Compute maxRisk, maxRiskLabel, unlimited flag |
| `showView(name)` | `ui/views.ts` | Switch active view, update page title |
| `buildMCPContext()` | `integrations/mcp.ts` | Build `mcpContext` block written to saved JSON |
| `saveDatabase()` | `database/persist.ts` | Persist to localStorage + optional File System API |
| `loadFromStorage()` | `database/persist.ts` | Load trades via migration guard |
| `sanitizeString(v, n)` | inline | Input sanitization for all user text |
| `validateNumber(v, opts)` | inline | Numeric input validation (finite, range-bounded) |

### Module-level helpers (import directly in new feature modules)

| Function | Import from | Description |
|---|---|---|
| `safeLocalStorage` | `@core/storage` | Safe localStorage — don't use raw `localStorage` |
| `parseStorageSchema(raw)` | `@core/migration` | Migrate + validate storage payload |
| `toRiskValue(n)` | `@trades/risk` | Convert `number \| Infinity` → `RiskValue` |
| `isFiniteRisk(v)` | `@trades/risk` | Type guard — narrows `RiskValue` to finite |
| `isGeminiApiResponse(v)` | `@types-gl/integrations` | Runtime guard for Gemini API JSON |
| `extractGeminiText(r)` | `@types-gl/integrations` | Text extractor for validated Gemini response |

---

## Views / Navigation

Views are `<div class="view …">` elements in `index.html`. Only one is active at a time.
Navigation is handled by `showView(viewName)` → `src/ui/views.ts`:

| `data-view` | Description |
|---|---|
| `dashboard` | Portfolio overview, charts, stats tables |
| `trades-list` | All trades with filtering and sorting |
| `credit-playbook` | Credit strategy tracker |
| `add-trade` | Multi-leg trade entry and editing form |
| `import` | OFX / Robinhood CSV / JSON import wizard |
| `settings` | API keys, fees, preferences |

---

## Charts (Apache ECharts via npm)

Charts use `.echarts-chart` DOM roots managed by `this.charts` and `src/ui/charts/echarts.ts`.
Update existing charts with `chart.setOption()` through `renderEChart(...)`; cleanup still
works through `this.destroyChart(chart)`.

| Chart key | Root ID | Type | Description |
|---|---|---|---|
| `monthlyPL` | `monthlyPLChart` | Bar | Monthly P&L |
| `cumulativePL` | `cumulativePLChart` | Line+fill | Cumulative P&L (range-filtered) |
| `strategy` | `strategyChart` | Horiz. bar | P&L by strategy |
| `winRate` | `winRateChart` | Pie/doughnut | Win rate by strategy |
| `commissionImpact` | `commissionImpactChart` | Bar | Commission drag vs gross P&L |
| `timeInTrade` | `timeInTradeChart` | Bar | Avg days held by strategy |
| `monteCarlo` | `monteCarloChart` | Multi-path line | 60-day Monte Carlo |
| `sharpeGauge` | `sharpeGaugeChart` | Gauge | Sharpe ratio |
| `sortinoGauge` | `sortinoGaugeChart` | Gauge | Sortino ratio |
| `tickerHeatmap` | `tickerHeatmap` | Heatmap | Ticker performance |

---

## Tables

Trade-facing tables use AG Grid Community through `src/ui/tables/ag-grid.ts`: All Trades,
Active Positions, Recent Closed Trades, Assigned Positions, and the Credit Playbook.
Column definitions use typed `ColDef<>` arrays with virtual scrolling, built-in sort/filter
UI, and column resize/reorder where appropriate. The shared wrapper sets `theme: 'legacy'`
because the app uses AG Grid's CSS theme files (`ag-grid.css` + `ag-theme-quartz.css`).

Merge-trade selection is still owned by `tradeMergeSelection`; the AG Grid selection
column only mirrors that Set so existing merge-group logic remains compatible. Payoff
diagrams render in the `#trades-grid-detail` panel below the grid instead of
pre-allocating one hidden detail row per trade.

Quote-backed table cells still register with the existing Finnhub quote refresh scheduler
from AG Grid cell renderers, so table migrations should preserve the
`activeQuoteEntries` / `creditPlaybookQuoteEntries` contract instead of fetching quotes
directly from grid callbacks.

---

## Import / Export

- **Import OFX**: `src/imports/ofx.ts` — broker OFX files
- **Import Robinhood CSV**: `src/imports/robinhood.ts`
- **Import JSON**: full database restore, validated by `parseStorageSchema()`
- **Export JSON**: full backup (trades + settings + mcpContext) → `src/database/persist.ts`
- **Export CSV**: `src/utils/export.ts`
- **Share Card**: 1080×1080px PNG → `src/ui/share-card.ts` (renders directly with Canvas API)

---

## AI Features

### Gemini AI Coach (`src/ai/gemini-agent.ts`)

- User-provided API key stored encrypted in `localStorage`
- Allowed models: `gemini-3.1-flash-lite`, `gemini-3.5-flash` (default), `gemini-3.1-pro-preview`
- Sends `mcpContext` snapshot + query to the Gemini generateContent endpoint
- Response shape validated with `isGeminiApiResponse()` before any field access
- Falls back to `LocalInsightsAgent` on any network/API failure
- Requires `AI_COACH_CONSENT_STORAGE_KEY` flag — gated behind explicit consent modal

### Local AI Coach (`src/ai/local-agent.ts`)

- Rule-based, fully offline
- Analyses open positions for risk, P&L summary, streak patterns, recommendations

---

## CSS Design System (`src/styles/app.css`)

CSS custom properties in layers:

1. **Primitive tokens** — `--color-teal-500`, `--color-red-400`, etc.
2. **Brand tokens** — `--color-brand-purple` and variants
3. **Semantic tokens** — `--color-background`, `--color-text`, `--color-primary`, etc.
4. **Dark mode** — `@media (prefers-color-scheme: dark)` or `.dark-mode` class overrides

Font: **Inter** (Google Fonts CDN). All sizing in `rem`. Layout: CSS Grid + Flexbox.

---

## External Dependencies

### Browser APIs

- **Canvas API** — browser-native Share Card PNG export

Import browser libraries through Vite/npm instead of CDN globals.

### npm (bundled)

- `ag-grid-community ^35.2.1` — trade table virtualization, sorting, filters, resize/reorder
- `echarts ^6.0.0` — dashboard, payoff, heatmap, and share-card charts
- `zod ^4.4.3` — storage payload and trade form validation schemas
- `typescript ^6.0.3` — type checking
- `vite ^8.0.10` — bundler and dev server
- `vite-plugin-checker ^0.13.0` — inline TS error overlay in dev
- `@types/node ^25.6.0` — Node type declarations for vite config

---

## Security Practices

- **Input sanitization**: all user input passes through `sanitizeString()` before use
- **Numeric validation**: `validateNumber()` enforces finite, range-bounded values
- **API key encryption**: keys encrypted with Web Crypto API before `localStorage` write
- **Typed API responses**: Gemini responses validated with `isGeminiApiResponse()` — no `as` casts on external JSON
- **CSP**: `Content-Security-Policy` meta tag in `index.html` — commented out for dev; enable for production
- **Security headers**: `X-Content-Type-Options`, `X-XSS-Protection` set in `<head>`
- **No eval / innerHTML with user data**: user-facing strings always via `textContent`
- **Referrer policy**: `strict-origin-when-cross-origin`

---

## MCP Server (`mcp/`)

Standalone Python package exposing the GammaLedger database as an MCP server for AI clients.

- **Language**: Python ≥ 3.10, managed with `uv`
- **Entry point**: `gammaledger_mcp.server:main` (console script `gammaledger-mcp`)
- **Dev workflow** (run from `mcp/`):
  ```bash
  uv sync --all-extras
  uv run python -m pytest
  uv run python -m ruff check src tests
  uv run mcp dev src/gammaledger_mcp/server.py
  ```
- `mcp/` has its own git history (nested repo) — commit separately from the main repo

### MCP Tools

| Tool | Description |
|---|---|
| `gammaledger_database_info` | File path, schema version, export date, trade count |
| `gammaledger_portfolio_summary` | Full snapshot — counts, P&L, Sharpe/Sortino, drawdown, streaks |
| `gammaledger_pl_breakdown` | Time-windowed P&L: total, realized, unrealized, YTD, MTD, 7d/30d/90d/1y |
| `gammaledger_open_positions` | Active positions with filters (ticker, strategy, dte_max, underwater_only) |
| `gammaledger_position` | Full leg-level detail for one trade by ID |
| `gammaledger_wheel_pmcc_positions` | Wheel/PMCC tracker: cost basis, premium history, coverage |
| `gammaledger_recent_closed_trades` | Most recently closed trades (by close date) |
| `gammaledger_strategy_breakdown` | Per-strategy stats: counts, wins, P&L, win rate |
| `gammaledger_ticker_exposure` | Per-ticker performance sorted by absolute P&L |
| `gammaledger_concentration_risk` | Top positions by capital at risk and collateral share |
| `gammaledger_expiring_positions` | Positions expiring within N days, sorted by DTE |
| `gammaledger_audit_risk` | Concentration, drawdown, expiring, underwater, Wheel/PMCC gaps |
| `gammaledger_audit_wheel_pmcc` | Coverage gaps, cost-basis vs strike, premium effectiveness |
| `gammaledger_search_trades` | Search all trades with filters |

### mcpContext

Built by `buildMCPContext()` (`src/integrations/mcp.ts`) and written into every saved JSON.
Contains: `portfolio`, `activePositions`, `wheelPmccPositions`, `recentClosedTrades`,
`strategyBreakdown`, `tickerExposure`, `underlyingBreakdown`, `concentration`,
`asOfDate`, `generatedAt`.

---

## Non-Negotiable Rules

These are hard constraints. Any plan review must flag violations before execution begins.

- **No React / Vue / UI frameworks in the current vanilla app** — only introduce framework code when executing the documented Phase 3 migration plan in `docs/superpowers/Feature_02__Vue3_Migration.md`
- **No new CDN `<script>` tags** without documenting them in this file
- **No `Infinity` as a financial sentinel** — use the `RiskValue` tagged union
- **No direct `localStorage`** — always use `safeLocalStorage` from `@core/storage`
- **No skipping `enrichTradeData()`** — always enrich before analytics or display
- **No reading `RUNTIME_TRADE_FIELDS` from raw storage** — recompute every time
- **No `as` casts on external JSON** — use `isGeminiApiResponse()` and Zod schemas
- **No module-level mutable state** — all state lives on the `GammaLedger` instance
- **New `localStorage` keys** → add to `APP_CONFIG.STORAGE` in `src/core/config.ts` and handle in `parseStorageSchema()`

---

## Common Gotchas

- `this.currentDate` is a **getter** — always returns the live date, not a stored property
- `RUNTIME_TRADE_FIELDS` are stripped before `localStorage` write but included in saved JSON for the MCP server
- `trade.status` can be `'Rolling'` (lifecycle-computed) — never assume only four statuses
- File System Access API is Chrome/Edge only — app falls back to `<a download>` gracefully; do not assume availability
- Gemini calls require the `AI_COACH_CONSENT_STORAGE_KEY` flag — gate every call
- Share Card renders directly with Canvas API; keep the export path free of CDN and iframe-based DOM capture dependencies for local release builds
- `index.html` references `/src/index.js` — Vite resolves this to `src/index.ts`; do not rename the HTML reference
- AG Grid tables use `theme: 'legacy'` — do not change; the app loads `ag-grid.css` + `ag-theme-quartz.css` directly
- ECharts: always update via `renderEChart(...)` so instances are reused; do not create new chart instances for existing chart roots
- Auto-status promotes covered Wheel/PMCC trades to `Open`; `Assigned` means shares held with no active short call. Use `hasAssignedInventory()` to ask "is there assigned inventory?" regardless of CC coverage — do not key consumer logic off `trade.status === 'Assigned'` alone. Trades with a manual `statusOverride` in storage ignore auto-derivation; users must clear the override (set status to "Auto" in the edit form) to get the new behavior.
- Realized P&L is leg-level: `calculateRealizedPL` / `summarizeLegRealization` count only terminated contract groups (closed, expired, or assigned short puts). An open short call's credit — even inside an assigned wheel — is not realized until the leg terminates. Monthly P&L bars must always sum to `stats.realizedPL`.

---

## TDD in GammaLedger

There is no automated test runner for the full app. Apply TDD discipline through:

1. **TypeScript as the first test** — write the type signature and interfaces; `npm run typecheck` must fail before implementation begins
2. **`tests/` JSON fixtures** — for calculation modules, add a fixture and validate the output before wiring to the UI
3. **Strict subproject checks** — new modules in strict dirs must pass `typecheck:strict` as the "green" gate
4. **Manual smoke test** — after execution, load sample data via the Import view and verify the affected view renders correctly

Red → (typecheck fails or fixture diverges) → Green → (typecheck passes, fixture matches) → Refactor.

---

## Development Guidelines

### Adding a New Feature

1. Create or extend the feature module in the relevant `src/` subdirectory
2. Export functions with a `this: SomeContext` interface (structural — only the fields it needs)
3. Add a thin delegator in `GammaLedger` (`src/index.ts`)
4. Import types from `@types-gl`; new shared types go in `src/types/`
5. Use `safeLocalStorage` — never raw `localStorage`
6. Run `npm run typecheck` before committing

### Backward Compatibility

- New `localStorage` keys → add to `STORAGE` in `APP_CONFIG` and handle through `parseStorageSchema()`
- `LEGACY_STORAGE_KEYS` keys must remain readable until fully migrated
- `trade.status` can be `'Rolling'` — never assume only four statuses

---

## Knowledge Graph (graphify)

The codebase has a persistent knowledge graph at `graphify-out/` built by
[graphify](https://github.com/safishamsi/graphify). It maps 2,037 nodes across
99 communities covering all source modules, types, docs, blog posts, images, and
config files.

### Querying the graph

```bash
graphify query "How does the AI coach work?"          # BFS — broad context
graphify query "Trace P&L calculation" --dfs           # DFS — specific path
graphify path "GammaLedger" "GeminiInsightsAgent"      # shortest path between nodes
graphify explain "RiskValue"                           # plain-language explanation
```

### Rebuilding

```bash
/graphify .              # full rebuild (all files)
/graphify . --update     # incremental — only new/changed files
```

### Key structural findings

| God Node | Edges | Role |
|---|---|---|
| `GammaLedger` | 439 | Central hub — imports every module, delegates to all features |
| `AGENTS.md` | 36 | Architecture documentation bridge |
| `EnrichedTrade` | 30 | Core runtime data type |
| `GeminiInsightsAgent` | 27 | AI coach class, bridges to app config |
| `NormalizedLeg` | 26 | Leg normalization type |

### Community map (top 20)

| # | Community | Nodes | Cohesion |
|---|---|---|---|
| 0 | GammaLedger Core Class | 396 | 0.005 |
| 1 | MCP Server & Database | 71 | 0.06 |
| 2 | Dashboard Charts | 67 | 0.06 |
| 3 | Trade Legs & Lifecycle | 57 | 0.07 |
| 4 | Gemini AI Agent | 56 | 0.06 |
| 5 | Finnhub Integration | 52 | 0.07 |
| 6 | App State & Config | 49 | 0.07 |
| 7 | Package Dependencies | 46 | 0.05 |
| 8 | Position Detail Panel | 45 | 0.09 |
| 9 | Options Glossary | 42 | 0.12 |
| 10 | AI Chat System | 40 | 0.08 |
| 11 | Schema & Validation | 38 | 0.10 |
| 12 | OFX Import | 34 | 0.11 |
| 13 | UI Views & Assets | 32 | 0.04 |
| 14 | Position Analytics | 32 | 0.09 |
| 15 | Type Definitions | 30 | 0.11 |
| 16 | Architecture Docs | 28 | 0.13 |
| 17 | Credit Playbook Render | 28 | 0.14 |
| 18 | Database Persistence | 27 | 0.10 |
| 19 | Blog Strategy Posts | 26 | 0.11 |

### Outputs

- `graphify-out/graph.html` — interactive visualization (open in browser)
- `graphify-out/GRAPH_REPORT.md` — full audit report with god nodes, surprising connections, suggested questions
- `graphify-out/graph.json` — raw graph data for programmatic use

## Graphify Knowledge graph

This repo uses Graphify to build a knowledge graph of the codebase. The graph is stored in `graphify-out/` and can be queried for relationships, explanations, and paths between nodes.

## Superpowers

Always create a new plan and spec for any new feature or major refactor. Plans and specs are stored in the following directories:

- **Plans:** `.claude/superpowers/plans/YYYY-MM-DD-{session-slug}.md`
- **Specs:** `.claude/superpowers/specs/YYYY-MM-DD-{session-slug}.md`

### Session Recovery

If a AI agent session dies mid-plan:
1. Open the `.plan.md` file in the project root
2. Find the first unchecked checkbox — that is where execution resumes
3. Run `/superpowers:execute-plan` pointing at the plan file; do not restart from brainstorm
