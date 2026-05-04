# Integrations, MCP Surface, Security

Source: `src/app.js`, `mcp/src/*.py`, `.github/workflows/*.yml`. All citations `app.js:LINE` or `mcp/src/server.py:LINE`.

This document covers everything that crosses the trust boundary, plus the MCP server contract that hosted-mode must continue to honour.

---

## 1. Gemini integration (the only LLM)

There is **no Anthropic integration** — "AI Coach" is Google Gemini only.

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
```
- Base URL constant: `DEFAULT_GEMINI_ENDPOINT` (app.js:7)
- API key sent as **both** `?key=` query and `x-goog-api-key` header (app.js:21382)
- 120s `AbortController` timeout (app.js:21374)

### Models (app.js:3–6)
Default `gemini-2.5-flash`. Allowed: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`.

### Generation params
- Temperature **hardcoded 0.25** — `DEFAULT_GEMINI_TEMPERATURE` (not user-configurable)
- `maxOutputTokens` default 65536 — `DEFAULT_GEMINI_MAX_TOKENS` (app.js:57); persisted to `GammaLedgerGeminiMaxTokens`

### Request body
```json
{
  "contents": [
    { "role": "user"|"model", "parts": [{ "text": "..." }] }
  ],
  "generationConfig": { "maxOutputTokens": 65536, "temperature": 0.25 }
}
```
Up to **8 prior turns** of history prepended (app.js:21173).

### Response parsing
`data.candidates[0].content.parts[*].text` concatenated. Throws on `data.promptFeedback.blockReason`.

### Consent gating (app.js:6610, 12349)
`hasAICoachConsent()` checks `GammaLedgerAICoachConsentAt` (ISO timestamp). Disclaimer (`GammaLedgerDisclaimerAcceptedAt`) must precede.

### Prompt construction (app.js:21187)
`buildContextBlock()` → `JSON.stringify(buildMCPContext(), null, 2)` injected as `# PORTFOLIO DATA` block. Three structured templates: `buildPortfolioHealthPrompt` / `buildRiskCheckPrompt` / `buildStrategyIdeasPrompt` (app.js:21116–21170).

---

## 2. Finnhub integration

### Endpoint
```
GET https://finnhub.io/api/v1/quote?symbol={SYMBOL}&token={apiKey}
```
Only this endpoint is called.

### Response fields (app.js:13862)
`c` (current price, required finite), `d` (change), `dp` (change %), `pc` (prev close), `o`, `h`, `l`.

### Rate limit (app.js:13888 `enforceFinnhubRateLimit`)
- Sliding 60,000ms window; default 60 req/min (`GammaLedgerFinnhubRateLimit`)
- In-memory timestamp array; waits to age out + 50ms slack
- Concurrent-call dedup via `outstandingRequests` Map; short-lived in-memory cache via `getCachedQuote/setCachedQuote`

### Output shape
```js
{ symbol, price, change, changePercent, previousClose, open, high, low, fetchedAt, currency: 'USD' }
```
Feeds `unrealizedPL`, `marketValue`, `marketPriceSource` runtime fields.

---

## 3. OFX import (hand-rolled parser, no library)

`importOfxFile` → `importOfxContent` → `parseOfx` → `buildOfxImportPayload` → `applyOfxImportResult` (app.js:18444+). Parser uses `new DOMParser()` over the SGML payload after slicing pre-`<OFX` header (app.js:19590–19600).

### Security map (`extractOfxSecurities`, app.js:19612)
| OFX path | Internal field |
|---|---|
| `SECINFO/UNIQUEID` | map key |
| `SECINFO/TICKER` | `ticker` |
| `SECINFO/SECNAME` | `info.name` |
| `OPTINFO/STRIKEPRICE` | `info.option.strike` |
| `OPTINFO/SHPERCTRCT` | `info.option.multiplier` |
| `OPTINFO/DTEXPIRE` | `info.option.expiration` |
| `OPTINFO/OPTTYPE` | `info.option.type` (CALL/PUT) |

OCC contract symbol regex `^([A-Z]{1,6})(\d{6})([CP])(\d{8})` (app.js:19678) — strike = `int / 1000`.

### Transaction map (`extractOfxTransactions`, app.js:19758)
Element tags: `BUYOPT`, `SELLOPT`, `BUYSTOCK`, `SELLSTOCK`.

| OFX path | Internal field |
|---|---|
| `INVTRAN/FITID` | `externalId` (sanitized `[A-Za-z0-9]`) |
| `INVTRAN/DTTRADE` | `tradeDate`, `tradeTimeKey` |
| `INVBUY|INVSELL/UNITS` | `quantity` (abs) |
| `INVBUY|INVSELL/UNITPRICE` | `price` (abs) |
| `INVBUY|INVSELL/COMMISSION` | `fees` (abs) |
| `INVBUY|INVSELL/UNIQUEID` → security | `ticker`, `optionType`, `strike`, `expiration`, `multiplier` |
| `BUYOPT/OPTBUYTYPE` | BTC if `BUYTOCLOSE` else BTO |
| `SELLOPT/OPTSELLTYPE` | STC if `SELLTOCLOSE` else STO |
| `BUYSTOCK/BUYTYPE` | BTC if `BUYTOCOVER` else BTO |
| `SELLSTOCK/SELLTYPE` | STO if `SELLSHORT`; STC if `SELLTOCLOSE`; units<0 → STO else STC |
| `INVTRAN/MEMO` | `memo` |
| `CURSYM` | `currency` (default `'USD'`) |

### Built leg shape (`buildLegFromTransaction`, app.js:19929)
```js
{ id, orderType, type, quantity, multiplier, executionDate, expirationDate,
  strike, premium, fees, underlyingPrice: null,
  externalId, importGroupId, importSource: 'OFX', tickerSymbol }
```

### OFX export
**Not implemented.** Despite CLAUDE.md mention, no emitter exists. Only JSON+CSV exports work.

### Robinhood CSV
`importRobinhoodCsvFile` → `importRobinhoodCsvContent` (app.js:18506). Same merge/dedup pipeline.

---

## 4. File System Access API

### Methods
- `window.showSaveFilePicker` — first save then `currentFileHandle.createWritable()` reused
- `window.showOpenFilePicker` — `.json` filter
- `createWritable()` → `write(JSON.stringify(data, null, 2))` → `close()`

### Detection
`this.supportsFileSystemAccess = 'showOpenFilePicker' in window` (app.js:1347).

### Fallback
- Save: `Blob` → `URL.createObjectURL` → programmatic `<a download="gammaledger.json">` click (app.js:17292)
- Load: hidden `<input type="file">` + `FileReader.readAsText()` (app.js:17343)
- Auto-engaged on FSA non-`AbortError` exceptions

### Handle persistence
`currentFileHandle` is **memory-only** — cleared on every page load and on `loadFromStorage()` (app.js:20644). No IndexedDB persistence. Stale handle → next save re-prompts.

---

## 5. localStorage envelope

### Active keys
| Key | Constant | Content |
|---|---|---|
| `GammaLedgerLocalDatabase` | `LOCAL_STORAGE_KEY` | DB envelope `{version, timestamp, fileName, trades, mcpContext}` |
| `GammaLedgerGeminiConfig` | `GEMINI_STORAGE_KEY` | Gemini model + encrypted/plaintext key |
| `GammaLedgerGeminiSecret` | `GEMINI_SECRET_STORAGE_KEY` | base64 32-byte AES-GCM key |
| `GammaLedgerGeminiMaxTokens` | — | numeric string |
| `GammaLedgerFinnhubConfig` | via `getFinnhubStorageKey()` | Finnhub envelope |
| `GammaLedgerFinnhubSecret` | via `getFinnhubSecretStorageKey()` | base64 raw AES key |
| `GammaLedgerFinnhubRateLimit` | — | numeric string |
| `GammaLedgerDisclaimerAcceptedAt` | `DISCLAIMER_STORAGE_KEY` | ISO timestamp |
| `GammaLedgerAICoachConsentAt` | `AI_COACH_CONSENT_STORAGE_KEY` | ISO timestamp |
| `GammaLedgerSidebarCollapsed` | `SIDEBAR_COLLAPSED_STORAGE_KEY` | `"true"`/`"false"` |
| `GammaLedgerDefaultFeePerContract` | `DEFAULT_FEE_STORAGE_KEY` | numeric string |

### Legacy keys (read-once, then deleted)
`GammaLedgerTrades`, `GammaLedgerDatabase`, `GammaLedgerLocalState`, `GammaLedgerState` — stored raw `trades[]` arrays. Migrated on load.

### Encryption (app.js:11675, 13245)

**AES-GCM 256-bit, 96-bit random IV.** No PBKDF2/password derivation — raw key is stored alongside ciphertext, so protection is same-origin scope only.

`encryptString` envelope:
```json
{ "iv": "<base64>", "ct": "<base64 ciphertext+tag>" }
```

**Gemini config** (app.js:11610) — encrypted variant:
```json
{
  "model": "gemini-2.5-flash",
  "enc": true,
  "payload": { "iv": "...", "ct": "..." },
  "fallback": "<btoa(apiKey)>"
}
```
Fallback chain on load: encrypted payload → plaintext `apiKey` → `atob(fallback)` (app.js:11544–11584).

**Finnhub config** — same shape but **no `fallback` field**:
```json
{ "enc": true, "payload": { "iv": "...", "ct": "..." } }
```

### Quota / privacy mode (`safeLocalStorage`, app.js:1542)
try/catch wrapper. `setItem` swallows `QuotaExceededError` and `SecurityError` with `console.warn`. **No user-facing notification.**

---

## 6. MCP server surface (`mcp/`)

Standalone Python package, FastMCP. Singleton DB reader with mtime-cached lazy load (`mcp/src/database.py`).

### DB path resolution (`database.py:32`)
1. `--db-path` CLI flag (`server.py:798`)
2. `GAMMALEDGER_DB_PATH` env var
3. Default `~/gammaledger.json`

### Reload strategy (`database.py:66 _reload_if_needed`)
On every tool call: `os.stat`. If `_data` cached and `_mtime` matches → fast path. Else re-read+parse under `threading.Lock`. **No filesystem watcher** — pure on-demand mtime check.

### Tools (`server.py`)
| Function | Lines | Params |
|---|---|---|
| `gammaledger_database_info` | 128 | — |
| `gammaledger_portfolio_summary` | 146 | — |
| `gammaledger_pl_breakdown` | 177 | — |
| `gammaledger_open_positions` | 199 | `ticker`, `strategy`, `dte_max`, `underwater_only` |
| `gammaledger_position` | 248 | `trade_id` |
| `gammaledger_wheel_pmcc_positions` | 272 | `position_type` |
| `gammaledger_recent_closed_trades` | 295 | `limit` (≤50, default 10) |
| `gammaledger_strategy_breakdown` | 320 | — |
| `gammaledger_ticker_exposure` | 335 | `top_n` (≤50, default 15) |
| `gammaledger_underlying_breakdown` | 356 | — |
| `gammaledger_concentration_risk` | 375 | — |
| `gammaledger_expiring_positions` | 394 | `within_days` (≤365, default 7) |
| `gammaledger_audit_risk` | 428 | — |
| `gammaledger_audit_wheel_pmcc` | 581 | — |
| `gammaledger_search_trades` | 645 | `ticker`, `strategy`, `status`, `limit` (≤200, default 25) |

All return compact JSON via `_json()`. `DatabaseError` → `{"error": true, "type": ..., "detail": ...}`.

**Note**: `mcp/README.md` shows shortened names (`get_database_info` etc.) but actual tool names are `gammaledger_*`. Hosted-mode server **must keep `gammaledger_*` names** to avoid breaking existing MCP clients.

### Resources (`server.py:701–740`)
- `gammaledger://portfolio/summary`
- `gammaledger://positions/active`
- `gammaledger://positions/wheel-pmcc`
- `gammaledger://database/info`

### Prompts (`mcp/src/prompts/analysis.py`)
| Name | Lines | Args | Description |
|---|---|---|---|
| `analyze_portfolio` | 24 | — | 7-step review |
| `risk_audit` | 70 | — | severity-bucketed audit |
| `wheel_pmcc_review` | 126 | — | per-position deep-dive |
| `weekly_review` | 170 | — | 5-step check-in |
| `position_inspect` | 204 | `trade_id: str` | single trade |

---

## 7. mcpContext contract — frozen wire shape

`buildMCPContext()` (app.js:16858) writes; `mcp/src/server.py` reads. **Hosted-mode MUST emit identical key names at identical depths.** Numeric precision: 2 d.p. for currency/percent, 4 d.p. for ratios. Null/undefined/`""` stripped by `compact()`.

Top-level: `generatedAt`, `asOfDate`, `portfolio`, `strategyBreakdown`, `underlyingBreakdown`, `dteDistribution`, `concentration`, `activePositions`, `wheelPmccPositions`, `tickerExposure`, `recentClosedTrades`.

Under `portfolio`:
- `counts` — `totalTrades`, `closed`, `active`, `assigned`, `awaitingCoverage`
- `pl` — `total`, `realized`, `unrealized`, `ytd`, `mtd`, `last7d`, `last30d`, `last90d`, `last1y`
- `performance` — `winRate`, `wins`, `losses`, `profitFactor`, `avgWin`, `avgLoss`, `expectancy`, `totalROI`, `annualizedROI`, `maxDrawdown`, `sharpeRatio`, `sortinoRatio`
- `risk` — `collateralAtRisk`, `totalMaxRisk`
- `fees` — `total`, `shareOfGross`
- `trading` — `avgWinnerDays`, `avgLoserDays`, `currentStreak: {type, count}|null`, `daysSinceLastTrade|null`
- `largestWinner` / `largestLoser` — `{id, ticker, strategy, pl, roi, closedDate}`

`activePositions` items (built by `buildMCPTrade`):
`id, ticker, strategy, status, underlying, direction, opened, expires, quantity, strike, entryPrice, pl, roi, annualizedROI, capitalAtRisk, maxRiskLabel, cashFlow, fees, daysHeld, dte, riskIsUnlimited?`

`recentClosedTrades` items add: `closed`, `exitPrice`, `exitReason?`. Drop `dte`/`riskIsUnlimited`.

`gammaledger_position(trade_id)` returns the full **raw** trade from `trades[]` (not a `buildMCPTrade` summary).

---

## 8. CI / release pipelines

### `.github/workflows/deploy-gh-pages.yml`
**Trigger:** GitHub release `published` (any tag).

Steps:
1. Checkout the tag
2. Node 20 + global tools: `html-minifier-terser`, `terser`, `clean-css-cli`
3. Copy `./src` → `./gammaledger/`
4. Inject `?v={tag}` cache-buster on `app.js` and `style.css` references in `index.html`
5. Minify JS / CSS / HTML
6. Zip `gammaledger-{tag}.zip` → upload as Release asset
7. Deploy `./gammaledger/` to `gh-pages` branch under `./app` via `JamesIves/github-pages-deploy-action@v4` (`clean: true`)

Live site `gammaledger.com` = `gh-pages` branch, `app/` subfolder.

### `.github/workflows/mcp-release.yml`
**Trigger:** tag push matching `mcp-X.Y.Z` or `mcp-X.Y.Z-*`.

Sequence:
1. **test**: uv + Python 3.12; `ruff check`, `ruff format --check`, `mypy`, `pytest` from `mcp/`
2. **publish-pypi** (`id-token: write`): strip `mcp-` prefix; `uv build` with `SETUPTOOLS_SCM_PRETEND_VERSION`; `pypa/gh-action-pypi-publish@release/v1` (OIDC trusted publishing, no API token); `packages-dir: mcp/dist/`, `skip-existing: true`
3. **create-release**: GitHub Release with auto-generated notes + install instructions table

No npm publish, no Docker, no Homebrew.

---

## 9. Security posture

### CSP
**Commented out** at `index.html:13`. Static deployment on GitHub Pages → no server-side headers either. The (commented) policy would allow `connect-src` to `generativelanguage.googleapis.com` and `finnhub.io`.

### Sanitization
- `sanitizeString` (app.js:1606) — trim + truncate, **no HTML escape**
- `escapeHTML` (app.js:3904) used in markdown renderer (app.js:6843, 6965, 6982)
- Several unguarded `innerHTML` assignments at app.js:4168, 8395, 8399, 8506 — currently use only app-controlled strings, but the pattern is fragile
- AI markdown rendered via custom regex parser (`renderMarkdownToHTML`, app.js:6806) — code blocks escaped, link URLs filtered via `sanitizeMarkdownUrl` (rejects non-http(s) and non-anchor schemes). **No DOMPurify.**

### What breaks server-side

1. **Web Crypto secret storage**: random AES keys stored in plaintext base64 in localStorage. Same-origin model only. Server-side replacement: KMS / per-user server-managed encryption / re-prompt for keys.
2. **`window.crypto.subtle` / `btoa` / `atob`**: Node 19+ has Web Crypto on `globalThis.crypto`; `btoa`/`atob` not universally available pre-v16. Python equivalent: `cryptography` lib + `base64` stdlib.
3. **`showOpenFilePicker` / `showSaveFilePicker`**: browser-only. Replace with HTTP upload/download endpoints.
4. **`DOMParser` for OFX**: browser-only. Server-side: use `ofxtools` Python lib (already in target stack).
5. **`localStorage` as DB**: replaced by SQLModel + SQLite/Postgres.
6. **Direct browser → 3rd-party API calls**: Gemini and Finnhub keys currently in browser. Hosted mode should proxy server-side to keep keys out of clients.
7. **`file://` dev mode**: `CONTRIBUTING.md` instructs `file://` — incompatible with FSA APIs in many browsers (require secure context).

---

## 10. Migration-critical compatibility contracts

### A. JSON file format (so existing exports import cleanly)
- Top-level: `version` (`'2.5'`), `exportDate` OR `timestamp`, `trades[]`, `mcpContext`
- Accept absent / earlier `version` strings silently
- Apply `tradeReasoning → notes` rename on import (app.js:20510)
- Accept runtime-only fields in persisted trades (`importSource`, `importBatchId`, `importGroupId`, `externalId`)
- Accept `trades[]` as bare array (legacy shape)

### B. mcpContext (so existing MCP clients keep working)
- Identical key names + nesting (see §7)
- Identical numeric precision (2 d.p. / 4 d.p. ratios)
- Drop `null`/`undefined`/`""` keys (`compact()` parity)
- Strip `+Infinity` numerics (e.g. `profitFactor` when no losses)

### C. localStorage migration on first hosted login
- Read existing `GammaLedgerLocalDatabase` from user's browser → upload as initial server dataset
- Re-prompt for Gemini & Finnhub API keys (raw `*Secret` keys can't meaningfully migrate to a server credential store)
- Read & migrate legacy keys (`GammaLedgerTrades` / `GammaLedgerDatabase` / `GammaLedgerLocalState` / `GammaLedgerState`) if present
- After successful migration, clear all GammaLedger* keys from localStorage

### D. MCP tool naming
- Hosted-mode MCP server (if exposed) MUST keep `gammaledger_*` tool names — existing clients are wired to these
- Resource URIs: keep `gammaledger://...` scheme
