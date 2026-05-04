# Feature Inventory

Source: `src/index.html` (1,011 lines, all views declared inline) + `src/app.js`. All citations `app.js:LINE` or `index.html:LINE`.

This document is the canonical screen-by-screen specification for the React/TypeScript rebuild. **Feature parity** in the new system means every item listed here works equivalently.

---

## 1. Top-level views (sidebar navigation)

Sidebar: `<aside class="sidebar">` (index.html:112). Six `<button class="nav-item" data-view="...">` (index.html:120–143). Switching: `showView(viewName)` (app.js:7056) toggles `.active` on nav item + matching `<div class="view {name}-view">`, updates `#page-title`.

| Slug | Purpose | Key elements |
|---|---|---|
| `dashboard` | Portfolio command center | 12 KPI cards, 8 Chart.js charts, ticker heatmap, 3 tables (active/recent-closed/wheel-pmcc) |
| `trades-list` | Full ledger | 17-column sortable table, filter panel, merge tooling, inline payoff diagrams |
| `credit-playbook` | Leg-level view (beta) | 6 metric cards, 17-column leg table, 4 filters |
| `add-trade` | Create / edit | Multi-leg builder form |
| `import` | OFX/CSV import | File picker + drag-and-drop dropzone |
| `settings` | API keys, fees, AI | Two `<section class="settings-section">` groups |

### Dashboard tables/charts (cite once, referenced often)
- **Active Positions table** `#active-positions-table` — Ticker, Strategy, Strike, Current Price, DTE, Max Risk, Notes
- **Recent Closed Trades table** `#recent-trades-table` — last closed; Days Held, P&L, ROI, Weekly ROI
- **Wheel/PMCC Tracker** `#assigned-positions-table` — 14 cols incl. Eff. Cost Basis, Market Value, Unrealized G/L; status filter `#assigned-positions-status-filter` (Open/Closed)
- **Cumulative P&L range buttons** — `7D / MTD / 1M / 3M / YTD / 1Y / ALL` (state persisted in instance, default `'ALL'`)

### KPI cards (12 total)
Row 1: `#realized-pl`, `#unrealized-pl`, `#collateral-at-risk`, `#active-positions`, `#assigned-positions`, `#win-rate`. Row 2: `#profit-factor`, `#total-roi`, `#max-drawdown`, `#avg-win-loss`, `#expectancy`, `#sharpe-ratio`.

---

## 2. Modals / overlays

| Modal | DOM | Trigger | Storage gate | Dismiss |
|---|---|---|---|---|
| Disclaimer | `#disclaimer-banner` (index.html:54) | First load if absent | `GammaLedgerDisclaimerAcceptedAt` | "Agree" only — blocks app |
| AI Coach Consent | `#ai-coach-consent` (index.html:84) | Open AI chat with Gemini configured | `GammaLedgerAICoachConsentAt` | Cancel / overlay click / Escape |
| AI Chat panel | `#ai-chat` (index.html:942) | `#ai-chat-toggle` | (consent gated) | `#ai-chat-close`, drag-resize via `#ai-chat-resize-handle` |
| Share Card render | `#share-card-root` off-screen (index.html:971) | `#share-portfolio-card` header btn | — | Auto-download then hide |
| Trade Payoff Diagram | inline `.trade-detail-row` | Click row or `.action-btn--pl` | — | Click row again |
| Browser Compat Notice | `#compatibility-notice` (index.html:187) | `'showOpenFilePicker' in window === false` | — | `#dismiss-fs-notice` |

**No toast/snackbar system.** Errors use `alert()`. Success = filename update + `#unsaved-indicator` clears.

---

## 3. Charts (Chart.js, all destroy-before-recreate)

| Canvas ID | Type | Source method |
|---|---|---|
| `monthlyPLChart` | bar | `updateMonthlyPLChart()` (app.js:14142) |
| `cumulativePLChart` | line | `updateCumulativePLChart()` (app.js:14214) — range-filtered |
| `strategyChart` | horizontal bar | `updateStrategyPerformanceChart()` (app.js:14393) |
| `winRateChart` | doughnut | `updateWinRateByStrategyChart()` (app.js:14456) |
| `commissionImpactChart` | bar | `updateCommissionImpactChart()` (app.js:10666) — gross vs net vs fees |
| `timeInTradeChart` | bar | `updateTimeInTradeChart()` (app.js:10818) — winners vs losers |
| `monteCarloChart` | line | `updateMonteCarloChart()` (app.js:10902) — 400×60 sims, p10/p25/p50/p75/p90 bands |
| `sharpeGaugeChart` / `sortinoGaugeChart` | doughnut gauges | `renderRatioGauge()` — currently hidden in HTML |
| `share-card-cumulative-chart` | line (880×360) | Off-screen for PNG export |
| `trade-pl-{id}` (dynamic) | line | `renderTradePayoffChart()` (app.js:15152) |

**Ticker heatmap** (`#tickerHeatmap`, app.js:10784) — DOM grid, NOT Chart.js. Up to 12 cards; bg color teal `rgba(31,184,205,α)` for profit, red `rgba(180,65,60,α)` for loss; α scales with |P&L| / max.

---

## 4. Trade entry / editing flow

Form `#add-trade-form` (index.html:445).

### Trade-level fields
| Field | DOM ID | Behaviour |
|---|---|---|
| Ticker | `#ticker` | required; `input` → `updateTickerPreview()`; `change/blur` → Finnhub price autofill into all open legs |
| Underlying Type | `#underlyingType` | `change` → `applyUnderlyingTypeToLegMultipliers()` |
| Strategy | `#strategy` | required; 60+ options, 4 starred (CSP, Covered Call, PMCC, Wheel) |
| Trade Status | `#tradeStatus` | empty = auto; else manual override (`statusOverride`) |
| Exit Reason | `#exitReason` | 10 options |
| Notes | `#notes` | textarea, free text |

### Leg builder (`#trade-legs-container`)
Each leg: `addLegFormRow()` (app.js:4155). Fields use `data-leg-field`:
- `orderType` (BTO/STO/BTC/STC), `type` (CALL/PUT/STOCK/CASH — STOCK/CASH hide Strike+Expiration), `quantity`, `executionDate`, `expirationDate`, `strike`, `premium`, `fees`, `multiplier` (hidden behind "Override" toggle), `underlyingPrice`.
- Per-leg actions: "Close Leg" (creates pre-filled BTC/STC mirror, app.js:4373), "Remove Leg" (app.js:4365).
- New leg fees pre-filled from `defaultFeePerContract × quantity` (app.js:4318).

### Submit
`handleTradeSubmit()` reads via `data-leg-field` selectors → `enrichTradeData()` → push to `this.trades` → `saveToStorage()` → re-render. Synchronous, optimistic.

### Edit
`editTrade(id)` populates form + calls `renderLegForms(trade.legs)` + `showView('add-trade')` (app.js:16528).

---

## 5. Import / Export

### OFX import
- Trigger: `#import-ofx-btn` → `#import-ofx-input[accept=".ofx,.OFX"]` (index.html:939) **OR** drag-drop on `#import-dropzone`.
- Pipeline: `importOfxFile` → `importOfxContent` → `parseOfx` (hand-rolled, `DOMParser` over SGML-stripped XML) → `buildOfxImportPayload` → `applyOfxImportResult` (app.js:18444+).
- Field mappings: see `INTEGRATIONS.md §3` for full OFX-tag-to-leg-field table.
- Auto-merge for Wheel/PMCC same-day BTC+STO rolls. Dedup by `externalId`.
- UI: results in `#import-summary` + `#import-log`. "Review Merge Opportunities" jumps to All Trades with merge panel open.
- **No user-visible field-mapping wizard** — automatic.

### Robinhood CSV import
- Trigger: `#import-robinhood-btn` → `#import-robinhood-input[accept=".csv,.CSV"]` (index.html:940) OR `.csv` drag-drop.
- Pipeline: `importRobinhoodCsvFile` → `importRobinhoodCsvContent` (app.js:18506).

### JSON Save / Load
- `#save-database-btn` → `saveDatabase()` → FSA `showSaveFilePicker` (`gammaledger.json`) or `<a download>` fallback.
- `#load-database-btn` → `loadDatabase()` → `showOpenFilePicker` or `#file-input` fallback → `processLoadedData()`.
- `#new-database-btn` → confirm if unsaved → reset.

### CSV export
- `#export-csv` → `exportToCSV()` → `options_trades_enhanced.csv`, **25 columns**: Ticker, Strategy, Trade Type, Strike, Defined Risk Width, Qty, Exit Price, DTE, Days Held, Entry Date, Expiration Date, Exit Date, Max Risk, P&L, ROI %, Weekly ROI %, Monthly ROI %, Annual ROI %, Status, Stock Price at Entry, Fees, Max Risk Override, IV Rank, Notes, Exit Reason. Exports **all** trades (not filtered view).

### OFX export
**Not implemented** in current code. (CLAUDE.md mentions it but the code has no emitter.)

### Share Card PNG
- `#share-portfolio-card` → `downloadShareCard()` (app.js:12970).
- Renders off-screen `#share-card-root` (1080×1080), uses `canvas.toDataURL('image/png')` directly (NOT html2canvas, despite CDN being loaded).
- File: `gammaledger-portfolio-YYYYMMDD.png`.
- Content: heading, date, range label, 4 metric tiles (Realized P&L, Win Rate, Profit Factor, Total ROI), cumulative P&L chart, footer.

---

## 6. AI features

### `LocalInsightsAgent` (app.js:20805) — rule-based fallback
Surfaces:
- Greeting: open count, closed count, realized P&L
- `buildPerformanceSummary()`: count, P&L, win rate, profit factor, total ROI
- `buildRiskHeadline()`: total capital at risk; largest position by ticker + % share
- `buildStrategyHeadline()`: top ticker by P&L
- `buildCoachingHighlight()`: behavioral flags (losers held ≥2d longer than winners; win rate <45% with ≥5 trades)

Any text query returns the same canned multi-section response.

### `GeminiInsightsAgent` (app.js:21016) — wraps Local as fallback
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- API key sent as both `?key=` query and `x-goog-api-key` header
- Models: `gemini-2.5-flash-lite | gemini-2.5-flash | gemini-2.5-pro`
- Temperature **hardcoded 0.25**; max tokens default 65536, configurable
- 8-turn conversation history; 120s `AbortController` timeout
- Three quick prompts: Portfolio health, Risk check, Strategy ideas (each with structured prompt template, app.js:21116–21170)
- **Payload**: full `buildMCPContext()` JSON sent as `# PORTFOLIO DATA` block
- Falls back to `LocalInsightsAgent` on API error (prepends error message)

### Chat panel
`#ai-chat-history` div in `#ai-chat-panel`. Each message = `.ai-chat__message`. Markdown links like `[Settings](#settings)` rewritten to `showView('settings')` calls (app.js:6275). Subtitle `#ai-chat-subtitle` shows "Local Coach" or "Gemini Coach".

---

## 7. Settings

### API Keys section (index.html:842)
**Finnhub** (`#finnhub-controls`):
- `#finnhub-api-key` (password type), `#finnhub-save`, `#finnhub-status`
- `#finnhub-rate-limit` (1–300, default 60), `#finnhub-rate-save`, `#finnhub-rate-reset`

**Gemini** (`#gemini-controls`):
- `#gemini-api-key`, `#gemini-save`, `#gemini-clear`, `#gemini-status`
- `#gemini-model` select (3 options)
- `#gemini-max-tokens` (1024–1000000, step 1024, default 65536), `#gemini-tokens-save`, `#gemini-tokens-reset`

### Trade Entry Defaults
**Default Fee Per Contract** (`#default-fees-controls`):
- `#default-fee-per-contract`, `#default-fee-save`, `#default-fee-clear`, `#default-fee-status`

### Display Preferences
- Sidebar collapsed state (no Settings UI; `#sidebar-toggle`); persisted to `GammaLedgerSidebarCollapsed`; ignored on mobile (≤768px).

### Data Management
- New / Save / Load Database — buttons live in the header, not Settings.

---

## 8. First-run / empty states

1. **Disclaimer modal** — every load until `GammaLedgerDisclaimerAcceptedAt` is set; full-screen, blocks interaction.
2. **Sample data seeding** — `loadDefaultDatabase()` (app.js:1730) loads `BUILTIN_SAMPLE_DATA` (~22 trades, dates relative to `new Date()`) when no DB exists; named "Sample Database (Built-in)".
3. **AI consent** — first AI chat with Gemini configured triggers `showAICoachConsent()`; pending action stored in `consent.pendingAction` and run after agree.
4. **Browser compat banner** — shown when File System Access API absent.
5. **Empty chart states** — heatmap: "Add more closed trades to see per-ticker performance." Monte Carlo summary: "Need more closed trades to run projections." Each chart destroys instance instead of rendering empty.

---

## 9. Keyboard / drag-drop / file pickers

### Keyboard
- Trade row: `Enter`/`Space` toggles payoff diagram (app.js:15108).
- AI consent: `Escape` dismisses (app.js:12216).
- All input "Save" buttons: `Enter` keydown also triggers save (Finnhub key, Gemini key, max tokens, rate limit, fee).
- **No global shortcuts** (no Ctrl+S etc.).

### Drag-drop
`#import-dropzone` (app.js:17422): `.is-drag-over` class on enter/over; on drop reads `event.dataTransfer.files[0]`, routes by extension (`.ofx/.qfx` → OFX, `.csv` → Robinhood). Unknown → `alert()`.

### File pickers
| Button | Input | Accept | API |
|---|---|---|---|
| Save Database | — | `.json` | FSA or `<a download>` |
| Load Database | `#file-input` | `.json` | FSA or `<input type="file">` |
| Import OFX | `#import-ofx-input` | `.ofx,.OFX` | `<input type="file">` |
| Import Robinhood | `#import-robinhood-input` | `.csv,.CSV` | `<input type="file">` |

### AI chat resize
`#ai-chat-resize-handle` `pointerdown` → `pointermove`/`pointerup`/`pointercancel` on `document` (app.js:6538).

---

## 10. Mobile / responsive

### CSS breakpoints (in style.css)
- 600px (mobile upper) — 1433/2152/2171 lines
- 768px (tablet lower) — also JS sidebar override (app.js:12385)
- 900px (chart grid stacks)
- 980px / 1024px / 1200px (desktop variants)

### Behavior
- **Sidebar always expanded ≤768px** (collapse pref ignored).
- **Stackable tables**: at ≤768px each `<td>` becomes block with `data-label` rendered as `::before` pseudo-element ("label: value" layout).
- **Chart wrappers**: `.chart-responsive-wrapper--tall` (280px), `--medium` (220px), `--short` (180px), `--compact` (150px) with `responsive: true, maintainAspectRatio: false`.
- **AI panel**: capped `calc(100vw - 24px)` ≤768px.

### Does NOT degrade gracefully
- Share card always 1080×1080 (off-screen).
- Trades merge panel: horizontal scroll, not optimized.
- 17-column tables stack vertically — very long rows on mobile.

---

## 11. Design system summary

### Token layers (style.css)
1. **Primitives** (lines 5–31): named scales `--color-cream-50` … `--color-charcoal-800`, teal/red/orange families, `--color-brand-purple: #5900c6`, trend up/down.
2. **Semantic** (lines 67–101): `--color-background`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-primary`, `--color-border`, `--color-error`, `--color-success`, `--color-warning`, `--color-info`, `--color-focus-ring`, `--color-card-border`.
3. **Dark mode**: `@media (prefers-color-scheme: dark)` (line 174) AND `[data-color-scheme="dark"]` (line 243). Both reassign semantic tokens.

### Typography
- Body: Inter (Google Fonts variable, opsz 14–32, wght 100–900) + Roboto/Geist/system-ui fallbacks.
- Mono: Berkeley Mono / ui-monospace / Menlo / Monaco / Consolas.
- Scale: xs=11 / sm=12 / base=14 / lg=16 / xl=18 / 2xl=20 / 3xl=24 / 4xl=30.
- Weights: 400 / 500 / 550 / 600.

### Spacing
0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 px (`--space-0` … `--space-32`).

### Radius
sm=6, base=8, md=10, lg=12, xl=16, 2xl=20, full=9999.

### Animation
fast=150ms, normal=250ms, ease `cubic-bezier(0.16, 1, 0.3, 1)`.

### Tailwind mapping (for React rebuild)
| Use | Light | Dark |
|---|---|---|
| Page bg | cream-50 #fcfcf9 | charcoal-700 #1f2121 |
| Surface | cream-100 #fffffe | charcoal-800 #262828 |
| Primary | teal-500 #21808d | teal-300 #32b8c6 |
| P&L positive | #16a34a | #22c55e |
| P&L negative | #dc2626 | #f87171 |

---

## 12. UX patterns

- **Autosave**: every mutation → `saveToStorage()` (synchronous to localStorage). The JSON file save is a separate action.
- **Unsaved indicator**: `#unsaved-indicator` (●) toggles on edits/imports, clears on file save.
- **Optimistic updates**: in-memory then save then re-render. No async backend confirmation.
- **Confirmations**: `window.confirm()` for delete trade, manual merge, new database with unsaved changes.
- **Loading**: `#loading-indicator` "Saving…/Loading…" during async file ops.
- **Cumulative P&L range** persists in instance, drives heatmap + share card chart too.
- **Debounced ticker autofill**: `#ticker` change/blur → Finnhub price → all open legs' `underlyingPrice`. Rate-limited via Finnhub queue.
- **Row keyboard a11y**: `tabindex="0"`, `aria-expanded`, `aria-controls` on trade rows.
- **Sort indicators**: `.sortable[data-sort]` headers; `this.currentSort = { key, direction }`.
- **DTE warning thresholds**: `expirationWarningDays: 20`, `expirationCriticalDays: 10` (app.js:1422).
- **Trade merge** (All Trades view): `#trades-merge-toggle` reveals checkbox column; `#trades-merge-btn` requires ≥2 selected, same ticker; multi-line `confirm()`.
- **Import merge** (Import view): `#import-merge-count` badge; `#import-merge-groups` allows pre-commit selection.

---

## 13. Trades list — sorting & filtering

### Filters (`#trades-filters-panel`, toggle `#toggle-filters`)
- Strategy multi-select `#filter-strategy` (Ctrl/Cmd-click)
- Status multi-select `#filter-status`
- Free-text `#search-ticker` — searches Ticker, Strategy, Notes (app.js:6217)

### Sortable columns (17 + Actions)
Ticker, Strategy, Strike, Qty, Entry Date, Expiration Date, DTE, Exit Date, Days Held, Max Risk, P&L, ROI, Weekly ROI, Monthly ROI, Annual ROI, Status, Actions. Click header → `sortTrades(key)` (app.js:6229).

### Per-row actions
- `.action-btn--pl` — toggle inline payoff diagram
- `.action-btn--edit` — go to add-trade with form populated
- `.action-btn--delete` — confirm + remove

---

## 14. Credit Playbook (beta)

Leg-level view. `initializeCreditPlaybookControls` → `updateCreditPlaybookView` → `renderCreditPlaybookMetrics` + `renderCreditPlaybookTableFromLegPairs` (app.js:8734).

### Metrics (6 cards, `#credit-playbook-metrics`)
Positions, Net Premium, Realized P&L, Win Rate, Active Risk, Avg DTE.

### Filters
- `#credit-playbook-status-filter` — All / Active / Closed (pills)
- `#credit-playbook-horizon-filter` — All time / 7d / 30d / 90d / 365d / MTD / YTD
- `#credit-playbook-strategy-filter` — full strategy list
- `#credit-playbook-symbol-filter` — free-text

### Table columns (17)
Ticker, Strategy, Type, Strike Price, Status, Contracts, Price/Contract, Fees, Premium, P&L, ROI, Current Price (Finnhub), Entry Date, Expiration Date, DTE, Exit Date, Days Held.
