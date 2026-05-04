# GammaLedger — Codex Context

## Project Overview

GammaLedger is a **privacy-first, local-first options trading journal and analytics dashboard**. It is a single-page web application (SPA) built with **pure vanilla JavaScript, HTML, and CSS** — no frameworks, no build system, no npm.

- **Live app**: https://gammaledger.com
- **GitHub**: https://github.com/r-brown/GammaLedger
- **License**: AGPLv3 (commercial license available separately)

## Running the App

No build step. Open `src/index.html` directly in a browser:

```bash
# Chrome / Edge / Firefox — just open the file
open src/index.html
```

Supported browsers: Chrome, Edge, Firefox (modern versions). Chrome/Edge required for the File System Access API (save/load `.json` database files directly).

## Repository Structure

```
src/
  app.js        # ~21 000 lines — all application logic (single file)
  index.html    # ~1 000 lines — SPA shell; all views defined here
  style.css     # ~4 700 lines — full design system with light/dark tokens
mcp/            # GammaLedger MCP server (Python, uv-managed)
  pyproject.toml
  src/
    gammaledger_mcp/
      server.py   # FastMCP server — tools, resources, prompts
      database.py # Lazy JSON DB reader with mtime auto-reload
      prompts/    # Registered MCP prompt templates
  tests/
assets/
  img/          # Marketing and screenshot images
blog/           # Blog content
CONTRIBUTING.md
README.md
```

### MCP server (`mcp/`)

The `mcp/` subdirectory contains a standalone Python package (`gammaledger-mcp`) that exposes the GammaLedger database as an MCP server for AI clients (Codex Desktop, Codex, etc.).

- **Language**: Python ≥ 3.10, managed with `uv`
- **Build backend**: `setuptools` + `setuptools-scm` (VCS versioning); `package_dir` maps `src/` → `gammaledger_mcp` in the wheel
- **Entry point**: `gammaledger_mcp.server:main` (console script `gammaledger-mcp`)
- **Dev workflow** (run from `mcp/`):
  ```bash
  uv sync --all-extras
  uv run python -m pytest
  uv run python -m ruff check src tests
  uv run mcp dev src/gammaledger_mcp/server.py
  ```
- Do **not** edit files under `mcp/src/` directly above the `gammaledger_mcp/` package directory.
- The `mcp/` folder retains its own git history (nested repo); treat it accordingly when committing.

#### MCP Tools

| Tool | Description |
|---|---|
| `gammaledger_database_info` | Metadata: file path, schema version, export date, trade count, mcpContext presence |
| `gammaledger_portfolio_summary` | Full portfolio snapshot — counts, P&L, Sharpe/Sortino, drawdown, streaks |
| `gammaledger_pl_breakdown` | Time-windowed P&L: total, realized, unrealized, YTD, MTD, 7d/30d/90d/1y |
| `gammaledger_open_positions` | Active positions with filters (ticker, strategy, dte_max, underwater_only) |
| `gammaledger_position` | Full leg-level detail for a single trade by ID |
| `gammaledger_wheel_pmcc_positions` | Wheel/PMCC tracker: cost basis, premium history, coverage status |
| `gammaledger_recent_closed_trades` | Most recently closed trades (sorted by close date) |
| `gammaledger_strategy_breakdown` | Per-strategy stats: counts, wins, P&L, win rate |
| `gammaledger_ticker_exposure` | Per-ticker performance sorted by absolute P&L |
| `gammaledger_underlying_breakdown` | Breakdown by instrument type (Stock/ETF/Index/Future) |
| `gammaledger_concentration_risk` | Top positions by capital at risk and share of total collateral |
| `gammaledger_expiring_positions` | Positions expiring within N days, sorted by DTE |
| `gammaledger_audit_risk` | Comprehensive risk audit: concentration, drawdown, expiring, underwater, Wheel/PMCC gaps |
| `gammaledger_audit_wheel_pmcc` | Wheel/PMCC audit: coverage gaps, cost-basis vs strike, premium effectiveness |
| `gammaledger_search_trades` | Search all trades (open, closed, expired, assigned) with filters |

#### MCP Resources

| URI | Description |
|---|---|
| `gammaledger://portfolio/summary` | Current portfolio metrics snapshot |
| `gammaledger://positions/active` | Current active positions |
| `gammaledger://positions/wheel-pmcc` | Wheel and PMCC tracker positions |
| `gammaledger://database/info` | Loaded database file metadata |

#### MCP Prompts

| Prompt | Description |
|---|---|
| `analyze_portfolio` | Comprehensive portfolio review — performance, risk, exposure |
| `risk_audit` | Risk-focused audit — concentration, drawdown, expiring, uncovered |
| `wheel_pmcc_review` | Deep-dive on Wheel/PMCC positions — premium, coverage, cost basis |
| `weekly_review` | Short weekly check-in — P&L delta, closures, expiring positions |
| `position_inspect` | Deep dive on one specific position by trade ID |

#### mcpContext

The app builds and writes `mcpContext` into the JSON database on every save (via `buildMCPContext()`). This pre-computed section is the authoritative data surface for the MCP server and includes: `portfolio`, `activePositions`, `wheelPmccPositions`, `recentClosedTrades`, `strategyBreakdown`, `tickerExposure`, `underlyingBreakdown`, `concentration`, `asOfDate`, `generatedAt`.

## Architecture

### Single-File JavaScript Design

The entire application lives in `src/app.js`. There is no module system, no bundler, and no transpilation. Everything is written in modern ES2020+ and loaded directly in the browser.

### Key Classes

| Class | Location | Purpose |
|---|---|---|
| `GammaLedger` | `app.js` line ~1299 | Main application class — instantiated as `window.app` |
| `LocalInsightsAgent` | `app.js` line ~20574 | Offline rule-based AI coach |
| `GeminiInsightsAgent` | `app.js` line ~20785 | Gemini AI integration; falls back to `LocalInsightsAgent` |

### Application Constants

Defined at the top of `app.js` in `APP_CONFIG` (frozen object) with backward-compatible standalone `const` aliases:

- `APP_CONFIG.GEMINI` — model names, endpoint, default temperature
- `APP_CONFIG.STORAGE` — all `localStorage` key names
- `APP_CONFIG.SHARE_CARD` — export image dimensions
- `APP_CONFIG.PL_RANGES` — time-range buttons (`['7D', 'MTD', '1M', '3M', 'YTD', '1Y', 'ALL']`)

Other top-level constants:
- `RUNTIME_TRADE_FIELDS` — `Set` of field names computed at runtime; never persisted to raw storage (but written into the saved JSON for MCP use)
- `RUNTIME_LEG_FIELDS` — `Set` of leg-level fields excluded from OFX serialisation
- `BUILTIN_SAMPLE_DATA` — IIFE that generates date-relative demo trades for first-run experience

### Data Storage

| Storage | Key / Mechanism | Contents |
|---|---|---|
| `localStorage` | `GammaLedgerLocalDatabase` | Full trade database (JSON string) |
| `localStorage` | `GammaLedgerGeminiConfig` | Gemini model/endpoint config |
| `localStorage` | `GammaLedgerGeminiSecret` | Encrypted Gemini API key |
| `localStorage` | `GammaLedgerGeminiMaxTokens` | Gemini max output tokens setting |
| `localStorage` | `GammaLedgerDisclaimerAcceptedAt` | Timestamp of disclaimer acceptance |
| `localStorage` | `GammaLedgerSidebarCollapsed` | Sidebar UI preference |
| `localStorage` | `GammaLedgerDefaultFeePerContract` | Default commission fee setting |
| `localStorage` | `GammaLedgerFinnhubRateLimit` | Finnhub API rate limit setting |
| `localStorage` | `GammaLedgerAICoachConsentAt` | AI coach consent timestamp |
| File System | JSON file via File System Access API | Portable database backup |

All data stays on the user's device. Nothing is sent to any server except optional AI (Gemini) and quote (Finnhub) API calls.

### Views / Navigation

Views are `<div class="view ...">` elements in `index.html`. Only one is active at a time. Navigation is handled by `showView(viewName)`:

| `data-view` | View Class | Description |
|---|---|---|
| `dashboard` | `dashboard-view` | Portfolio overview, charts, tables |
| `trades-list` | `trades-list-view` | All trades with filtering/sorting |
| `credit-playbook` | `credit-playbook-view` | Credit strategy tracker |
| `add-trade` | `add-trade-view` | Multi-leg trade entry form |
| `import` | `import-view` | OFX / JSON import wizard |
| `settings` | `settings-view` | API keys, fees, preferences |

### External Dependencies (CDN only)

- **Chart.js** — `https://cdn.jsdelivr.net/npm/chart.js` — all dashboard charts
- **html2canvas** — `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js` — Share Card PNG export
- **Google Fonts** — Inter typeface
- **Finnhub API** — optional live stock/option quotes (requires API key in Settings)
- **Google Gemini API** — optional AI coach (requires API key in Settings)

## Core Data Model

### Trade Object

```js
{
  id: 'TRD-XXXX',           // unique identifier
  ticker: 'SPY',
  strategy: 'Iron Condor',   // one of 62 supported strategy names
  status: 'Open' | 'Closed' | 'Expired' | 'Assigned' | 'Rolling',
  underlyingType: 'Stock' | 'ETF' | 'Index' | 'Future',
  openedDate: 'YYYY-MM-DD',  // derived from earliest leg executionDate
  closedDate: 'YYYY-MM-DD',  // derived from latest closing leg
  expirationDate: 'YYYY-MM-DD',
  exitReason: '',
  notes: '',                 // markdown supported
  legs: [ /* Leg[] */ ]
}
```

### Leg Object

```js
{
  id: 'TRD-XXXX-L1',
  orderType: 'BTO' | 'STO' | 'BTC' | 'STC',  // or action+side equivalent
  type: 'CALL' | 'PUT' | 'STOCK' | 'CASH',
  quantity: 1,
  multiplier: 100,           // 100 for standard equity options
  strike: 450,
  premium: 3.50,
  fees: 0.35,
  executionDate: 'YYYY-MM-DD',
  expirationDate: 'YYYY-MM-DD'
}
```

### Runtime Computed Fields

`enrichTradeData(trade)` computes and attaches these fields before any trade is used in analytics. All are listed in `RUNTIME_TRADE_FIELDS`:

- `pl`, `roi`, `weeklyROI`, `monthlyROI`, `annualizedROI`
- `tradeType`, `tradeDirection`, `lifecycleStatus`, `lifecycleMeta`
- `capitalAtRisk`, `maxRisk`, `maxRiskLabel`, `riskIsUnlimited`
- `totalFees`, `totalCredit`, `totalDebit`, `cashFlow`, `fees`
- `entryPrice`, `exitPrice`, `entryDate`, `exitDate`, `daysHeld`, `dte`
- `strikePrice`, `displayStrike`, `activeStrikePrice`, `quantity`, `multiplier`
- `primaryLeg`, `legsCount`, `openContracts`, `closeContracts`, `openLegs`, `rollLegs`
- `partialClose`, `rolledForward`, `autoExpired`
- `pmccShortExpiration`, `longExpirationDate`
- `tradeReasoning`, `wheelCoverage`, `shares`, `effectiveCostBasis`
- `marketValue`, `unrealizedPL`, `marketPriceSource`

Fields in `RUNTIME_TRADE_FIELDS` are recomputed on every load and written into the persisted JSON on save (to populate `mcpContext` for the MCP server). They must not be read back from raw storage as canonical values.

`RUNTIME_LEG_FIELDS` covers leg-level import metadata (`externalId`, `importGroupId`, `importSource`, `importBatchId`, `tickerSymbol`) that is excluded from OFX serialisation.

## Key Methods Reference

| Method | Description |
|---|---|
| `init()` | Bootstrap: load storage, set up event listeners, render dashboard |
| `updateDashboard()` | Recompute all stats and re-render all dashboard widgets |
| `calculateAdvancedStats()` | Core analytics engine — P&L, win rate, Sharpe, drawdown, etc. |
| `enrichTradeData(trade)` | Compute all runtime fields for a single trade |
| `calculatePL(trade)` | Compute realized/unrealized P&L from leg cash flows |
| `summarizeLegs(legs)` | Aggregate leg-level data (cash flow, contracts open/close) |
| `normalizeLeg(leg, index)` | Normalize raw leg data (order type, action, side) |
| `showView(viewName)` | Switch active view and update page title |
| `buildMCPContext()` | Build the `mcpContext` payload written to the saved JSON database |
| `sanitizeString(value, maxLength)` | Input sanitization for all user text |
| `validateNumber(value, options)` | Input validation for numeric fields |
| `validateDate(dateString)` | Input validation for date fields |
| `safeLocalStorage.getItem/setItem` | Safe localStorage wrappers with error handling |

## Strategies Supported

62 strategies including: Iron Condor, Iron Butterfly, Wheel, Poor Man's Covered Call (PMCC), Cash-Secured Put, Covered Call, Bull/Bear Put/Call Spreads, Straddle, Strangle, Collar, Diagonal Spread, Calendar Spread, Jade Lizard, Reverse Jade Lizard, and more. Full list in `this.creditPlaybookStrategyOptions` in the `GammaLedger` constructor.

## Import/Export

- **Import OFX**: Parses broker OFX files — extracts legs, dates, strikes, premiums, commissions
- **Import JSON**: Full database restore from GammaLedger backup file
- **Export JSON**: Full database backup (trades + settings + mcpContext)
- **Export OFX**: Standard OFX format for external tools
- **Share Card**: Renders a 1080×1080px PNG of the portfolio snapshot for social media (requires html2canvas CDN)

## AI Features

### Gemini AI Coach (optional)
- Requires user-provided Google Gemini API key (stored encrypted in `localStorage`)
- Default model: `gemini-2.5-flash`; allowed: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
- Configurable max output tokens (default 65536, stored in `GammaLedgerGeminiMaxTokens`)
- Sends portfolio snapshot + user query to `https://generativelanguage.googleapis.com/v1beta/models`
- Gated behind an explicit AI consent modal; API key never leaves the device

### Local AI Coach (fallback)
- Rule-based, works fully offline
- Analyses open positions for risk, P&L summary, and simple recommendations

## Charts (Chart.js)

All charts are `<canvas>` elements managed by `this.charts` map:

| Chart key | Canvas ID | Type | Description |
|---|---|---|---|
| `monthlyPL` | `monthlyPLChart` | Bar | Monthly P&L performance |
| `cumulativePL` | `cumulativePLChart` | Line | Cumulative P&L growth (range-filtered) |
| `strategy` | (inline) | Bar | P&L by strategy |
| `winRate` | (inline) | Bar/Doughnut | Win rate by strategy |
| `commissionImpact` | `commissionImpactChart` | Bar | Commission drag vs. gross P&L |
| `timeInTrade` | `timeInTradeChart` | Bar | Average days held by strategy |
| `monteCarlo` | `monteCarloChart` | Line | Monte Carlo 60-day projection |
| `sharpeGauge` | `sharpeGaugeChart` | Doughnut gauge | Sharpe ratio gauge |
| `sortinoGauge` | `sortinoGaugeChart` | Doughnut gauge | Sortino ratio gauge |
| `tickerHeatmap` | `tickerHeatmap` | DOM grid | Ticker performance heatmap (not a Chart.js canvas) |

Use `this.destroyChart(chart)` before recreating any chart instance to avoid Chart.js memory leaks.

## CSS Design System

`style.css` uses CSS custom properties organized in layers:

1. **Primitive tokens** — raw color values (`--color-teal-500`, `--color-red-400`, etc.)
2. **Brand tokens** — `--color-brand-purple` and variants
3. **Semantic tokens** — `--color-background`, `--color-text`, `--color-primary`, etc.
4. **Dark mode** — `@media (prefers-color-scheme: dark)` or `.dark-mode` class overrides semantic tokens

Font: **Inter** (Google Fonts). All sizing uses `rem`. Layout uses CSS Grid and Flexbox.

## Security Practices

- **Input sanitization**: all user input passes through `sanitizeString()` before use
- **Numeric validation**: `validateNumber()` enforces finite, range-bounded values
- **API key encryption**: Finnhub and Gemini API keys are encrypted with Web Crypto API before storage
- **CSP**: `Content-Security-Policy` meta tag is present (commented out in dev; enable for production)
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`
- **No eval / innerHTML with user data**: user-facing strings are set via `textContent`
- **Referrer policy**: `strict-origin-when-cross-origin`

## Development Guidelines

- **No build system** — edit files directly, refresh browser
- **No frameworks** — vanilla JS only; do not introduce React, Vue, etc.
- **No npm** — do not add `package.json` or node_modules
- **Single-file JS** — all logic stays in `app.js`; do not split into modules unless the project explicitly adopts ES modules
- **Test in Chrome, Firefox, and Edge** before submitting changes
- **Preserve backward compatibility** — legacy `localStorage` keys must continue to be migrated (see `LEGACY_STORAGE_KEYS`)
- **Follow existing code patterns** — class methods on `GammaLedger`, frozen constants at top of file
- **Disclaimer**: The app shows a disclaimer modal on first load (stored in `localStorage`). Do not remove it.

## Common Gotchas

- `RUNTIME_TRADE_FIELDS` are recomputed on load and written into the persisted JSON on save — the saved file intentionally contains them so the MCP server can read pre-computed values via `mcpContext`.
- `this.currentDate` is a **getter** (not a property) so it always returns the live current date
- Chart instances must be destroyed before recreation to avoid canvas reuse errors
- The File System Access API is only available in Chrome/Edge; the app falls back gracefully
- Gemini API calls require explicit user consent via the `AI_COACH_CONSENT_STORAGE_KEY` flag
- `safeLocalStorage` wrappers must be used instead of `localStorage` directly to handle quota and privacy-mode errors
- Trade `status` can be `Rolling` (in addition to Open/Closed/Expired/Assigned) — this is a lifecycle-computed value set by `enrichTradeData`
- The Share Card PNG export depends on the `html2canvas` CDN script; check for `window.html2canvas` before using
