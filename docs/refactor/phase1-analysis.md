# Phase 1 — Codebase Analysis

> Read-only inventory of `src/` produced before any refactor work begins.
> Source files surveyed: `src/app.js` (21,440 LOC), `src/index.html` (1,011 LOC),
> `src/style.css` (4,731 LOC, content not analyzed in this pass).

---

## 1. Top-level structure of `src/app.js`

The file is **not** a flat collection of free functions. It is structured as:

1. **Lines 1–115** — `const APP_CONFIG` and 25 derived legacy constants (storage keys, share-card sizing, default model/temperature, etc.).
2. **Lines 59–115** — Two `Set`-typed runtime field whitelists (`RUNTIME_TRADE_FIELDS`, `RUNTIME_LEG_FIELDS`) used to strip transient props before persistence.
3. **Lines 117–1334** — `BUILTIN_SAMPLE_DATA` — a self-invoked IIFE that returns the demo dataset injected on first run.
4. **Lines 1336–20803** — `class GammaLedger { … }` — the monolith. ~360 instance methods plus a `constructor`, `cleanup`, a `get currentDate()` accessor, and the `safeLocalStorage` arrow-function table assigned as a class field.
5. **Lines 20805–21014** — `class LocalInsightsAgent` — non-LLM fallback for the AI coach (~12 methods).
6. **Lines 21016–21389** — `class GeminiInsightsAgent` — Gemini-backed coach (~16 methods).
7. **Lines 21419–21449** — DOM-ready bootstrap and global `error`/`unhandledrejection`/`beforeunload` handlers.

Total method count across the three classes: **~462**.
There is no module-level `let`/`var`. All mutable state lives on `this` inside `GammaLedger`. There are 26 top-level `const` declarations (config + sample data only).

---

## 2. Module-level constants (lines 1–115)

| Constant | Line | Purpose |
| --- | --- | --- |
| `APP_CONFIG` | 2 | Frozen root config (Gemini, storage keys, share-card, P&L ranges). |
| `DEFAULT_GEMINI_MODEL`, `GEMINI_ALLOWED_MODELS`, `DEFAULT_GEMINI_TEMPERATURE`, `DEFAULT_GEMINI_ENDPOINT` | 36–39 | Gemini API defaults. |
| `GEMINI_STORAGE_KEY`, `GEMINI_SECRET_STORAGE_KEY` | 40–41 | Gemini config + encrypted secret keys. |
| `DISCLAIMER_STORAGE_KEY`, `AI_COACH_CONSENT_STORAGE_KEY`, `SIDEBAR_COLLAPSED_STORAGE_KEY` | 42–44 | UI consent / preference keys. |
| `LOCAL_STORAGE_KEY`, `LEGACY_STORAGE_KEY`, `LEGACY_STORAGE_KEYS` | 45–47 | Primary database key + four legacy keys to migrate from. |
| `SHARE_CARD_*` (4 consts) | 48–51 | Share-card export sizing/ratios. |
| `CUMULATIVE_PL_RANGES` | 52 | `['7D','MTD','1M','3M','YTD','1Y','ALL']`. |
| `DEFAULT_FEE_STORAGE_KEY`, `FINNHUB_RATE_LIMIT_STORAGE_KEY`, `GEMINI_MAX_TOKENS_STORAGE_KEY` | 53–55 | Per-feature settings storage keys. |
| `DEFAULT_FINNHUB_RATE_LIMIT` (60), `DEFAULT_GEMINI_MAX_TOKENS` (65536) | 56–57 | Numeric defaults. |
| `RUNTIME_TRADE_FIELDS`, `RUNTIME_LEG_FIELDS` | 59, 109 | Field-name `Set`s used to drop transient props on save. |
| `BUILTIN_SAMPLE_DATA` | 117 | IIFE returning seed trades + assignment data. |

All are read-only after declaration. None are mutated at runtime.

---

## 3. Instance-level state (`this.*` on `GammaLedger`)

Initialized in the constructor at lines 1336–1573. The constructor sets ~50 distinct properties; another ~110 are added lazily in methods (chart instances, intermediate caches, DOM element handles).

Notable groups:

| Group | Properties | Purpose |
| --- | --- | --- |
| **Core data** | `trades`, `latestStats`, `currentFilteredTrades`, `currentSort`, `sortDirection` | The entire portfolio + table view state. |
| **Files / persistence** | `currentFileHandle`, `currentFileName`, `hasUnsavedChanges`, `supportsFileSystemAccess` | File System Access API state and unsaved indicator. |
| **Editing** | `currentEditingId` | ID of the trade currently being edited. |
| **Charts** | `charts` (object map), `tradeDetailCharts` (Map) | Active Chart.js instances for dashboard + per-trade payoff charts. |
| **Imports** | `importControlsInitialized`, `importLog`, `importSummary`, `importMergeSelection`, `tradeMergeSelection`, `tradesMergeInitialized`, `tradesMergePanelOpen` | Import / merge UI state. |
| **AI chat** | `aiAgent`, `aiChatMessages`, `aiChatSessionId`, `aiChatPendingRequest`, `aiChatOpen` | AI coach session state. |
| **Quotes** | `activeQuoteEntries`, `quoteRefreshIntervalId`, `autoRefreshIntervalMs`, `quoteRefreshKeys`, `quoteRefreshCursor` | Background ticker quote scheduling. |
| **Finnhub** | `this.finnhub` (struct: apiKey, encryptionKey, cache, cacheTTL, outstandingRequests, rateLimitQueue, maxRequestsPerMinute, timestamps, statusTimeoutId, lastStatus, elements) | Finnhub adapter state. |
| **Gemini** | `this.gemini` (struct: apiKey, encryptionKey, model, maxOutputTokens, statusTimeoutId, lastStatus, pendingStatus, elements) | Gemini adapter state. |
| **Credit playbook** | `creditPlaybookStatus`, `creditPlaybookStrategy`, `creditPlaybookHorizon`, `creditPlaybookSymbol`, `creditPlaybookSort`, `creditPlaybookEntries`, `creditPlaybookNeedsRefresh`, `creditPlaybookInitialized`, `creditPlaybookStrategyOptions` | Credit-strategy view filters + cached entries. |
| **Disclaimer / consent** | `disclaimerBanner`, `disclaimerFadeMs`, `aiCoachConsent` | First-run modal state. |
| **Sidebar** | `sidebarState` | Collapse/expand state + media-query handle. |
| **Share card** | `shareCard` (struct with element refs + chart) | Snapshot card export state. |
| **Other** | `cumulativePLRange`, `assignedPositionsStatusFilter`, `defaultFeePerContract`, `positionHighlightConfig` | Misc UI/business defaults. |
| **Accessor** | `get currentDate()` (line 1531) | Always returns `new Date()`. |
| **Field** | `safeLocalStorage` (line 1538) | Object literal of three error-handled wrappers around `localStorage`. |

There is **one** global write: `window.tracker = new GammaLedger()` on line 21420. Everything else funnels through `window.tracker.*`.

---

## 4. localStorage keys

All keys are declared as constants in section 2 above. Read/write call sites:

| Key constant | Literal | Read sites | Write sites |
| --- | --- | --- | --- |
| `LOCAL_STORAGE_KEY` | `GammaLedgerLocalDatabase` | `loadFromStorage` (20629) | `saveToStorage` (20616) |
| `LEGACY_STORAGE_KEYS` (4 keys) | `GammaLedgerTrades`, `GammaLedgerDatabase`, `GammaLedgerLocalState`, `GammaLedgerState` | `loadFromStorage` (20658) | removed during migration (20619) |
| `GEMINI_STORAGE_KEY` | `GammaLedgerGeminiConfig` | `loadGeminiConfigFromStorage` (11524, 11632) | `saveGeminiConfigToStorage` (11651) |
| `GEMINI_SECRET_STORAGE_KEY` | `GammaLedgerGeminiSecret` | `ensureGeminiEncryptionKey` (11675) | `ensureGeminiEncryptionKey` (11679); `removeGeminiEncryptionKey` (11659, removeItem) |
| `DISCLAIMER_STORAGE_KEY` | `GammaLedgerDisclaimerAcceptedAt` | `getDisclaimerAcceptance` (12152) | `setDisclaimerAcceptance` (12166); removeItem (12163) |
| `AI_COACH_CONSENT_STORAGE_KEY` | `GammaLedgerAICoachConsentAt` | `getAICoachConsent` (12349) | `setAICoachConsent` (12363); removeItem (12360) |
| `SIDEBAR_COLLAPSED_STORAGE_KEY` | `GammaLedgerSidebarCollapsed` | `getSidebarCollapsedPreference` (12418) | `setSidebarCollapsedPreference` (12428) |
| `DEFAULT_FEE_STORAGE_KEY` | `GammaLedgerDefaultFeePerContract` | `loadDefaultFeeFromStorage` (11924) | `saveDefaultFeeToStorage` (11939); `removeDefaultFeeFromStorage` (11948) |
| `FINNHUB_RATE_LIMIT_STORAGE_KEY` | `GammaLedgerFinnhubRateLimit` | `loadFinnhubRateLimitFromStorage` (11957) | `saveFinnhubRateLimitToStorage` (11973); `removeFinnhubRateLimitFromStorage` (11982) |
| `GEMINI_MAX_TOKENS_STORAGE_KEY` | `GammaLedgerGeminiMaxTokens` | `loadGeminiMaxTokensFromStorage` (11991) | `saveGeminiMaxTokensToStorage` (12007); `removeGeminiMaxTokensFromStorage` (12016) |
| `getFinnhubStorageKey()` | dynamic per-key | `loadFinnhubConfigFromStorage` (13142) | `saveFinnhubConfigToStorage` (13186); `removeFinnhubConfigFromStorage` (13194); `encryptAndStoreFinnhubApiKey` (13290) |
| `getFinnhubSecretStorageKey()` | dynamic per-key | `ensureFinnhubEncryptionKey` (13232) | `ensureFinnhubEncryptionKey` (13236) |

Two access paths exist:
- Direct `localStorage.getItem/setItem/removeItem` — 28 sites.
- `this.safeLocalStorage.{get,set,remove}Item` — 6 sites (only Gemini config flows use the wrapper).

The `safeLocalStorage` wrapper handles `QuotaExceededError` and Safari private-mode `SecurityError`. The direct calls do not, which is an inconsistency worth flagging in Phase 2 but is **not** in scope for Phase 1.

---

## 5. DOM references

### 5.1 `getElementById` — 119 distinct IDs across 166 call sites

Grouped by feature area (full list below; line numbers omitted for brevity — all are inside `GammaLedger`):

**Header / shell**
`page-title`, `current-file-name`, `unsaved-indicator`, `loading-indicator`, `compatibility-notice`, `sidebar-toggle`, `toggle-filters`

**File / database controls**
`save-database-btn`, `load-database-btn`, `new-database-btn`, `file-input`, `export-csv`

**Add-trade form**
`add-trade-form`, `ticker`, `ticker-preview`, `entryDate`, `tradeStatus`, `underlyingType`, `add-leg-button`, `cancel-trade`, `trade-legs-container`

**Dashboard cards / stats**
`realized-pl`, `unrealized-pl`, `total-roi`, `win-rate`, `expectancy`, `profit-factor`, `sharpe-ratio`, `max-drawdown`, `avg-win-loss`, `win-loss-count`, `collateral-at-risk`

**Tables**
`active-positions`, `assigned-positions`, `assigned-positions-status-filter`, `trades-table`, `search-ticker`, `filter-status`, `filter-strategy`, `trades-filters-panel`

**Charts (canvases)**
`commissionImpactChart`, `commissionImpactSummary`, `cumulativePLChart`, `cumulative-pl-controls`, `monteCarloChart`, `monteCarloSummary`, `monthlyPLChart`, `strategyChart`, `tickerHeatmap`, `timeInTradeChart`, `winRateChart`

**Credit playbook**
`credit-playbook-table`, `credit-playbook-metrics`, `credit-playbook-status-filter`, `credit-playbook-strategy-filter`, `credit-playbook-horizon-filter`, `credit-playbook-symbol-filter`

**Imports / merge**
`import-dropzone`, `import-log`, `import-summary`, `import-ofx-btn`, `import-ofx-input`, `import-robinhood-btn`, `import-robinhood-input`, `import-merge-btn`, `import-merge-count`, `import-merge-hint`, `import-merge-hint-btn`, `import-merge-list`, `trades-merge-btn`, `trades-merge-groups`, `trades-merge-panel`, `trades-merge-summary`, `trades-merge-toggle`, `trades-select-all`

**Settings — Finnhub / Gemini / fees**
`finnhub-controls`, `finnhub-api-key`, `finnhub-save`, `finnhub-status`, `finnhub-rate-limit`, `finnhub-rate-save`, `finnhub-rate-reset`, `finnhub-rate-status`,
`gemini-controls`, `gemini-api-key`, `gemini-model`, `gemini-save`, `gemini-clear`, `gemini-status`, `gemini-max-tokens`, `gemini-tokens-save`, `gemini-tokens-reset`, `gemini-tokens-status`,
`default-fees-controls`, `default-fee-per-contract`, `default-fee-save`, `default-fee-clear`, `default-fee-status`

**AI chat**
`ai-chat`, `ai-chat-toggle`, `ai-chat-close`, `ai-chat-form`, `ai-chat-input`, `ai-chat-history`, `ai-chat-panel`, `ai-chat-resize-handle`, `ai-chat-subtitle`, `ai-chat-title`

**Disclaimer / consent**
`disclaimer-banner`, `ai-coach-consent`

**Share card**
`share-portfolio-card`, `share-card-root`, `share-card-cumulative-chart`, `share-card-date`, `share-card-profit-factor`, `share-card-range`, `share-card-total-pl`, `share-card-total-roi`, `share-card-win-rate`

### 5.2 `querySelector` / `querySelectorAll` — 82 sites

Used for: nav items (`[data-view]`), filter selects, sortable column headers, leg-form rows, modal action buttons (`[data-action]`), and dynamically-rendered table rows. No global state lives in selectors — they all run inside specific render or wire-up methods.

### 5.3 Views (defined in `index.html`)

Six top-level views switched by `showView(viewName)` (line 7056):

| View | Container line | Nav `data-view` |
| --- | --- | --- |
| Dashboard | 198 | `dashboard` |
| Add Trade | 444 | `add-trade` |
| Trades List | 598 | `trades-list` |
| Credit Playbook | 669 | `credit-playbook` |
| Import | 801 | `import` |
| Settings | 842 | `settings` |

---

## 6. Event listeners

Total `addEventListener` calls in `app.js`: **94**. There are **zero** inline `onclick=`/`onchange=`/`onsubmit=` attributes in `index.html`. All event wiring is JavaScript.

### 6.1 Event wiring entry points

| Method | Lines | What it wires |
| --- | --- | --- |
| `bindEvents()` | 6120–6307 | Master wire-up: nav, db buttons, add-trade form, ticker input, filter selects, search box, export, table headers, AI chat root, document-level dismissals. |
| `setupResponsiveFilters()` | 6308–6352 | Mobile filter-toggle button + window `resize`. |
| `initializeCumulativePLControls()` | 6353–6383 | Range-pill click delegation. |
| `initializeAssignedPositionsStatusFilter()` | 6415–6445 | Open/closed/all toggle. |
| `setupAIChatResizeHandle()` | 6472–6573 | Pointer-based panel resizing. |
| `initializeAIChat()` | 6574–6598 | (Wires through `bindEvents`; populates initial state.) |
| `initializeCreditPlaybookControls()` | 8731–8787 | Status / strategy / horizon / symbol filters. |
| `initializeGeminiControls()` | 11133–11269 | Model select + save/clear key. |
| `initializeGeminiMaxTokensControls()` | 11270–11317 | Max-tokens save/reset. |
| `initializeFinnhubControls()` | 11714–11782 | API-key save + Enter-to-save. |
| `initializeFinnhubRateLimitControls()` | 11783–11834 | Rate-limit save/reset. |
| `initializeDefaultFeeControls()` | 11862–11921 | Default fee save/clear. |
| `initializeDisclaimerBanner()` | 12060–12090 | Agree button + cleanup. |
| `initializeAICoachConsent()` | 12172–12233 | Agree / dismiss / Escape. |
| `initializeSidebarToggle()` | 12369–12415 | Toggle + media-query listener. |
| `initializeShareCard()` | 12490–12531 | Download button. |
| `setupImportControls()` | 17367–17468 | OFX/Robinhood file inputs, drag-drop, merge buttons. |
| `setupTradesMergeControls()` | 17469–17510 | Trades-list merge panel toggles. |

### 6.2 Module-level listeners (lines 21419–21449)

```
DOMContentLoaded → instantiates window.tracker
window.error      → console.error + preventDefault
window.unhandledrejection → console.error + preventDefault
window.beforeunload → window.tracker?.cleanup()
```

---

## 7. Third-party libraries

Loaded via CDN `<script>`/`<link>` in `index.html`:

| Library | Version | Source | Used in |
| --- | --- | --- | --- |
| **Chart.js** | latest | `https://cdn.jsdelivr.net/npm/chart.js` (line 46) | `new Chart()` constructor — 11 call sites: lines 10638 (gauges), 10716 (commission impact), 10853 (time in trade), 10967 (Monte Carlo), 12892 (share-card), 14171 (monthly P&L), 14232/14265 (cumulative P&L), 14418 (strategy performance), 14489 (win rate), 15428 (per-trade payoff). Chart instances are tracked in `this.charts` and `this.tradeDetailCharts`. |
| **html2canvas** | 1.4.1 | `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js` (line 1008) | `downloadShareCard` (lines 12980, 13021) — exports the share card to PNG. |

No npm dependencies, no module bundler, no transpilation. Browser globals only.

ES-module compatibility:
- Chart.js v4 ships ESM (`chart.js/auto`). Should work with Vite via `npm install chart.js`.
- html2canvas v1 ships UMD; npm package is consumable.

For Phase 1 the **simplest path** is to keep both as CDN `<script>` tags and access them via `window.Chart` / `window.html2canvas`. The CLAUDE.md "Questions / Blockers" section explicitly allows this.

---

## 8. `window.*` globals

| Reference | Line | Direction | Purpose |
| --- | --- | --- | --- |
| `window.tracker = new GammaLedger()` | 21420 | write | Single global app instance. |
| `window.tracker.cleanup()` | 21439 | read | Called on `beforeunload`. |
| `window.html2canvas` | 12980, 13021 | read | CDN library. |
| `window.showSaveFilePicker` | 17272 | read | File System Access API. |
| `window.showOpenFilePicker` | 17327 | read | File System Access API. |
| `window.URL.createObjectURL` / `revokeObjectURL` | 16671, 16678 | read | CSV download. |
| `window.devicePixelRatio` | 13020 | read | Share-card export DPI. |
| `window.open(url)` | 5854, 7032 | call | Ticker links open in new tab. |
| `window.addEventListener` / `window.removeEventListener` | 3940, 3942, 6345, 8521, 8523, 21424, 21430, 21437 | call | Resize, scroll, error, unload. |
| `'showOpenFilePicker' in window` | 1347 | feature-detect | Sets `this.supportsFileSystemAccess`. |
| Implicit `Chart` (no `window.` prefix) | many | read | Chart.js exposes the global `Chart`. After modularization either keep as global or import explicitly. |

---

## 9. Initialization / bootstrap sequence

1. `DOMContentLoaded` fires → `new GammaLedger()` (line 21420).
2. **Constructor** (1336–1573):
   - Initialize all `this.*` state slots.
   - Instantiate `new GeminiInsightsAgent(this)` and store on `this.aiAgent`.
   - Read `loadFinnhubRateLimitFromStorage()` and `loadGeminiMaxTokensFromStorage()` synchronously to seed `this.finnhub` / `this.gemini` numeric defaults. **Note: this means storage-reading helpers are reachable from the constructor — they need to be safe to call before `init()`.**
   - Call `this.init()`.
3. **`init()`** (1664–1712) — the single async entry point. Likely sequence (read in next step but expected from naming):
   - `loadDefaultDatabase()` / `loadFromStorage()` to populate `this.trades`.
   - `bindEvents()` to wire all listeners.
   - All `initialize*` controls (Finnhub, Gemini, fees, disclaimer, AI consent, sidebar, share card, credit playbook, AI chat, cumulative P&L, assigned positions, import, trades-merge).
   - `updateDashboard()` for the initial render.
4. **Cleanup** (1627–1663) — destroys all chart instances + share-card chart on `beforeunload`.

---

## 10. Apparent feature domains

Mapping methods to natural domain boundaries based on names + line clustering:

| Domain | Approx lines | Approx methods | Notes |
| --- | --- | --- | --- |
| App infra (constructor, init, cleanup, validators, safeLocalStorage) | 1336–1712 | 8 | Includes `validateNumber`, `validateDate`, `sanitizeString`, `destroyChart`. |
| Leg model (normalize, derive, summarize) | 1757–2336 | 12 | Order-type ↔ action/side mapping, leg shape normalization, cash flow summarization. |
| Strategy risk model | 2386–3151 | 10 | Per-strategy max-risk handlers, formula context, evaluation. |
| Strikes & formula display | 3152–3983 | 10 | Strike inference, formula tooltips/icons, HTML escape. |
| Add-trade form (legs UI) | 3984–4680 | 14 | Leg row CRUD, multiplier visibility, autofill from Finnhub. |
| Trade derivations & calcs | 4680–5092 | 18 | Type/direction inference, status, P&L, ROI, days held, capital. |
| Lifecycle status | 5096–5790 | 4 | `determineTradeLifecycleStatus`, `enrichTradeData` (large). |
| Date/format/wheel/PMCC helpers | 5793–6118 | 21 | Mixed: dates, ticker links, wheel/pmcc detectors, cost basis, premium. |
| Event wiring | 6120–6470 | 5 | `bindEvents` + responsive/range/filter init. |
| AI chat UI | 6472–7041 | 12 | Resize handle, render, markdown sanitization. |
| View / form bootstrap | 7043–7330 | 8 | `showView`, `resetAddTradeForm`, parse helpers, submit. |
| Dashboard stats | 7324–8081 | 4 | `updateDashboard`, `calculateAdvancedStats`, `calculateAssignmentStats`, ticker performance. |
| Tables (active / recent / assigned) | 8128–8730 | 5 | Active positions, recent trades, assigned positions, quote refresh. |
| Credit Playbook (filters, render, extractors) | 8731–10560 | 30 | Largest single domain — ~1,800 LOC. |
| Charts (gauges, heatmap, monte carlo) | 10562–11132 | 8 | Performance gauges, commission impact, ticker heatmap, time-in-trade, Monte Carlo. |
| Gemini settings | 11133–11713 | 14 | API key + model + tokens + encryption. |
| Finnhub settings | 11714–11860 | 7 | API key + rate limit + status. |
| Default fee settings | 11862–12058 | 8 | Save/load/clear, plus token + rate-limit storage helpers. |
| Disclaimer / AI Coach consent | 12060–12368 | 12 | Modal show/hide/persist. |
| Sidebar | 12369–12489 | 4 | Toggle + persist. |
| Share card | 12490–13080 | 8 | Render, refresh, download via html2canvas. |
| Finnhub network adapter | 13081–13912 | 16 | Encrypt/decrypt, fetch, rate limit, cache, schedule. |
| Position highlights | 13914–14140 | 6 | ITM detection, expiration warnings. |
| P&L charts (monthly / cumulative / strategy / win rate) | 14142–14523 | 8 | Chart.js wrappers + week labels. |
| Trades table (filter/sort/render) | 14524–15123 | 11 | List view rendering + selection. |
| Per-trade payoff charts | 15123–16482 | 12 | Toggle, render, calculate single/multi-leg/vertical/CC/PMCC payoff series. |
| Trade CRUD (sort/edit/delete/export) | 16484–16850 | 5 | Includes `exportToCSV`. |
| Database persistence (file + storage) | 16683–17366 | 10 | File System Access API + `loadFromStorage` / `saveToStorage` + processing. |
| MCP context | 16858–17268 | 3 | `buildMCPContext`, `buildMCPTrade`, `buildMCPAssignment`. |
| Imports (controls, merge, log, summary) | 17367–18430 | 24 | Drag-drop, OFX/Robinhood routing, merge UX. |
| Robinhood CSV parser | 18430–19440 | 13 | Row → transaction → leg pipeline. |
| OFX parser | 19440–20210 | 11 | XML parse + securities + transactions + position keys. |
| OFX/Robinhood payload application | 19483, 20209–20502 | 3 | `applyRobinhoodImportResult`, `applyOfxImportResult`, `buildOfxImportPayload`. |
| App-shell helpers | 20503–20688 | 6 | `processLoadedData`, `newDatabase`, `updateFileNameDisplay`, `updateUnsavedIndicator`, `showLoadingIndicator`, `hideLoadingIndicator`, `showNotification`, `markUnsavedChanges`. |
| Storage I/O | 20607–20688 | 2 | `saveToStorage`, `loadFromStorage` (with legacy migration). |
| Formatters | 20689–20805 | 6 | `formatNumber`, `formatPercent`, `getStrategyDisplayName`, `escapeHTML`, `formatCurrency`, `formatDate`. |
| **LocalInsightsAgent** (separate class) | 20805–21015 | 12 | Heuristic AI fallback. |
| **GeminiInsightsAgent** (separate class) | 21016–21389 | 16 | Calls Gemini API, builds prompts. |
| Bootstrap | 21419–21449 | n/a | DOMContentLoaded + global error handlers. |

---

## 11. Notable Phase-1 risks / observations

1. **`this`-coupling is deep.** Almost every method references `this.trades`, `this.charts`, `this.finnhub`, etc. To extract pure functions into modules they will need state passed in (parameter or imported singleton). A `state.js` module exposing a single object plus accessors is the most surgical path.
2. **Two `localStorage` access styles.** Direct calls vs. `safeLocalStorage`. Migrating to a single `core/storage.js` module is straightforward but should preserve behavior — keep `safeLocalStorage`'s error semantics.
3. **`new Chart()` constructor is referenced as a global** (no `window.Chart`). When modules load after the CDN script this still works, because globals are accessible from ESM. We should keep the CDN tag and reference `window.Chart` explicitly inside the chart module to make the dependency obvious.
4. **`enrichTradeData` (line 5516) is ~280 lines.** It pulls from leg model, strategy risk, lifecycle, formatters, dates. Plan to keep it intact as one method on a `positions` module rather than splitting mid-refactor.
5. **`bindEvents` (lines 6120–6307) is the central wiring hub.** It directly references DOM IDs from every feature area. After modularization it must stay cohesive (or be split into small `bind*` functions exported by each feature module and called from `index.js`).
6. **AI agent classes are already self-contained.** They take `app` in their constructor. Migrating them to their own modules in `src/ai/` (LocalInsightsAgent, GeminiInsightsAgent) is the lowest-risk extraction and a good first move.
7. **`BUILTIN_SAMPLE_DATA` is 1,200 lines of static data.** It belongs in its own file (`src/core/sample-data.js`) — easy win.
8. **No circular dependencies are visible from a static read.** All flows are top-down within the class. Once split into modules the only likely circularity is `state` ↔ `ui` ↔ `trades`; resolved by keeping `state.js` lowest.
9. **Two derived constants are technically unused or only used once** (e.g. `DEFAULT_GEMINI_TEMPERATURE`). Don't prune them in Phase 1 — record and revisit.
10. **MCP context builder** (`buildMCPContext`, line 16858) appears unused by core flows — likely an integration hook. Keep it; place under `integrations/mcp.js` rather than guessing it's dead code.

---

## 12. Counts at a glance

| Metric | Value |
| --- | --- |
| `src/app.js` LOC | 21,440 |
| `src/index.html` LOC | 1,011 |
| `src/style.css` LOC | 4,731 |
| Top-level constants | 26 |
| Classes | 3 (`GammaLedger`, `LocalInsightsAgent`, `GeminiInsightsAgent`) |
| Methods (all 3 classes) | ~462 |
| `this.*` properties on `GammaLedger` (init + lazy) | ~160 |
| Distinct `localStorage` keys | 11 (+4 legacy) |
| Distinct `getElementById` IDs | 119 |
| `getElementById` call sites | 166 |
| `querySelector` / `querySelectorAll` call sites | 82 |
| `addEventListener` calls | 94 |
| Inline HTML event handlers | 0 |
| Third-party libraries | 2 (Chart.js, html2canvas) |
| `window.*` writes | 1 (`window.tracker`) |
| Chart instances (`new Chart`) | 11 distinct call sites |
| Views | 6 (`dashboard`, `trades-list`, `credit-playbook`, `add-trade`, `import`, `settings`) |
