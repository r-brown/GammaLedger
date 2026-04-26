# GammaLedger — Claude Code Context

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
  app.js        # ~20 000 lines — all application logic (single file)
  index.html    # ~1 000 lines — SPA shell; all views defined here
  style.css     # ~4 700 lines — full design system with light/dark tokens
assets/
  img/          # Marketing and screenshot images
blog/           # Blog content
CONTRIBUTING.md
README.md
```

## Architecture

### Single-File JavaScript Design

The entire application lives in `src/app.js`. There is no module system, no bundler, and no transpilation. Everything is written in modern ES2020+ and loaded directly in the browser.

### Key Classes

| Class | Location | Purpose |
|---|---|---|
| `GammaLedger` | `app.js` line ~1293 | Main application class — instantiated as `window.app` |
| `GeminiInsightsAgent` | `app.js` line ~20062 | Gemini AI integration; falls back to `LocalInsightsAgent` |
| `LocalInsightsAgent` | `app.js` line ~19851 | Offline rule-based AI coach |

### Application Constants

Defined at the top of `app.js` in `APP_CONFIG` (frozen object) with backward-compatible standalone `const` aliases:

- `APP_CONFIG.GEMINI` — model names, endpoint, default temperature
- `APP_CONFIG.STORAGE` — all `localStorage` key names
- `APP_CONFIG.SHARE_CARD` — export image dimensions
- `APP_CONFIG.PL_RANGES` — time-range buttons (`['7D', 'MTD', '1M', '3M', 'YTD', '1Y', 'ALL']`)

### Data Storage

| Storage | Key / Mechanism | Contents |
|---|---|---|
| `localStorage` | `GammaLedgerLocalDatabase` | Full trade database (JSON string) |
| `localStorage` | `GammaLedgerGeminiConfig` | Gemini model/endpoint config |
| `localStorage` | `GammaLedgerGeminiSecret` | Encrypted Gemini API key |
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
- **Google Fonts** — Inter typeface
- **Finnhub API** — optional live stock/option quotes (requires API key in Settings)
- **Google Gemini API** — optional AI coach (requires API key in Settings)

## Core Data Model

### Trade Object

```js
{
  id: 'TRD-XXXX',           // unique identifier
  ticker: 'SPY',
  strategy: 'Iron Condor',   // one of 60+ supported strategy names
  status: 'Open' | 'Closed' | 'Expired' | 'Assigned',
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

`enrichTradeData(trade)` computes and attaches these fields before any trade is used in analytics:

- `pl`, `roi`, `weeklyROI`, `monthlyROI`, `annualizedROI`
- `tradeType`, `tradeDirection`, `lifecycleStatus`, `lifecycleMeta`
- `capitalAtRisk`, `maxRisk`, `maxRiskLabel`, `riskIsUnlimited`
- `totalFees`, `totalCredit`, `totalDebit`, `cashFlow`
- `entryPrice`, `exitPrice`, `daysHeld`, `dte`
- `strikePrice`, `displayStrike`, `quantity`
- `partialClose`, `rolledForward`, `autoExpired`

Fields listed in `RUNTIME_TRADE_FIELDS` are recomputed on every load and must not be persisted to storage.

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
| `sanitizeString(value, maxLength)` | Input sanitization for all user text |
| `validateNumber(value, options)` | Input validation for numeric fields |
| `validateDate(dateString)` | Input validation for date fields |
| `safeLocalStorage.getItem/setItem` | Safe localStorage wrappers with error handling |

## Strategies Supported

60+ strategies including: Iron Condor, Iron Butterfly, Wheel, Poor Man's Covered Call (PMCC), Cash-Secured Put, Covered Call, Bull/Bear Put/Call Spreads, Straddle, Strangle, Collar, Diagonal Spread, Calendar Spread, Jade Lizard, Reverse Jade Lizard, and more. Full list in `this.creditPlaybookStrategyOptions` in the `GammaLedger` constructor.

## Import/Export

- **Import OFX**: Parses broker OFX files — extracts legs, dates, strikes, premiums, commissions
- **Import JSON**: Full database restore from GammaLedger backup file
- **Export JSON**: Full database backup (trades + settings)
- **Export OFX**: Standard OFX format for external tools
- **Share Card**: Renders a 1080×1080px PNG of the portfolio snapshot for social media

## AI Features

### Gemini AI Coach (optional)
- Requires user-provided Google Gemini API key (stored encrypted in `localStorage`)
- Default model: `gemini-2.5-flash`; allowed: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
- Sends portfolio snapshot + user query to `https://generativelanguage.googleapis.com/v1beta/models`
- Gated behind an explicit AI consent modal; API key never leaves the device

### Local AI Coach (fallback)
- Rule-based, works fully offline
- Analyses open positions for risk, P&L summary, and simple recommendations

## Charts (Chart.js)

All charts are `<canvas>` elements managed by `this.charts` map:

| Chart ID | Type | Description |
|---|---|---|
| `monthlyPLChart` | Bar | Monthly P&L performance |
| `cumulativePLChart` | Line | Cumulative P&L growth (range-filtered) |
| `strategyChart` | Bar | P&L by strategy |
| `winRateChart` | Bar/Doughnut | Win rate by strategy |
| `commissionImpactChart` | Bar | Commission drag vs. gross P&L |
| `timeInTradeChart` | Bar | Average days held by strategy |
| `monteCarloChart` | Line | Monte Carlo 60-day projection |
| `tickerHeatmap` | DOM grid | Ticker performance heatmap |

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

- `RUNTIME_TRADE_FIELDS` are recomputed on load — and overwritten in the storage on the next save to be used later with GammaLedger MCP integration.
- `this.currentDate` is a **getter** (not a property) so it always returns the live current date
- Chart instances must be destroyed before recreation to avoid canvas reuse errors
- The File System Access API is only available in Chrome/Edge; the app falls back gracefully
- Gemini API calls require explicit user consent via the `AI_COACH_CONSENT_STORAGE_KEY` flag
- `safeLocalStorage` wrappers must be used instead of `localStorage` directly to handle quota and privacy-mode errors
