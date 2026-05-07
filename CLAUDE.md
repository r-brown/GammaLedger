# GammaLedger — Claude Code Context

## Project Overview

GammaLedger is a **privacy-first, local-first options trading journal and analytics dashboard**.
It is a single-page web application (SPA) built with **TypeScript + Vite**, compiled from
~60 ES modules into a single JS bundle served from `dist/`. No server-side component.

- **Live app**: https://gammaledger.com
- **GitHub**: https://github.com/r-brown/GammaLedger
- **License**: AGPLv3 (commercial license available separately)

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
  payoff/            # pricing, render, series, summary
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
docs/refactor/
  MIGRATION_PROGRESS.md  # Phase 1/2/3 log — authoritative open-items tracker
```

## Architecture

### Delegation Pattern — Not Pure ES Modules

All 59 feature modules export plain functions that use the **`.call(this, …)` delegation
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

**Consequence for all new code:** Feature modules still receive the full `GammaLedger`
instance as `this`. Every module's exported functions declare a `this: SomeContext`
interface (structural typing) covering only the subset of `GammaLedger` they need.
There is **no module-level state** — all mutable state lives on the class instance.

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

### Application Constants (`src/core/config.ts`)

All constants are exported from here and re-imported in `src/index.ts`. Key ones:

- `APP_CONFIG` — frozen object with `GEMINI`, `STORAGE`, `SHARE_CARD`, `PL_RANGES` sub-objects
- `RUNTIME_TRADE_FIELDS` — `Set<string>` of fields computed at runtime; never read back from raw storage as canonical values (but written into persisted JSON for the MCP server via `mcpContext`)
- `RUNTIME_LEG_FIELDS` — `Set<string>` of leg-level OFX-excluded fields
- `CURRENT_STORAGE_VERSION` — string `'2.5'`
- All `localStorage` key constants (e.g. `LOCAL_STORAGE_KEY`, `GEMINI_STORAGE_KEY`)

### TypeScript Configuration

Root `tsconfig.json` is `strict: false` (broad compatibility layer). Eight subdirectories
have their own `tsconfig.json` with `strict: true`, checked via `npm run typecheck:strict`:

```
src/calculations/tsconfig.json   strict: true
src/core/tsconfig.json           strict: true
src/trades/tsconfig.json         strict: true
src/utils/tsconfig.json          strict: true
src/ui/tsconfig.json             strict: true
src/imports/tsconfig.json        strict: true
src/integrations/tsconfig.json   strict: true
src/payoff/tsconfig.json         strict: true
```

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

## External Dependencies

### CDN (loaded in `index.html`, NOT bundled — no npm equivalent)

- **Chart.js** — `cdn.jsdelivr.net/npm/chart.js` (unversioned pin — L1 in MIGRATION_PROGRESS.md)
- **html2canvas 1.4.1** — `cdn.jsdelivr.net/npm/html2canvas@1.4.1/…` — Share Card PNG export

Guard CDN globals before use: `typeof Chart !== 'undefined'`, `window.html2canvas`.

### npm (build-time devDependencies only — no runtime npm deps)

- `typescript ^6.0.3` — type checking
- `vite ^8.0.10` — bundler and dev server
- `vite-plugin-checker ^0.13.0` — inline TS error overlay in dev
- `@types/node ^25.6.0` — Node type declarations for vite config

## Core Data Model

### Trade Object

```ts
// Minimal persisted shape: src/types/trade.ts — interface Trade
{
  id: string               // 'TRD-XXXX'
  ticker: string           // e.g. 'SPY'
  strategy: string         // one of 62 supported strategy names
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

`src/core/migration.ts` → `migrateSchema(raw)` is the mandatory guard that validates and
normalises any payload (including legacy formats) before it reaches the application.
Called by both `loadFromStorage()` and `parseStorageSchema()` (user JSON import).

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
| `migrateSchema(raw)` | `@core/migration` | Validate + normalise storage payload |
| `toRiskValue(n)` | `@trades/risk` | Convert `number \| Infinity` → `RiskValue` |
| `isFiniteRisk(v)` | `@trades/risk` | Type guard — narrows `RiskValue` to finite |
| `isGeminiApiResponse(v)` | `@types-gl/integrations` | Runtime guard for Gemini API JSON |
| `extractGeminiText(r)` | `@types-gl/integrations` | Text extractor for validated Gemini response |

## Charts (Chart.js via CDN)

All charts are `<canvas>` elements managed by `this.charts` Map.

| Chart key | Canvas ID | Type | Description |
|---|---|---|---|
| `monthlyPL` | `monthlyPLChart` | Bar | Monthly P&L |
| `cumulativePL` | `cumulativePLChart` | Line+fill | Cumulative P&L (range-filtered) |
| `strategy` | `strategyChart` | Horiz. bar | P&L by strategy |
| `winRate` | `winRateChart` | Doughnut | Win rate by strategy |
| `commissionImpact` | `commissionImpactChart` | Bar | Commission drag vs gross P&L |
| `timeInTrade` | `timeInTradeChart` | Bar | Avg days held by strategy |
| `monteCarlo` | `monteCarloChart` | Multi-path line | 60-day Monte Carlo |
| `sharpeGauge` | `sharpeGaugeChart` | Doughnut gauge | Sharpe ratio |
| `sortinoGauge` | `sortinoGaugeChart` | Doughnut gauge | Sortino ratio |
| `tickerHeatmap` | `tickerHeatmap` | DOM grid | Ticker heatmap (NOT Chart.js) |

Always call `this.destroyChart(chart)` before recreating a chart instance.

## Import/Export

- **Import OFX**: `src/imports/ofx.ts` — broker OFX files
- **Import Robinhood CSV**: `src/imports/robinhood.ts`
- **Import JSON**: full database restore, validated by `migrateSchema()`
- **Export JSON**: full backup (trades + settings + mcpContext) → `src/database/persist.ts`
- **Export CSV**: `src/utils/export.ts`
- **Share Card**: 1080×1080px PNG → `src/ui/share-card.ts` (requires `window.html2canvas`)

## AI Features

### Gemini AI Coach (`src/ai/gemini-agent.ts`)
- User-provided API key stored encrypted in `localStorage`
- Allowed models: `gemini-2.5-flash-lite`, `gemini-2.5-flash` (default), `gemini-2.5-pro`
- Sends `mcpContext` snapshot + query to the Gemini generateContent endpoint
- Response shape validated with `isGeminiApiResponse()` before any field access
- Falls back to `LocalInsightsAgent` on any network/API failure
- Requires `AI_COACH_CONSENT_STORAGE_KEY` flag — gated behind explicit consent modal

### Local AI Coach (`src/ai/local-agent.ts`)
- Rule-based, fully offline
- Analyses open positions for risk, P&L summary, streak patterns, recommendations

## CSS Design System (`src/styles/app.css`)

CSS custom properties in layers:
1. **Primitive tokens** — `--color-teal-500`, `--color-red-400`, etc.
2. **Brand tokens** — `--color-brand-purple` and variants
3. **Semantic tokens** — `--color-background`, `--color-text`, `--color-primary`, etc.
4. **Dark mode** — `@media (prefers-color-scheme: dark)` or `.dark-mode` class overrides

Font: **Inter** (Google Fonts CDN). All sizing in `rem`. Layout: CSS Grid + Flexbox.

## Security Practices

- **Input sanitization**: all user input passes through `sanitizeString()` before use
- **Numeric validation**: `validateNumber()` enforces finite, range-bounded values
- **API key encryption**: keys encrypted with Web Crypto API before `localStorage` write
- **Typed API responses**: Gemini responses validated with `isGeminiApiResponse()` — no `as` casts on external JSON
- **CSP**: `Content-Security-Policy` meta tag in `index.html` — commented out for dev; enable for production
- **Security headers**: `X-Content-Type-Options`, `X-XSS-Protection` set in `<head>`
- **No eval / innerHTML with user data**: user-facing strings always via `textContent`
- **Referrer policy**: `strict-origin-when-cross-origin`

## Development Guidelines

### Adding a new feature

1. Create or extend the feature module in the relevant `src/` subdirectory
2. Export functions with `this: SomeContext` interface (structural — only what it needs)
3. Add a thin delegator in `GammaLedger` (`src/index.ts`)
4. Import types from `@types-gl`; new shared types go in `src/types/`
5. Use `safeLocalStorage` — never raw `localStorage`
6. Run `npm run typecheck` before committing

### Rules

- Do NOT use React, Vue, or any UI framework (Phase 3 plan — see MIGRATION_PROGRESS.md)
- Do NOT add new CDN `<script>` tags without documenting them here
- Do NOT store `Infinity` as a financial sentinel in new code — use `RiskValue` tagged union
- Do NOT skip `enrichTradeData()` — always enrich before any analytics or display
- Do NOT read `RUNTIME_TRADE_FIELDS` from raw storage — they must be recomputed
- Do NOT access `localStorage` directly — use `safeLocalStorage`

### Backward-compatibility

- New `localStorage` keys → add to `STORAGE` in `APP_CONFIG` and handle in `migrateSchema()`
- `LEGACY_STORAGE_KEYS` keys must remain readable until fully migrated
- `trade.status` can be `'Rolling'` — never assume only 4 statuses

## Common Gotchas

- `RUNTIME_TRADE_FIELDS` stripped before `localStorage` write but included in saved JSON for MCP server
- `this.currentDate` is a **getter** — always returns live date, not a stored property
- Chart instances must be destroyed before recreation — call `this.destroyChart(key)` first
- File System Access API is Chrome/Edge only — app falls back to `<a download>` gracefully
- Gemini calls require `AI_COACH_CONSENT_STORAGE_KEY` flag check before sending
- Share Card requires `window.html2canvas` (CDN) — check before calling
- `index.html` references `/src/index.js` — Vite resolves this to `src/index.ts`; do not rename the HTML reference
- `trade.status` can be `'Rolling'` (lifecycle-computed) in addition to Open/Closed/Expired/Assigned

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
- `mcp/` has its own git history (nested repo) — commit separately

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
