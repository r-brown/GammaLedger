# Phase 2 — Domain Object Catalogue

> Read-only inventory of every distinct domain object shape used in the
> live code. Companion to `phase2-analysis.md` (the type-unsafe hotspot
> report).
>
> This catalogue is the source of truth for the TypeScript type library
> in `src/types/` (Phase 2, Step 3). Types are described in plain
> language; the actual `.ts` declarations are written in Step 3 from
> this document.
>
> Source files surveyed: same as `phase2-analysis.md`. The bulk of
> shape-producing code lives in `src/legacy/app.js`.

---

## How to read this catalogue

Each entry has:

- **Name** — proposed PascalCase interface/type name.
- **Where created** — file:line of the producer site.
- **Where read** — representative consumer sites (3-6, not exhaustive).
- **Persisted to localStorage?** — yes / no / partial (with notes).
- **Fields** — name, observed type, source/notes.
- **Notes** — anything tricky.

Field type notation:

- `string`, `number`, `boolean`, `null`, `Date` — JS built-ins.
- `ISODate` — string in `"YYYY-MM-DD"` format.
- `ISOTimestamp` — string in `"YYYY-MM-DDTHH:mm:ss.sssZ"` format.
- `'a' | 'b'` — string-literal union (magic-string enum).
- `T | null` — explicit null.
- `T?` — optional / may be absent.
- `Map<K, V>` — JS Map with key/value types.

---

## §1 — Trade (Persisted)

The minimal trade shape that lives in localStorage. Produced by
stripping `RUNTIME_TRADE_FIELDS` from the enriched trade.

- **Where created** — `buildTradeStorageSnapshot` (`src/legacy/app.js:15166`).
- **Where read** — `loadFromStorage` (`app.js:18985+`),
  `processLoadedData` (`app.js:15700+`), legacy migrators
  (`app.js:19036-19049`).
- **Persisted** — yes (the canonical persisted shape).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Identifier; UUID, timestamp-based, or import-derived. |
| `ticker` | `string` | Underlying symbol; uppercased on input. |
| `strategy` | `string` | One of ~45 strategy display names; not validated. See `creditPlaybookStrategyOptions` and `getStrategyDisplayName` (`app.js:145-209`, `~20730`). |
| `underlyingType` | `'Stock' \| 'ETF' \| 'Index' \| 'Future'` | Defaults to `'Stock'`. |
| `legs` | `PersistedLeg[]` | Always an array; replaced with `[]` if missing. |
| `openedDate` | `ISODate` | Earliest leg execution; written by enrichment. |
| `closedDate` | `ISODate \| ''` | Empty string if not closed. |
| `expirationDate` | `ISODate \| ''` | Latest leg expiration. |
| `notes` | `string?` | User-entered. |
| `maxRiskOverride` | `number \| null` | User override of computed max risk. |
| `status` | `'Open' \| 'Closed' \| 'Assigned' \| 'Expired' \| 'Rolling' \| 'awaiting_coverage'?` | May be absent on legacy data. |

**Notes**

- The list above is the *minimum*. `buildTradeStorageSnapshot`
  iterates every key on the trade object; whatever fields the trade
  carries that are NOT in `RUNTIME_TRADE_FIELDS` get persisted.
  Migrating user data may carry additional vendor fields.
- Counter-intuitively, several user-meaningful fields ARE in the
  runtime set and so are NOT persisted: `tradeReasoning`,
  `wheelCoverage`, `shares`, `effectiveCostBasis`, `marketValue`,
  `unrealizedPL`, `marketPriceSource`, `entryDate`, `exitDate`. This
  is partially intentional (most are derived from legs) and
  partially a bug (`tradeReasoning` is user-entered free text;
  losing it on save is surprising). See `phase2-analysis.md §16`.
- Field-name aliasing: `entryDate` ≈ `openedDate`, `exitDate` ≈
  `closedDate`. The persisted shape uses `openedDate`/`closedDate`;
  the enriched runtime shape carries both and keeps them in sync
  (`app.js:4314-4315`). Pick one canonical name in TS.

---

## §2 — Trade (Enriched / Runtime)

The shape after `enrichTradeData(trade)` runs. This is what every UI
component and statistic calculator consumes.

- **Where created** — `enrichTradeData` (`src/legacy/app.js:4180-4400+`).
- **Where read** — dashboard tables, charts, stats, AI agents,
  per-trade payoff renderer, share card.
- **Persisted** — no (stripped on save back to `Trade` persisted).

Inherits all persisted `Trade` fields, plus:

| Field | Type | Notes |
|---|---|---|
| `legsCount` | `number` | Mirror of `legs.length`. |
| `openContracts` | `number` | `Math.max(0, legSummary.openContracts - legSummary.closeContracts)`. |
| `closeContracts` | `number` | From legSummary. |
| `openLegs` | `number` | `Math.max(0, legSummary.openLegs - legSummary.closeLegs)` — note: this is a **count**, not an array (different from the LegSummary field of the same name). |
| `rollLegs` | `Leg[]` | Forwarded from legSummary; this IS an array. |
| `totalFees` | `number` | Rounded to 4 decimals. |
| `totalDebit` | `number` | Rounded to 2 decimals. |
| `totalCredit` | `number` | Rounded to 2 decimals. |
| `cashFlow` | `number` | Rounded to 2 decimals. |
| `capitalAtRisk` | `number \| typeof Infinity` | Rounded to 2 decimals if finite. |
| `fees` | `number` | Alias of `totalFees`. |
| `primaryLeg` | `NormalizedLeg \| null` | From legSummary. |
| `tradeType` | `string` | E.g. `'spread'`, `'single'`, `'wheel'`, `'pmcc'`. Not enumerated centrally. |
| `tradeDirection` | `'long' \| 'short' \| 'debit' \| 'credit' \| 'neutral' \| 'long_stock'` | From `deriveTradeDirectionFromLeg`. |
| `quantity` | `number` | Sign-aware (negative for short). |
| `strikePrice` | `number \| null` | Primary strike. |
| `multiplier` | `number` | From primary leg. |
| `displayStrike` | `string` | Human-readable strike (e.g. `"100/105"` for spreads). |
| `activeStrikePrice` | `number \| null` | Strike on the active leg if rolled. |
| `entryPrice` | `number \| null` | Per-contract average entry premium (rounded 4 decimals). |
| `exitPrice` | `number \| null` | Per-contract average exit (rounded 4 decimals). |
| `pmccShortExpiration` | `ISODate \| ''` | If PMCC, the next short call expiration. |
| `longExpirationDate` | `ISODate \| ''` | Latest leg expiration. |
| `entryDate` | `ISODate \| ''` | Alias of `openedDate`. |
| `exitDate` | `ISODate \| ''` | Alias of `closedDate`. |
| `pl` | `number` | Realized P&L; `0` for fully open. |
| `roi` | `number` | Decimal (e.g. `0.15` = 15%). |
| `maxRisk` | `number \| typeof Infinity` | Same as `capitalAtRisk`; carried for legacy callers. |
| `maxRiskLabel` | `string` | Pre-formatted currency or `'Unlimited'` or `'—'`. |
| `riskIsUnlimited` | `boolean` | True when maxRisk is `Infinity`. |
| `lifecycleMeta` | `LifecycleMeta` | See §6. |
| `lifecycleStatus` | `'Open' \| 'Closed' \| 'Assigned' \| 'Expired' \| 'Rolling' \| 'awaiting_coverage'` | Includes the special override at `app.js:4341`. |
| `partialClose` | `boolean` | True if `closeContracts > 0 && openContracts > 0`. |
| `rolledForward` | `boolean` | True if any leg has a roll marker. |
| `autoExpired` | `boolean` | True if expiration passed without close activity. |
| `daysHeld` | `number` | Days between openedDate and (closedDate or today). |
| `dte` | `number` | Days to nearest expiration; negative if past. |
| `weeklyROI` | `number` | Annualized to 7-day basis. |
| `monthlyROI` | `number` | Annualized to 30-day basis. |
| `annualizedROI` | `number` | Annualized to 365-day basis. |
| `tradeReasoning` | `string?` | User free text; **stripped on save**. |
| `wheelCoverage` | `'covered' \| 'partial' \| 'uncovered' \| null` | For wheel/PMCC. |
| `shares` | `number?` | Held shares for wheel/PMCC. |
| `effectiveCostBasis` | `number?` | After premium offset. |
| `marketValue` | `number?` | Mark-to-market on held shares. |
| `unrealizedPL` | `number?` | MTM P&L on held position. |
| `marketPriceSource` | `'finnhub' \| 'manual' \| null \| undefined` | Where the price came from. |

**Notes**

- `enrichTradeData` mutates the spread-cloned input. Successive
  enrichments are idempotent (each rebuilds from `legs`).
- `legs` is replaced by the normalized leg array from `summarizeLegs`,
  so the in-memory legs are the `NormalizedLeg` shape (§4), not
  `PersistedLeg` (§3).
- `optionType` is explicitly `delete`d at `app.js:4182` — legacy
  field, no longer carried.
- Field count: persisted ~10 fields + enriched ~38 fields = ~48
  fields total on a runtime trade object.

---

## §3 — Leg (Persisted)

What lives inside `Trade.legs[]` in localStorage.

- **Where created** — `buildLegStorageSnapshot` (`src/legacy/app.js:15219`).
- **Where read** — every consumer of trades; immediately re-normalized
  on enrichment.
- **Persisted** — yes.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `LEG-{timestamp}-{index}` if not provided. |
| `orderType` | `'BTO' \| 'STO' \| 'BTC' \| 'STC' \| null` | Result of `normalizeLegOrderType`. |
| `type` | `'CALL' \| 'PUT' \| 'STOCK' \| 'CASH'` | Uppercased. |
| `quantity` | `number` | Signed quantity; absolute value used downstream. |
| `multiplier` | `number` | `100` for options, typically `1` for stock (but stock legs sometimes use 100; see §6 note). |
| `executionDate` | `ISODate \| ''` | When leg was executed. |
| `expirationDate` | `ISODate \| ''` | Empty for stock legs. |
| `strike` | `number \| null` | For stock legs without a real strike, `null`. For STOCK with `premium===0`, the per-share price is stored in `strike` (`app.js:617`). |
| `premium` | `number` | Per-share/contract premium. |
| `fees` | `number` | Transaction fees. |
| `underlyingPrice` | `number \| null` | Underlying spot at execution. |
| `underlyingType` | `'Stock' \| 'ETF' \| 'Index' \| 'Future'` | Per-leg override if present. |
| `action` | `'BUY' \| 'SELL'?` | Legacy; deprecated in favor of `orderType`. May or may not be present on persisted legs. |
| `side` | `'OPEN' \| 'CLOSE' \| 'ROLL'?` | Legacy; same. |
| `tradeType` | `string?` | Legacy alias of `orderType`; some imports use this. |
| `order` | `string?` | Legacy alias; some hand-entered legs use this. |
| `isAssignment` | `boolean?` | Marker for assignment legs. |
| `notes` | `string?` | Per-leg notes. |

**Notes**

- The five fields `externalId`, `importGroupId`, `importSource`,
  `importBatchId`, `tickerSymbol` are in `RUNTIME_LEG_FIELDS` and are
  **stripped** before save. They are populated by the import pipeline
  and used during the same session for merge logic, then dropped.
  This means re-imports cannot dedupe against persisted legs — flag
  for human review (`phase2-analysis.md §16`).
- The `orderType` / `action` / `side` / `tradeType` / `order` cluster
  all encode the same concept (open vs. close, long vs. short).
  `normalizeLeg` resolves to a single `orderType`; the others are
  carried for legacy compat.

---

## §4 — Leg (Normalized, runtime)

The strict 14-field shape returned by `normalizeLeg(leg, index)`.

- **Where created** — `normalizeLeg` (`src/legacy/app.js:558-600`).
- **Where read** — `summarizeLegs` (operates exclusively on
  normalized legs); the lifecycle determinator; risk, P&L, and
  payoff calculations.
- **Persisted** — no (the persisted leg has fewer fields and may have
  legacy aliases).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Generated if missing. |
| `orderType` | `'BTO' \| 'STO' \| 'BTC' \| 'STC' \| null` | Result of inference chain. |
| `type` | `'CALL' \| 'PUT' \| 'STOCK' \| 'CASH'` | Uppercased. |
| `quantity` | `number` | NaN-safe; defaults to `0`. |
| `multiplier` | `number` | From `getLegMultiplier`. |
| `executionDate` | `ISODate \| ''` | Re-formatted to ISO via `new Date().toISOString().slice(0,10)`. |
| `expirationDate` | `ISODate \| ''` | Same. |
| `strike` | `number \| null` | NaN-safe. |
| `premium` | `number` | Defaults to `0` if non-finite. |
| `fees` | `number` | Defaults to `0` if non-finite. |
| `underlyingPrice` | `number \| null` | NaN-safe. |
| `underlyingType` | `'Stock' \| 'ETF' \| 'Index' \| 'Future'` | Defaulted. |
| `externalId` | `string \| null` | Trimmed; empty becomes null. |
| `importGroupId` | `string \| null` | Same. |
| `importSource` | `string \| null` | Same. |

**Notes**

- The output is *strictly* this shape — fields not in this list are
  dropped. Any per-leg notes from the persisted shape are lost on
  enrichment unless the caller carries them separately.
- Used as the input to lifecycle and P&L calculations; the strict
  shape eliminates the `action`/`side`/`tradeType` aliasing
  ambiguity downstream.

---

## §5 — LegSummary

The aggregated result of running `summarizeLegs` over a trade's legs.

- **Where created** — `summarizeLegs` (`src/legacy/app.js:625-1003`).
- **Where read** — `enrichTradeData` (line 4189); risk and P&L
  calculations (`app.js:1011, 1059, 1261, 1789, 1903, 1953, 2341,
  3549, 3609, 3647`); credit playbook detail; payoff series.
- **Persisted** — no.

| Field | Type | Source |
|---|---|---|
| `legs` | `NormalizedLeg[]` | All legs after `normalizeLeg`. |
| `legsCount` | `number` | `legs.length`. |
| `openLegs` | `number` | Count of legs with side `OPEN`. |
| `closeLegs` | `number` | Count of legs with side `CLOSE`. |
| `rollLegs` | `number` | Count of legs with side `ROLL`. |
| `totalFees` | `number` | Sum of all leg fees. |
| `totalDebit` | `number` | Sum of buy-side cashflows + their fees. |
| `totalCredit` | `number` | Sum of sell-side cashflows + their fees. |
| `cashFlow` | `number` | Net debit/credit across all legs. |
| `openCashFlow` | `number` | Cashflow from open-side legs only. |
| `closeCashFlow` | `number` | Cashflow from close-side legs only. |
| `openedDate` | `Date \| null` | Earliest execution date. |
| `closedDate` | `Date \| null` | Latest execution date. |
| `earliestExpiration` | `Date \| null` | Earliest expiration. |
| `latestExpiration` | `Date \| null` | Latest expiration. |
| `primaryLeg` | `NormalizedLeg \| null` | First non-CLOSE leg, or first leg overall. May be replaced by an active short leg if rolled. |
| `openContracts` | `number` | Sum of \|qty\| over OPEN side. |
| `closeContracts` | `number` | Sum of \|qty\| over CLOSE side. |
| `capitalAtRisk` | `number \| typeof Infinity` | From `computeMaxRiskUsingFormula` over all normalized legs. |
| `entryPrice` | `number \| null` | Per-contract average entry premium. |
| `exitPrice` | `number \| null` | Per-contract average exit premium. |
| `openCreditGross` | `number` | Sum of gross premium for open SELL legs. |
| `openDebitGross` | `number` | Sum of gross premium for open BUY legs. |
| `openFees` | `number` | Sum of fees on open-side legs. |
| `openBaseContracts` | `number` | Max aggregated quantity across lifecycle keys. |
| `verticalSpread` | `{ width: number; multiplier: number; contracts: number } \| null` | Detected vertical-spread shape. |
| `nearestShortCallExpiration` | `Date \| null` | Earliest active (net-open) short call expiration. |
| `nextShortCallExpiration` | `Date \| null` | Earliest active short call expiration that has not yet passed market close. |
| `activeOpenLegs` | `NormalizedLeg[]` | LIFO-reduced active legs after roll deduplication. **Added later in the function** (line 869). |
| `hasClosedOutOpenLegs` | `boolean` | True if any open legs have matching closes (rolled). **Added later** (line 870). |

**Notes**

- 31 fields total — the largest single domain shape.
- `Date | null` fields are *Date objects*, not ISO strings.
  `enrichTradeData` converts them to ISO strings before assigning to
  the trade.
- `verticalSpread` is the *only* non-primitive nested struct.
- The shape is built incrementally — `activeOpenLegs` /
  `hasClosedOutOpenLegs` are tacked on after the main pass. TS
  should declare them as required (always present once the function
  returns) even though the literal source code looks optional.

---

## §6 — LegLifecycleResult

Output of `determineTradeLifecycleStatus(trade, summary)`.

- **Where created** — `determineTradeLifecycleStatus`
  (`src/legacy/app.js:3760-3950+`).
- **Where read** — `enrichTradeData` (line 4329-4341), where the
  result drives `lifecycleStatus` and `lifecycleMeta`.
- **Persisted** — no (status is denormalized onto the trade as
  `lifecycleStatus`; `meta` is denormalized as `lifecycleMeta`).

| Field | Type | Notes |
|---|---|---|
| `status` | `'Open' \| 'Closed' \| 'Assigned' \| 'Expired' \| 'Rolling'` | Pre-override status. |
| `exitReason` | `'cash_settlement' \| 'assignment' \| 'expiration' \| 'roll' \| null` | Reason for closure. |
| `effectiveClosedDate` | `ISODate \| null` | Date the position effectively closed (may differ from `Trade.closedDate`). |
| `openContractsOverride` | `number \| undefined` | If set, overrides `openContracts` on the enriched trade. |
| `meta` | `LifecycleMeta` | See below. |

**`LifecycleMeta` (the `meta` sub-shape):**

| Field | Type | Notes |
|---|---|---|
| `matchedPairs` | `number \| boolean` | Count of paired BTO/STC, STO/BTC events; initialized as `false` (line 3768) but later set to numeric count. **Type is mixed** — TS should pick `number` and seed with `0`. |
| `unmatchedExposure` | `number` | Net unpaired exposure. |
| `expirationPassed` | `boolean` | Any leg has expiration ≤ today. |
| `hasRollLegs` | `boolean` | At least one leg marked as a roll. |
| `hasCloseActivity` | `boolean` | At least one CLOSE-side leg present. |
| `hasAssignmentEvent` | `boolean` | Assignment marker found. |
| `hasExpirationEvent` | `boolean` | Expiration marker found. |
| `hasOpenStockPosition` | `boolean` | Stock bought > stock sold. |
| `hasCashSettlementEvent` | `boolean?` | Set true for CASH-type legs. Not initialized on the literal at line 3767 — added during traversal. **TS: declare as required, default false.** |
| `activityAfterExpiration` | `boolean?` | Same — added conditionally. |

**Notes**

- The literal at `app.js:3762-3777` initializes `matchedPairs: false`
  but later assigns a count. Phase 2 should clean this up — the
  initial `false` is a mistake. Type as `number`, init to `0`.
- Stock leg multiplier handling at line 3814: `Math.abs(Number(leg
  .multiplier) || 100)`. The 100 default is intentional for stock
  legs that store quantity as contract-count. Worth a comment in TS.

---

## §7 — Stats / AdvancedStats

Output of `calculateAdvancedStats()`.

- **Where created** — `calculateAdvancedStats`
  (`src/legacy/app.js:7324+`).
- **Where read** — `updateDashboard`, `buildMCPContext`,
  `LocalInsightsAgent.updateContext`,
  `GeminiInsightsAgent.updateContext`, share-card metrics.
- **Persisted** — partial; embedded inside `mcpContext` field of
  the storage payload (§14), but recomputed on every load.

Approximate field set (read full source in Phase 2 conversion):

| Field | Type | Notes |
|---|---|---|
| `totalTrades` | `number` | All trades. |
| `closedTrades` | `number` | Count. |
| `activePositions` | `number` | Count of open. |
| `assignedPositions` | `number` | Count of assigned. |
| `totalPL` | `number` | Sum of `pl` over closed. |
| `realizedPL` | `number` | Sum of realized cashflows. |
| `unrealizedPL` | `number` | Sum of mark-to-market on open wheel/PMCC. |
| `wins` | `number` | Closed trades with pl > 0. |
| `losses` | `number` | Closed trades with pl < 0. |
| `winRate` | `number` | Percent (0-100). |
| `profitFactor` | `number \| typeof Infinity` | Gross winnings / gross losses. |
| `avgWin` | `number` | Average winning P&L. |
| `avgLoss` | `number` | Average losing P&L. |
| `avgWinnerDays` | `number` | Average days held by winners. |
| `avgLoserDays` | `number` | Average days held by losers. |
| `expectancy` | `number` | Per-trade expected value. |
| `totalROI` | `number` | Decimal. |
| `annualizedROI` | `number` | Decimal. |
| `maxDrawdown` | `number` | Percent (0-100). |
| `dailyReturns` | `number[]` | Per-day return percentages. |
| `meanDailyReturn` | `number` | Average. |
| `dailyStdDev` | `number` | Std dev of daily returns. |
| `downsideDeviation` | `number` | Std dev of negative-return days only. |
| `sharpeRatio` | `number` | meanDailyReturn / dailyStdDev. |
| `sortinoRatio` | `number` | meanDailyReturn / downsideDeviation. |
| `totalFees` | `number` | Sum of leg fees. |
| `totalInvestment` | `number` | Total capital deployed. |
| `collateralAtRisk` | `number` | Sum of capital-at-risk over open. |
| `closedTradesList` | `EnrichedTrade[]` | Full list. |
| `openTradesList` | `EnrichedTrade[]` | Full list. |
| `assignedTradesList` | `EnrichedTrade[]` | Full list. |
| `tickerPerformance` | `TickerPerformance` | See §8. |
| `assignmentStats` | `AssignmentStats` | See §9. |

---

## §8 — TickerPerformance

- **Where created** — `calculateTickerPerformance` (in
  `calculateAdvancedStats`).
- **Where read** — dashboard ticker heatmap, AI agent context.
- **Persisted** — partial via mcpContext.

| Field | Type | Notes |
|---|---|---|
| `items` | `TickerPerformanceItem[]` | Sorted by totalPL desc. |
| `maxMagnitude` | `number` | Largest \|pl\| for chart scaling. |

`TickerPerformanceItem`:

| Field | Type |
|---|---|
| `ticker` | `string` |
| `totalPL` | `number` |
| `tradeCount` | `number` |
| `wins` | `number` |
| `losses` | `number` |
| `avgPL` | `number` |
| `winRate` | `number` (0-100) |

---

## §9 — AssignmentStats

- **Where created** — `calculateAssignmentStats`
  (`src/legacy/app.js:7858+`).
- **Where read** — assigned-positions table, AI agent context.
- **Persisted** — partial via mcpContext.

| Field | Type | Notes |
|---|---|---|
| `assignments` | `AssignmentRecord[]` | One entry per detected assignment. |

`AssignmentRecord`:

| Field | Type |
|---|---|
| `trade` | `EnrichedTrade` |
| `positionType` | `'wheel' \| 'pmcc' \| 'other'` |
| `normalizedLegs` | `NormalizedLeg[]` |

---

## §10 — MCPContext

Snapshot embedded in the persisted database for fast load and the
share-card.

- **Where created** — `buildMCPContext` (`src/legacy/app.js:15265+`).
- **Where read** — `buildDatabasePayload` (line 15261); MCP
  integration handler (`buildMCPTrade`, `buildMCPAssignment` —
  `app.js:16858+`).
- **Persisted** — yes (field within the storage payload).

| Field | Type | Notes |
|---|---|---|
| `stats` | `Stats` | Same shape as §7, but values rounded via `r2`/`r4` helpers (`app.js:15270-15278`). |
| `plByRange` | `Record<'7D' \| 'MTD' \| '1M' \| '3M' \| 'YTD' \| '1Y', number \| null>` | Per-range realized P&L. |
| `streak` | `{ type: 'win' \| 'loss' \| null; count: number }` | Current streak. |
| `daysSinceLastTrade` | `number?` | |
| `largestWinner` | `EnrichedTrade \| null` | |
| `largestLoser` | `EnrichedTrade \| null` | |
| `activeHorizonCount` | `Record<string, number>?` | DTE buckets. |
| `positionSummary` | `{ shortCalls: number; longCalls: number; longPuts: number; shortPuts: number }?` | |
| `assignmentRisk` | `number?` | |
| `wheelPercentage` | `number?` | |
| `pmccPercentage` | `number?` | |

**Notes**

- Field set evolves as the codebase grows. The shape on disk for old
  data may differ — treat all "extra" fields as optional.

---

## §11 — StorageSchema (the persisted database)

Top-level localStorage payload under key `GammaLedgerLocalDatabase`.

- **Where created** — `buildDatabasePayload` (`src/legacy/app.js:15256-15263`).
- **Where read** — `loadFromStorage` (`app.js:18985+`); user JSON file
  loaders.
- **Persisted** — yes (this IS the persisted shape).

| Field | Type | Notes |
|---|---|---|
| `version` | `'2.5'` | String literal; future versions will need migration. |
| `exportDate` | `ISOTimestamp` | `new Date().toISOString()`. |
| `trades` | `Trade[]` (persisted) | See §1. |
| `mcpContext` | `MCPContext` | See §10. |

**Notes**

- Phase 2 spec assumes `version: number` — the live code uses
  `string`. Either change the constant before Phase 2 or model as
  `string` and version-compare lexicographically.
- `fileName` is NOT in the saved payload (the agent's report claimed
  it was — verified absent from `buildDatabasePayload`).
- Legacy keys (4): `GammaLedgerTrades`, `GammaLedgerDatabase`,
  `GammaLedgerLocalState`, `GammaLedgerState`. Each contained an
  array of trades only; migrated to the v2.5 envelope on first
  load.

---

## §12 — AppState (the GammaLedger instance)

There is no separate `AppState` object — the class fields *are* the
state. This entry documents the state shape as a logical bag.

- **Where created** — `GammaLedger` constructor (`src/legacy/app.js:1336-1573+`).
- **Where read** — every method on the class.
- **Persisted** — partial: `trades` go via `StorageSchema`; UI prefs
  via separate keys; everything else is in-memory only.

Grouped fields (~160 total per Phase 1 inventory):

### Core data
| Field | Type | Notes |
|---|---|---|
| `trades` | `EnrichedTrade[]` | The portfolio. |
| `latestStats` | `Stats \| null` | Cache of last `calculateAdvancedStats`. |
| `currentFilteredTrades` | `EnrichedTrade[]` | Current trades-table view. |
| `currentSort` | `{ key: string \| null; direction: 'asc' \| 'desc' }` | Sort state. |
| `sortDirection` | `'asc' \| 'desc'` | Legacy mirror. |

### File / persistence
| Field | Type | Notes |
|---|---|---|
| `currentFileHandle` | `FileSystemFileHandle \| null` | File System Access API. |
| `currentFileName` | `string \| null` | Display name. |
| `hasUnsavedChanges` | `boolean` | Unsaved-indicator. |
| `supportsFileSystemAccess` | `boolean` | Feature detection result. |

### Editing
| Field | Type | Notes |
|---|---|---|
| `currentEditingId` | `string \| null` | Trade being edited. |

### Charts
| Field | Type | Notes |
|---|---|---|
| `charts` | `Record<string, ChartJsInstance>` | Dashboard chart instances. |
| `tradeDetailCharts` | `Map<string, ChartJsInstance>` | Per-trade payoff charts. |

### Imports / merge
| Field | Type |
|---|---|
| `importControlsInitialized` | `boolean` |
| `importLog` | `ImportLogEntry[]` |
| `importSummary` | `ImportSummary \| null` |
| `importMergeSelection` | `Set<string>` |
| `tradeMergeSelection` | `Set<string>` |
| `tradesMergeInitialized` | `boolean` |
| `tradesMergePanelOpen` | `boolean` |

### AI chat
| Field | Type |
|---|---|
| `aiAgent` | `LocalInsightsAgent \| GeminiInsightsAgent` |
| `aiChatMessages` | `Message[]` |
| `aiChatSessionId` | `string \| null` |
| `aiChatPendingRequest` | `Promise<unknown> \| null` |
| `aiChatOpen` | `boolean` |

### Quotes
| Field | Type |
|---|---|
| `activeQuoteEntries` | `Map<string, QuoteEntry>` |
| `quoteRefreshIntervalId` | `number \| null` |
| `autoRefreshIntervalMs` | `number` |
| `quoteRefreshKeys` | `string[]` |
| `quoteRefreshCursor` | `number` |

### Finnhub adapter
See `FinnhubState` (§15).

### Gemini adapter
See `GeminiState` (§15).

### Credit playbook
| Field | Type |
|---|---|
| `creditPlaybookStatus` | `'active' \| 'closed' \| 'all'` |
| `creditPlaybookStrategy` | `string \| 'all'` |
| `creditPlaybookHorizon` | `'all' \| string` (DTE bucket) |
| `creditPlaybookSymbol` | `string` |
| `creditPlaybookSort` | `{ key: string; direction: 'asc' \| 'desc' }` |
| `creditPlaybookEntries` | `CreditPlaybookEntry[]` |
| `creditPlaybookNeedsRefresh` | `boolean` |
| `creditPlaybookInitialized` | `boolean` |
| `creditPlaybookStrategyOptions` | `string[]` (~45 strategy names) |

### Disclaimer / consent
| Field | Type |
|---|---|
| `disclaimerBanner` | `HTMLElement \| null` |
| `disclaimerFadeMs` | `number` |
| `aiCoachConsent` | `{ banner: HTMLElement \| null; consentedAt: ISOTimestamp \| null }` |

### Sidebar
| Field | Type |
|---|---|
| `sidebarState` | `{ collapsed: boolean; mediaQuery: MediaQueryList \| null }` |

### Share card
See `ShareCardState` (§17).

### Other
| Field | Type |
|---|---|
| `cumulativePLRange` | `'7D' \| 'MTD' \| '1M' \| '3M' \| 'YTD' \| '1Y' \| 'ALL'` |
| `assignedPositionsStatusFilter` | `'open' \| 'closed' \| 'all'` |
| `defaultFeePerContract` | `number` |
| `positionHighlightConfig` | `PositionHighlightConfig` (§16) |

---

## §13 — FilterState (trades list)

There is no single FilterState object today; the filter values are
read from DOM controls on demand. For Phase 2 typing, declare the
shape that the controls collectively form.

| Field | Type | Source |
|---|---|---|
| `tickerSearch` | `string` | `#search-ticker` input |
| `status` | `('Open' \| 'Closed' \| 'Assigned' \| 'Expired' \| 'Rolling' \| 'awaiting_coverage' \| 'all')[]` | `#filter-status` multi-select |
| `strategy` | `(string \| 'all')[]` | `#filter-strategy` multi-select |
| `dateFrom` | `ISODate \| null` | (if present in UI) |
| `dateTo` | `ISODate \| null` | (if present in UI) |

**Notes**

- The credit-playbook view has its own filter set on `this.creditPlaybook*` fields (see §12).

---

## §14 — QuoteEntry

The runtime cache entry tracking a Finnhub quote for a single
trade/ticker.

- **Where created** — `getQuoteEntryKey` resolution +
  `populateQuoteCell` (`src/legacy/app.js:8550+`).
- **Where read** — active-positions table, assigned-positions table,
  credit-playbook table.
- **Persisted** — no (in-memory `Map`).

| Field | Type | Notes |
|---|---|---|
| `tradeId` | `string` | Index key. |
| `ticker` | `string` | Underlying. |
| `state` | `'idle' \| 'loading' \| 'ready' \| 'error'` | Fetch lifecycle. |
| `lastUpdated` | `number` (epoch ms) \| `null` | Stale-detection. |
| `price` | `number \| null` | Latest mid. |
| `change` | `number \| null` | Day change in dollars. |
| `changePercent` | `number \| null` | Day change percent. |
| `error` | `string \| null` | Set when `state === 'error'`. |

---

## §15 — FinnhubState / GeminiState

In-class struct fields. Not a published shape; type to keep the live
behavior intact.

### FinnhubState (`this.finnhub`)
| Field | Type |
|---|---|
| `apiKey` | `string \| null` |
| `encryptionKey` | `CryptoKey \| null` |
| `cache` | `Map<string, FinnhubQuote>` |
| `cacheTTL` | `number` (ms) |
| `outstandingRequests` | `Map<string, Promise<FinnhubQuote>>` |
| `rateLimitQueue` | `Promise<unknown>` |
| `maxRequestsPerMinute` | `number` |
| `timestamps` | `number[]` |
| `statusTimeoutId` | `number \| null` |
| `lastStatus` | `StatusMessage \| null` |
| `elements` | `Record<string, HTMLElement>` |

### `FinnhubQuote` (the cached value)
Inferred from Finnhub `/quote` endpoint:
| Field | Type |
|---|---|
| `c` | `number` (current price) |
| `h` | `number` (day high) |
| `l` | `number` (day low) |
| `o` | `number` (open) |
| `pc` | `number` (previous close) |
| `t` | `number` (timestamp) |

### GeminiState (`this.gemini`)
| Field | Type |
|---|---|
| `apiKey` | `string \| null` |
| `encryptionKey` | `CryptoKey \| null` |
| `model` | `'gemini-2.5-flash-lite' \| 'gemini-2.5-flash' \| 'gemini-2.5-pro'` |
| `maxOutputTokens` | `number` |
| `statusTimeoutId` | `number \| null` |
| `lastStatus` | `StatusMessage \| null` |
| `pendingStatus` | `StatusMessage \| null` |
| `elements` | `Record<string, HTMLElement>` |

### `StatusMessage`
Shape of `lastStatus` and `pendingStatus`:
| Field | Type |
|---|---|
| `message` | `string` |
| `variant` | `'success' \| 'error' \| 'warning' \| 'info'` |
| `autoClearMs` | `number?` |

---

## §16 — PositionHighlightConfig

| Field | Type | Notes |
|---|---|---|
| `expirationWarningDays` | `number` | DTE threshold. |
| `itmHighlightEnabled` | `boolean` | |
| `expirationHighlightEnabled` | `boolean` | |

(Confirm field names during Phase 2 — read `applyPositionHighlight`
and `updateExpirationHighlight` in `app.js:13914-14140`.)

---

## §17 — ShareCardState

| Field | Type |
|---|---|
| `root` | `HTMLElement \| null` |
| `card` | `HTMLElement \| null` |
| `button` | `HTMLButtonElement \| null` |
| `chartCanvas` | `HTMLCanvasElement \| null` |
| `chartTitle` | `HTMLElement \| null` |
| `rangeLabel` | `HTMLElement \| null` |
| `chart` | `Chart \| null` (Chart.js instance) |
| `metrics` | `ShareCardMetrics` |
| `timestamp` | `ISOTimestamp \| null` |
| `exportSize` | `number` |

`ShareCardMetrics`:
| Field | Type |
|---|---|
| `totalPL` | `number` |
| `totalROI` | `number` |
| `winRate` | `number` |
| `profitFactor` | `number \| typeof Infinity` |
| `range` | `'7D' \| 'MTD' \| '1M' \| '3M' \| 'YTD' \| '1Y' \| 'ALL'` |

---

## §18 — Wheel / PMCC / Spread shapes

The Phase 1 plan envisions `WheelCycle`, `PMCCPosition`, `SpreadPair`
as distinct types. **They are NOT distinct objects in the live code.**
A wheel or PMCC position is a regular `Trade` whose `strategy` field
identifies it; the wheel-specific computations operate on the trade's
legs directly.

The closest things to dedicated wheel/PMCC shapes:

### `WheelCoverage` (string)
- Values: `'covered' | 'partial' | 'uncovered' | null`.
- Stored on the runtime trade as `wheelCoverage`.
- Computed by `getTradeWheelCoverage` (`app.js:5800+`).

### PMCC leg detection
- `isPmccTrade(trade)` returns `boolean`.
- `extractPmccLegs(trade)` returns `{ longCall: NormalizedLeg \| null;
  shortCalls: NormalizedLeg[] }` — the closest to a `PMCCPosition`
  shape.

### Spread extraction
- `extractSpreadPair(trade)`, `extractRolledSpread(trade)`,
  `extractSingleSpread(trade)`, `extractIndividualLegPairs(trade)` —
  each returns a different intermediate shape used by the credit
  playbook. See `app.js:8800-9400` for the producer code.
- Common shape: `{ longLeg: NormalizedLeg; shortLeg: NormalizedLeg;
  width: number; expiration: ISODate }` — but variants exist.

For the type library, recommend a single `SpreadPair` interface and
a discriminated union of the variants. Read the consumers in
`src/ui/credit-playbook/` (currently empty placeholders) to confirm.

---

## §19 — CreditPlaybookEntry

Output of `getCreditPlaybookEntries`.

- **Where created** — `getCreditPlaybookEntries` and
  `mapCreditTradeToEntry` (`app.js:8800-8900+`).
- **Where read** — credit-playbook table render.
- **Persisted** — no.

Approximate fields (verify in Phase 2 conversion):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Trade or leg-pair identifier. |
| `tradeId` | `string` | Source trade. |
| `ticker` | `string` | |
| `strategy` | `string` | |
| `openedAt` | `ISODate` | From `resolveCreditPlaybookOpenedAt`. |
| `dte` | `number` | |
| `credit` | `number` | Premium received. |
| `width` | `number` | Spread width. |
| `maxRisk` | `number \| typeof Infinity` | |
| `currentPrice` | `number \| null` | From Finnhub. |
| `roi` | `number` | |
| `status` | `'active' \| 'closed'` | |
| `legs` | `NormalizedLeg[]` | The pair. |

---

## §20 — Import payloads

### `RobinhoodImportPayload`
- **Where created** — `buildRobinhoodImportPayload`
  (`app.js:18430-19440+`).
- **Where read** — `applyRobinhoodImportResult`.

| Field | Type |
|---|---|
| `trades` | `Trade[]` (proposed; not yet persisted) |
| `transactions` | `RobinhoodTransaction[]` (intermediate) |
| `errors` | `ImportError[]` |
| `summary` | `ImportSummary` |

### `OFXImportPayload`
- **Where created** — `buildOfxImportPayload`
  (`app.js:19483-20400+`).

| Field | Type |
|---|---|
| `trades` | `Trade[]` (proposed) |
| `securities` | `OFXSecurity[]` |
| `transactions` | `OFXTransaction[]` |
| `errors` | `ImportError[]` |
| `summary` | `ImportSummary` |

### Common
- `ImportSummary` — `{ totalRows: number; importedCount: number;
  duplicateCount: number; errorCount: number; mergeable: number }`.
- `ImportError` — `{ row: number; reason: string; raw: unknown }`.
- `ImportLogEntry` — `{ timestamp: ISOTimestamp; level: 'info' \|
  'warning' \| 'error'; message: string }`.

(Read producers in Phase 2 to confirm exact field names.)

---

## §21 — MCPTrade / MCPAssignment (integrations/mcp.js)

Output of `buildMCPTrade(trade)` and `buildMCPAssignment(record)`.
Used by the MCP integration to send context to external agents.

- **Where created** — `app.js:16858-17268`.
- **Persisted** — no.

Both are subset projections of the enriched trade and the assignment
record. Verify exact field set in Phase 2; both reuse types from §2
and §9.

---

## §22 — AIAgentContext

The `this.context` field on both AI agents.

- **Where created** — `LocalInsightsAgent` constructor
  (`src/ai/local-agent.js:7-10`); `GeminiInsightsAgent` constructor
  (`src/ai/gemini-agent.js:14-20`).
- **Where read** — every method that builds prompts or generates a
  reply.
- **Persisted** — no.

| Field | Type |
|---|---|
| `stats` | `Stats \| null` |
| `openTrades` | `EnrichedTrade[]` |

---

## §23 — Message (AI chat)

| Field | Type |
|---|---|
| `id` | `string` |
| `role` | `'user' \| 'assistant'` |
| `content` | `string` |
| `timestamp` | `number` (epoch ms) |

In-memory only; not persisted across reloads.

---

## §24 — ToastNotification options

Argument shape to `showNotification`.

| Field | Type |
|---|---|
| `message` | `string` |
| `type` | `'success' \| 'error' \| 'warning' \| 'info'` |
| `durationMs` | `number?` |

---

## §25 — Other primitives

The following are not domain objects but appear in many type
signatures and warrant short type aliases:

| Alias | Underlying | Used for |
|---|---|---|
| `ISODate` | `string` | `"YYYY-MM-DD"` strings. |
| `ISOTimestamp` | `string` | Full `Date.toISOString()` strings. |
| `DollarAmount` | `number` | Per-share or absolute dollars. |
| `ContractCount` | `number` | Number of option contracts. |
| `ShareCount` | `number` | Number of shares (= contracts × multiplier). |
| `StrikePrice` | `number` | Strike. |
| `Multiplier` | `number` | 100 for options, varies for stock. |
| `Percent` | `number` | Used inconsistently — sometimes 0-1 (decimal), sometimes 0-100. **Document the convention per call site.** |

---

## Summary of shape-to-file mapping for Phase 2 Step 3

| Type file (proposed) | Contains |
|---|---|
| `src/types/common.ts` | §25 primitives + all magic-string enums. |
| `src/types/leg.ts` | §3 `Leg` (persisted), §4 `NormalizedLeg`. |
| `src/types/trade.ts` | §1 `Trade` (persisted), §2 `EnrichedTrade`. |
| `src/types/leg-summary.ts` | §5 `LegSummary`. |
| `src/types/lifecycle.ts` | §6 `LegLifecycleResult`, `LifecycleMeta`. |
| `src/types/stats.ts` | §7 `Stats`, §8 `TickerPerformance`, §9 `AssignmentStats`. |
| `src/types/storage.ts` | §10 `MCPContext`, §11 `StorageSchema`. |
| `src/types/state.ts` | §12 `AppState` and sub-shapes. |
| `src/types/ui.ts` | §13 `FilterState`, §14 `QuoteEntry`, §16 `PositionHighlightConfig`, §17 `ShareCardState`+`ShareCardMetrics`, §24 `ToastOptions`. |
| `src/types/integrations.ts` | §15 `FinnhubState`+`FinnhubQuote`, `GeminiState`+`StatusMessage`. |
| `src/types/wheel.ts` | §18 `WheelCoverage`, PMCC extraction. |
| `src/types/spreads.ts` | §18 spread extraction shapes. |
| `src/types/credit-playbook.ts` | §19 `CreditPlaybookEntry`. |
| `src/types/imports.ts` | §20 `RobinhoodImportPayload`, `OFXImportPayload`, `ImportSummary`, `ImportError`, `ImportLogEntry`. |
| `src/types/mcp.ts` | §21 `MCPTrade`, `MCPAssignment`. |
| `src/types/ai.ts` | §22 `AIAgentContext`, §23 `Message`. |
| `src/types/index.ts` | re-exports. |

---

## What this catalogue deliberately does NOT do

- It does not propose TypeScript syntax. The plain-language field
  tables map 1:1 to the `.ts` declarations to be written in Step 3.
- It does not enumerate every field on the `GammaLedger` class —
  Phase 1 already did that for the constructor (~50 fields) and the
  lazy fields (~110 more). For Phase 2 typing, the §12 grouping is
  sufficient.
- It does not resolve the field-aliasing questions
  (`entryDate`/`openedDate`, `orderType`/`tradeType`/`order`,
  `action`/`side` legacy). Those are flagged in `phase2-analysis.md
  §16` for human decision before Step 3 runs.
- It does not catalogue Chart.js dataset shapes — those are vendor
  types. Phase 2 Step 2 will install `@types/chart.js` (or use
  `chart.js`'s built-in types if v4) and the chart code will type
  against them.
- It does not include payoff-series result shapes —
  `calculatePayoffSeries` and friends still live in `app.js`; the
  output shape is variant per strategy. Defer to Wave 6 conversion.
