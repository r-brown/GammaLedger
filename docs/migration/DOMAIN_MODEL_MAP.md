# Domain Model Map

Source: `src/app.js` (vanilla JS, ~21,440 lines). All citations `app.js:LINE`.

This document is the canonical reference for the data model and calculations the new Python/SQLModel backend must replicate. **The new backend must produce numerically identical results to these formulas — any deviation is a regression.**

---

## 1. Persisted JSON envelope

`buildDatabasePayload()` (app.js:16849) — written to disk on export:

```json
{ "version": "2.5", "exportDate": "<ISO>", "trades": [...], "mcpContext": { ... } }
```

`saveToStorage()` (app.js:20607) — written to localStorage `GammaLedgerLocalDatabase`:

```json
{ "version": "2.5", "timestamp": "<ISO>", "fileName": "...", "trades": [...], "mcpContext": { ... } }
```

The migration importer must accept **both** shapes (read either `exportDate` or `timestamp`).

---

## 2. Trade entity (persisted)

Source of truth: `buildTradeStorageSnapshot` (app.js:16759) — strips `RUNTIME_TRADE_FIELDS`, writes the rest.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | string | no | e.g. `TRD-W001` |
| `ticker` | string | no | uppercase |
| `strategy` | string | no | one of 62 canonical strings (§5) |
| `underlyingType` | string | no | `Stock` / `ETF` / `Index` / `Future` |
| `status` | string | no | `Open` / `Closed` / `Expired` / `Assigned` / `Rolling` |
| `openedDate` | YYYY-MM-DD | no | earliest leg `executionDate` |
| `closedDate` | YYYY-MM-DD | yes | latest closing leg date or `""` |
| `expirationDate` | YYYY-MM-DD | yes | latest option expiry |
| `exitReason` | string | yes | enum-ish free text |
| `notes` | string | yes | markdown; migrated from legacy `tradeReasoning` |
| `maxRiskOverride` | number\|null | yes | user override; null = use formula |
| `statusOverride` | string | yes | manual pin of status (only persisted when set) |
| `legs` | Leg[] | no | see §3 |

### `RUNTIME_TRADE_FIELDS` (app.js:59–107) — computed every load, ALSO written into the saved JSON to populate `mcpContext`. They must NOT be read back as canonical values.

`legsCount`, `openContracts`, `closeContracts`, `openLegs`, `rollLegs`, `totalFees`, `totalDebit`, `totalCredit`, `cashFlow`, `capitalAtRisk`, `fees`, `primaryLeg`, `tradeType`, `tradeDirection`, `quantity`, `strikePrice`, `multiplier`, `displayStrike`, `activeStrikePrice`, `entryPrice`, `exitPrice`, `pmccShortExpiration`, `longExpirationDate`, `entryDate`, `exitDate`, `pl`, `roi`, `maxRisk`, `maxRiskLabel`, `riskIsUnlimited`, `lifecycleMeta`, `lifecycleStatus`, `partialClose`, `rolledForward`, `autoExpired`, `daysHeld`, `dte`, `weeklyROI`, `monthlyROI`, `annualizedROI`, `tradeReasoning` (legacy), `wheelCoverage`, `shares`, `effectiveCostBasis`, `marketValue`, `unrealizedPL`, `marketPriceSource`, `marketPriceSnapshot`.

---

## 3. Leg entity (persisted)

Source of truth: `buildLegStorageSnapshot` (app.js:16812). Normalizer: `normalizeLeg(leg, index)` (app.js:1892).

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `TRD-W002-L1` |
| `orderType` | enum | `BTO` / `STO` / `BTC` / `STC` |
| `type` | enum | `CALL` / `PUT` / `STOCK` / `CASH` / `FUTURE` / `ETF` |
| `quantity` | number | contracts (not shares) |
| `multiplier` | number | shares-per-contract; STOCK defaults to 1, options 100 |
| `executionDate` | YYYY-MM-DD | invalid → `""` |
| `expirationDate` | YYYY-MM-DD | `""` for STOCK/CASH |
| `strike` | number\|null | assignment price for STOCK |
| `premium` | number | per-unit price; equals `strike` for STOCK if 0 |
| `fees` | number | total fees for this leg |
| `underlyingPrice` | number\|null | spot at execution |
| `underlyingType` | enum | matches trade-level `underlyingType` |

### `orderType` legacy resolution chain (app.js:1906)
`leg.orderType` → `leg.tradeType` → `leg.order` → `deriveOrderTypeFromActionSide(leg.action, leg.side)`.

### `normalizeLegOrderType()` (app.js:1757)
Accepts canonical 3-letter codes; maps long-form ("BUY TO OPEN" → BTO etc.); first-letter heuristic fallback (B+C → BTC, S+C → STC); final default `BTO`.

### `RUNTIME_LEG_FIELDS` (app.js:109) — stripped on save
`externalId`, `importGroupId`, `importSource`, `importBatchId`, `tickerSymbol`.

### `calculateLegCashFlow(leg)` (app.js:1935)
```
direction = (action === 'SELL') ? +1 : -1   // BTO/BTC = -1, STO/STC = +1
if (type === 'STOCK' && premium === 0) premium = strike
return direction * premium * multiplier * quantity - fees
```

---

## 4. Other persisted entities

### Settings (each its own localStorage key)
Full key list in `INTEGRATIONS.md §5`. Notable:
- `GammaLedgerGeminiConfig` — `{ model, enc, payload:{iv,ct}, fallback }` or `{ model, apiKey }`
- `GammaLedgerFinnhubConfig` — `{ enc, payload:{iv,ct} }` or `{ apiKey }`
- `GammaLedgerGeminiSecret` / `GammaLedgerFinnhubSecret` — base64 raw 32-byte AES-GCM keys
- `GammaLedgerDisclaimerAcceptedAt` / `GammaLedgerAICoachConsentAt` — ISO timestamps

### Credit Playbook strategies — `this.creditPlaybookStrategyOptions` (app.js:1438)
62 strings. Used as the canonical strategy enum. Full list in §5.

### Built-in sample data — `BUILTIN_SAMPLE_DATA` IIFE (app.js:117–1334)
22 sample trades with date offsets relative to `new Date()` at load time. Includes a VIX cash-settled example. Returns `{ trades, exportDate, version: '3.1' }`. Loaded by `loadDefaultDatabase()` (app.js:1730) when no DB exists.

---

## 5. Strategies (62 canonical)

Bear Call Ladder, Bear Call Spread, Bear Put Ladder, Bear Put Spread, Box Spread, Bull Call Ladder, Bull Call Spread, Bull Put Ladder, Bull Put Spread, Calendar Call Spread, Calendar Put Spread, Calendar Straddle, Calendar Strangle, Call Broken Wing, Call Ratio Backspread, Call Ratio Spread, Cash-Secured Put, Collar, Covered Call, Covered Put, Covered Short Straddle, Covered Short Strangle, Diagonal Call Spread, Diagonal Put Spread, Double Diagonal, Guts, Inverse Call Broken Wing, Inverse Iron Butterfly, Inverse Iron Condor, Inverse Put Broken Wing, Iron Albatross, Iron Butterfly, Iron Condor, Jade Lizard, Long Call, Long Call Butterfly, Long Call Condor, Long Put, Long Put Butterfly, Long Put Condor, Long Straddle, Long Strangle, Poor Man's Covered Call, Protective Put, Put Broken Wing, Put Ratio Backspread, Put Ratio Spread, Reverse Jade Lizard, Short Call, Short Call Butterfly, Short Call Condor, Short Guts, Short Put, Short Put Butterfly, Short Put Condor, Short Straddle, Short Strangle, Strap, Strip, Synthetic Long Stock, Synthetic Short Stock, Synthetic Put, Wheel.

### Per-strategy max-risk dispatch — `getStrategyRiskHandlers()` (app.js:2868)

**Credit-width** — `risk = (spread_width − net_credit) × notional`:
Bear Call Ladder/Spread, Box Spread, Bull Put Ladder/Spread, Call/Put Broken Wing (and Inverse variants), Call/Put Ratio Backspread/Spread, Covered Put, Iron Albatross, Iron Butterfly, Iron Condor (+Inverse), Jade Lizard (+Reverse), Short Call Butterfly/Condor, Short Guts, Short Put, Short Put Butterfly/Condor, Short Straddle, Short Strangle.

**Debit** — `risk = total_debit × notional`:
Bear Put Spread, Bull Call Spread, Calendar Call/Put Spread, Calendar Straddle/Strangle, Covered Short Straddle/Strangle, Diagonal Call/Put Spread, Double Diagonal, Guts, Long Call/Put, Long Call/Put Butterfly/Condor, Long Straddle/Strangle, Protective Put, Strap, Strip, Synthetic Long/Short Stock, Synthetic Put.

**Special**:
- **Cash-Secured Put** (app.js:2972): `(strike − netCredit) × notional`
- **Wheel**: assigned → `(strike × shares) − optionCashFlowToDate`; pre-assignment → CSP formula
- **PMCC**: `longCallCost − shortCallNet × notional`
- **Collar**: `underlying − putStrike − netCredit`
- **Covered Call**: `underlyingPrice × quantity × multiplier`
- **Bear Put Ladder** (app.js:2946): `(netDebit − ladderWidth) × notional`, `ladderWidth = K3 − K2`
- **Bull Call Ladder** (app.js:2955): `(netDebit + ladderWidth) × notional`, `ladderWidth = K2 − K1`
- **Short Call (naked)**: `Number.POSITIVE_INFINITY` → `maxRiskLabel: 'Unlimited'`, `riskIsUnlimited: true`

`computeMaxRiskUsingFormula()` (app.js:3121) is the dispatcher; falls back to debit formula if no handler.

---

## 6. Lifecycle / status state machine

Canonical statuses: `Open`, `Closed`, `Expired`, `Assigned`, `Rolling` (`normalizeTradeStatusInput`, app.js:4739).

- `isClosedStatus()` returns true for `Closed` and `Expired` — Expired counts in P&L, win rate, time-window ranges.
- `isActiveStatus()` returns true for `Open` and `Rolling`.
- `lifecycleStatus` = computed runtime field; can be `awaiting_coverage` for uncovered Wheel/PMCC (NOT a persisted status).

### `determineTradeLifecycleStatus(trade, summary)` (app.js:5096)

**Phase 1 — pairMap construction.** Iterate `summary.legs`:
- STOCK legs → tracked in `stockBought` / `stockSold` (shares = qty × multiplier); BTO STOCK records assignment strike.
- CASH legs (BTC/STC) → set `hasCashSettlementEvent = true`, credit matching option legs by strike.
- Option legs grouped by `buildLegLifecycleKey(leg)` = `"TYPE|STRIKE.toFixed(4)|EXPIRATION|MULTIPLIER"` (app.js:5077).

**Phase 2 — Expiration check.** Cutoff is **21:00 UTC** of the expiration date (≈ 4 PM ET). Past cutoff → considered expired.

**Phase 3 — Status decision priority** (app.js:5300–5514):
1. `stockBought > 0` and `stockSold < stockBought` → `Assigned` (shares still held).
2. `hasCashSettlementEvent` → `Closed` with `exitReason = 'Cash Settlement'`.
3. All pairMap entries balanced (`unmatchedExposure === 0`) AND no open stock → `Closed`, `effectiveClosedDate` = latest close leg date.
4. All open legs past expiry cutoff AND `unmatchedExposure === 0` → `Expired`, `autoExpired = true`.
5. `hasRollLegs` → `Rolling`.
6. Otherwise → `Open`.

**Phase 4 — Wheel coverage override** (`enrichTradeData`, app.js:5670). After lifecycle resolution, `getTradeWheelCoverage()` computes `'covered' | 'partial' | 'uncovered' | 'n/a'`. If `'uncovered'` → `lifecycleStatus = 'awaiting_coverage'` (does NOT change persisted `status`).

**`statusOverride`** — if persisted, overrides everything (app.js:5772).

---

## 7. Financial calculations — line-level inventory

**THESE ARE THE LOAD-BEARING FORMULAS. The new backend must produce identical numbers.**

### `summarizeLegs(legs)` (app.js:1958)
Aggregator. Returns:
- `cashFlow` = Σ leg cashflows
- `totalFees`, `totalCredit`, `totalDebit`
- `openCashFlow` / `closeCashFlow`, `openContracts` / `closeContracts`
- `entryPrice` = `openCreditGross / openBaseContracts`
- `exitPrice` = `closeCashFlow / closeContracts / multiplier` (per-unit close price; fixture parity catches accidental 100x drift)
- `nearestShortCallExpiration`, `nextShortCallExpiration` (LIFO via `shortCallPositions` Map for rolls)
- `latestExpiration`, `openedDate` (earliest exec), `closedDate` (latest closing leg)

### `calculatePL(trade)` (app.js:4880)
```
pl = parseFloat((trade.cashFlow ?? summarizeLegs(legs).cashFlow).toFixed(2))
```
**Override for held-stock Wheel/PMCC (app.js:5727):** if `heldStockShares > 0 || heldLongCallContracts > 0` and not closed → `pl = unrealizedPL = marketValue − effectiveCostBasis`.

### `calculateROI(trade)` (app.js:4894)
```
capital = getCapitalAtRisk(trade)
roi = capital > 0 ? round2((pl / capital) * 100) : 0
```
Held-stock override (app.js:5734): `roi = (unrealizedPL / effectiveCostBasis) × 100`.

### `calculateMaxRisk(trade)` / `getCapitalAtRisk(trade)` (app.js:4934 / 4973)
Waterfall:
1. `trade.maxRiskOverride` if finite > 0
2. `computeMaxRiskUsingFormula(trade, summary)` (per-strategy handler)
3. `trade.capitalAtRisk` (legacy)
4. `trade.maxRisk` (legacy)
5. `0`. Returns `+Infinity` for unlimited-risk strategies — excluded from sums via `Number.isFinite()` (app.js:7633).

### `calculateDaysHeld(trade)` (app.js:4912)
```
entryDate = parseDateValue(trade.entryDate || trade.openedDate)
exitDate = isClosedStatus(status) ? exitCandidate : currentDate    // currentDate is a getter
diffDays = ceil((exitDate - entryDate) / 86_400_000)
return max(1, diffDays)
```
**Open trades accrue against live `new Date()` on every enrichment.**

### Period ROI (only for closed trades; otherwise 0)
- `calculateAnnualizedROI` (app.js:5012): `round2((365 * roi) / daysHeld)`
- `calculateWeeklyROI` (app.js:5034): `round2((7 * roi) / daysHeld)`
- `calculateMonthlyROI` (app.js:5056): `round2((30 * roi) / daysHeld)`

### `calculateDTE(expirationDate, trade)` (app.js:4852)
PMCC uses `trade.pmccShortExpiration`. Closed trades return 0. Cutoff at 21:00 UTC.

### `computeWheelEffectiveCostBasis(trade)` (app.js:6039)

**Standard Wheel:**
```
stockShares = Σ(BTO STOCK qty × mult)
stockCost   = Σ(|cashFlow|  for BTO STOCK)
optionCashFlow = Σ(cashFlow for all PUT/CALL legs)
effectiveCostBasis = stockCost − optionCashFlow
```

**PMCC:**
```
longCallCost  = Σ(|cashFlow| for BTO CALL OPEN legs)
shortCallNet  = Σ(cashFlow for all other CALL legs)
effectiveCostBasis = longCallCost − shortCallNet
```

Returns `{ shares, assignmentCostBasis, effectiveCostBasis }`.

### `calculateAdvancedStats()` (app.js:7439) — portfolio aggregates

**Weighted annualized ROI** (app.js:7533):
```
weight_i  = capitalAtRisk_i × daysHeld_i
totalROI  = Σ(annualizedROI_i × weight_i) / Σ(weight_i)
```
`totalROI` and `annualizedROI` are set to the same value (app.js:7557).

**Max drawdown** (app.js:7516): chronological cumulative P&L; running peak; `drawdown = (peak − cum) / peak × 100` only when `peak > 0`. Reported as a percentage.

**Per-trade daily return** (geometric, app.js:7571):
```
growth = 1 + roi/100
dailyReturn = growth > 0 ? growth^(1/daysHeld) − 1
                         : (roi/100) / daysHeld
```

**Sharpe** (app.js:7616): `(mean / sampleStdDev) × √252`; `null` when stdDev = 0. Sample (N−1) std dev.

**Sortino** (app.js:7617): `(mean / downsideDev) × √252`; `downsideDev = √mean(neg_return²)`. `+Infinity` when no losses and mean > 0; `null` when no negatives and mean ≤ 0.

**Profit factor** (app.js:7509): `wins/losses`; `+Infinity` when losses=0, wins>0 (compacted out of MCP via `r4()`).

**Expectancy** (app.js:7660): `(winRate × avgWin) − (lossRate × avgLoss)`.

**realizedPL** (app.js:7640): `totalClosedPL + assignedPL`.
**unrealizedPL** (app.js:7644): Σ pl on active opens + Σ unrealizedPL on awaiting-coverage.

### Time windows — `getClosedTradesInRange(range)` (app.js:12558)
`'7D' | 'MTD' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'`. Filters by `closedDate || exitDate` against live `currentDate`.

### Monte Carlo — `generateMonteCarloProjection()` (app.js:11068)
Bootstrap resampling. **400 simulations × 60 periods.** Each step samples a historical `dailyReturn`, clamped `[−0.95, 5]`, equity *= (1+sample), floored at 0. Returns `{ labels, percentiles: { p10, p25, p50, p75, p90 } }` as equity-multiplier series.

### Numeric guards
- `validateNumber(v, {min, max, allowZero, defaultValue})` (app.js:1578): finiteness + range check, returns `defaultValue` on failure.
- `validateDate(s)` (app.js:1597): returns string unchanged if `new Date(s)` is valid, else `null`.
- `sanitizeString(v, maxLength=1000)` (app.js:1606): trim + truncate; no HTML escape.
- `parseDecimal(v)` (app.js:7143): handles US (`1,234.56`) and EU (`1.234,56`) formats.
- `safeLocalStorage` (app.js:1542): try/catch wrapper for quota + privacy-mode failures.

---

## 8. Storage layer

### Active key
- `GammaLedgerLocalDatabase` — full DB envelope.

### Migration: legacy → current (app.js:20627–20676)
`LEGACY_STORAGE_KEYS = ['GammaLedgerTrades', 'GammaLedgerDatabase', 'GammaLedgerLocalState', 'GammaLedgerState']`. On load: if current key missing, walks legacy keys; if a value is a plain `Array`, wraps as v2.5 envelope, applies `tradeReasoning → notes` rename, enriches, persists, removes legacy keys.

### `tradeReasoning → notes` rename (app.js:20510)
Both load paths apply:
```js
if (trade.tradeReasoning && !trade.notes) {
  trade.notes = trade.tradeReasoning;
  delete trade.tradeReasoning;
}
```

### File System Access API
`showSaveFilePicker` / `showOpenFilePicker` for `.json` (Chrome/Edge). `currentFileHandle` is in-memory only — never persisted. Fallback for Firefox/Safari: `Blob` + `<a download>` and hidden `<input type="file">`.

---

## 9. Migration-critical invariants (gotchas)

1. **`currentDate` is a getter** (app.js:1537) — `new Date()` every read. `daysHeld` for open trades is non-deterministic across saves.
2. **STOCK leg `multiplier` defaults to 100, not 1** (app.js:1885) — `quantity:1, multiplier:100` = 100 shares.
3. **STOCK leg `premium` falls back to `strike` if 0** (app.js:1949).
4. **Lifecycle key uses `strike.toFixed(4)`** (app.js:5080) — float drift past 4 d.p. breaks pair-matching.
5. **Rolled positions: LIFO `nextShortCallExpiration`** via `shortCallPositions` Map (app.js:2001).
6. **`Expired` is a closed status** for P&L purposes (app.js:4762).
7. **`awaiting_coverage` is NOT persisted** — always derived (app.js:5676).
8. **Mark-to-market overrides `pl` and `roi`** for held Wheel/PMCC (app.js:5733). Fallback chain for missing market price: `marketPriceSnapshot` → live Finnhub → assignment strike.
9. **`annualizedROI` is capital-days weighted**, not simple mean (app.js:7533).
10. **`profitFactor` may be `+Infinity`** — MCP context drops the field via `r4()` returning `null`.
11. **`exitPrice` divides close cashflow by contracts and multiplier**. The first Python port missed the multiplier and produced a 100x drift; keep this covered by fixture parity.
12. **`Short Call` returns `+Infinity` for max risk**; `riskIsUnlimited: true`; excluded from `collateralAtRisk` sum.
13. **Option expiry cutoff 21:00 UTC** (4 PM ET).
14. **`quantity` runtime field is sign-bearing for options** (negative for shorts), always positive for stock (app.js:5554).
15. **Sample data version `'3.1'`** is cosmetic — only `Array.isArray(data.trades)` is checked on import.
