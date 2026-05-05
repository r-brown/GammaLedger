# Phase 2 — Type-Unsafe Hotspot Analysis

> Read-only audit of the live JS code, performed before any TypeScript work
> begins. Companion to `phase2-domain-objects.md` (the domain object
> catalogue).
>
> Source files surveyed:
> - `src/legacy/app.js` (19,101 LOC — 95% of live logic)
> - `src/core/{config,sample-data,storage}.js`
> - `src/utils/{dates,dom,formatting,crypto,import-csv}.js`
> - `src/ai/{local-agent,gemini-agent}.js`
>
> All other `src/` subdirs are 1-line placeholders from the Phase 1
> skeleton — Wave-3 onward of the JS-module refactor has not landed yet.

---

## 0. Context for the report

Phase 1 is **partially complete**. The class `GammaLedger` still owns the
bulk of the logic in `src/legacy/app.js`. Six small modules have been
extracted (config, sample-data, storage wrapper, three utils, two AI
agents). All "trade model" / "calculations" / "ui" / "imports" / etc.
modules are still empty placeholders. References below are predominantly
to `src/legacy/app.js` because that is where the live behavior lives.

The TypeScript migration must therefore type the **legacy class as it
stands today**, not a hypothetical post-Phase-1 module layout. A type
defined now will continue to apply after the rest of Phase 1 lands —
the source moves, the shapes do not.

---

## 1. Mixed string/number for financial values

The codebase consistently *coerces to number at the boundary* (form
inputs, CSV/OFX imports, localStorage round-trips), but the coercion is
hand-rolled and inconsistent. Every financial field is a number once it
reaches `summarizeLegs` / `calculatePL` / `enrichTradeData`, but the
journey is leaky.

### 1.1 — Premium, fees, strike, quantity coercion in `normalizeLeg`

`src/legacy/app.js:583-599` — pattern repeated for every numeric leg
field:

```js
strike:   Number.isFinite(Number(leg?.strike))   ? Number(leg.strike)   : null,
premium:  Number.isFinite(Number(leg?.premium))  ? Number(leg.premium)  : 0,
fees:     Number.isFinite(Number(leg?.fees))     ? Number(leg.fees)     : 0,
underlyingPrice: Number.isFinite(Number(leg?.underlyingPrice))
  ? Number(leg.underlyingPrice) : null,
```

- Double `Number()` evaluation per field (cheap but wasteful).
- The fallback for `premium`/`fees` is `0`, indistinguishable from a
  legitimate `0`. A corrupt import row produces a silent zero.
- `strike` falls back to `null`, but downstream code at lines 703, 749,
  955-956 reads `leg.strike` and runs `Number(strike)` again — the
  null→NaN path resurfaces.

### 1.2 — `Number(x) || 0` defaults swallow legitimate zero

Throughout `summarizeLegs` (`src/legacy/app.js:680-722`):

```js
summary.totalFees   += Number(leg.fees) || 0;
summary.openFees    += Number(leg.fees) || 0;
const quantity      = Math.abs(Number(leg.quantity) || 0);
const multiplier    = this.getLegMultiplier(leg) || 1;
const grossPremium  = Math.abs(Number(leg.premium) || 0) * multiplier * quantity;
```

For `fees`/`premium` a literal `0` is fine because the fallback equals
the value. But the pattern is also applied to `multiplier || 1`
(line 691 and 964), which turns a zero multiplier into `1` rather than
flagging the bad input.

Calls to `Math.abs(Number(leg.quantity) || 0)` repeat at:
- `app.js:684, 750, 760, 822, 860, 884, 911, 968, 971, 4234, 4253,
  4256, 6692, 7440, 12447`
- Each site treats a missing/invalid quantity as zero — quantity-by-zero
  errors silently disappear.

### 1.3 — `parseFloat(x.toFixed(2))` round-trips on already-numeric values

`src/legacy/app.js:3556` (calculatePL):
```js
return parseFloat(cashFlowValue.toFixed(2));
```
Same pattern at `app.js:3573, 3676-3739` (ROI variants), and
`app.js:4196-4203` (enrichTradeData). The string round-trip is a free
opportunity to introduce locale-specific bugs (toFixed uses `.` even on
locales that parse `,`; `parseFloat` is also locale-agnostic, so today
it works — but it is fragile).

### 1.4 — Form inputs read as `.value` and coerced inline

`src/legacy/app.js:2710, 2938, 2961, 2985-2986, 3022`:

```js
const value = Number(multiplierInput.value);
quantityInput.value = Math.abs(Number(leg.quantity));
strikeInput.value   = Number.isFinite(Number(leg?.strike)) ? Number(leg.strike) : '';
underlyingInput.value = Number(leg.underlyingPrice);
```

`HTMLInputElement.value` is always a string; `Number('')` is `0`,
`Number('abc')` is `NaN`. Many call sites guard with `Number.isFinite`,
many do not (`Number(leg.underlyingPrice)` directly — if NaN, it is
written into `.value` as the string `"NaN"`).

### 1.5 — Default-fee fallback may be string or number

`src/legacy/app.js:11924-11949` reads
`localStorage.getItem(DEFAULT_FEE_STORAGE_KEY)` and runs `parseFloat`
without `Number.isFinite` guard. The result is then stored on
`this.defaultFeePerContract` and used as a multiplicand. NaN
contamination here would surface as NaN totalFees on every newly
created leg.

### 1.6 — `parseDecimal` in `src/utils/formatting.js:13-58`

Returns `defaultValue` (which is `null` by default) when input is not
finite. Callers are expected to null-check, but several sites (CSV
import in particular) feed the result directly into multiplication
without checking.

### 1.7 — `ROI` and `MaxRisk` may legitimately be `Number.POSITIVE_INFINITY`

`src/legacy/app.js:3637-3673` (`getCapitalAtRisk`),
`src/legacy/app.js:3599-3635` (`calculateMaxRisk`) — both return
`Infinity` for unlimited-risk strategies (e.g. naked call). Most
callers handle this (`Number.isFinite` checks at lines 4283, 4322), but
some are oblivious (line 3561 in `calculateROI` divides by an
unguarded `capitalAtRisk` — works because `x / Infinity === 0`, but
the type system should make this explicit).

---

## 2. Date inconsistencies

Three different representations are in active use:

1. **ISO date string** `"YYYY-MM-DD"` — the canonical persistent shape;
   what `normalizeLeg` and `enrichTradeData` write back.
2. **Full ISO timestamp** `"YYYY-MM-DDTHH:mm:ss.sssZ"` — `exportDate`
   on the storage payload (`app.js:15259`); also what `new Date(x)
   .toISOString()` returns before slicing.
3. **`Date` object** — what `summarizeLegs` accumulates internally
   (`openedDate`, `closedDate`, `earliestExpiration`,
   `latestExpiration`, `nearestShortCallExpiration`,
   `nextShortCallExpiration`).

`enrichTradeData` then converts the Date objects back to ISO strings
when assigning to the trade (`app.js:4309-4316`):

```js
enriched.pmccShortExpiration = pmccShortExpiration ? pmccShortExpiration.toISOString().slice(0, 10) : '';
enriched.openedDate = openedDate ? openedDate.toISOString().slice(0, 10) : '';
enriched.entryDate  = enriched.openedDate;
enriched.exitDate   = enriched.closedDate;
enriched.expirationDate = expirationDate ? expirationDate.toISOString().slice(0, 10) : '';
```

### 2.1 — Field-name aliasing for the same date

The trade object carries **both** `openedDate` and `entryDate`, **both**
`closedDate` and `exitDate`. They are kept in sync inside
`enrichTradeData` (`app.js:4314-4315`), but a number of sites read
`trade.entryDate || trade.openedDate` (or vice versa) defensively —
e.g. `app.js:3582, 3588, 4289, 4290, 15293-15295`.

This is a Phase-2 typing decision: keep both (mark one as optional
alias) or pick one canonical name. The TypeScript types should reflect
whichever the team chooses; the type system can enforce consistency
once decided.

### 2.2 — Implicit `new Date(x)` parsing of unknown shapes

`src/legacy/app.js:563, 568, 726, 738, 782, 792, 15295` — every site
calls `new Date(legField)` without confirming `legField` is a string.
The `Date` constructor accepts `string | number | Date`; if the field
were ever a Date already (e.g. round-tripped from `summarizeLegs`
output), `new Date(date)` is fine. If it were `undefined`, the result
is `Invalid Date` and downstream `getTime()` returns NaN.

### 2.3 — `parseDateValue` (`src/utils/dates.js:35-55`) returns `Date | null`

Used in ~12 places. Some callers null-guard (`app.js:3585, 4292-4294`),
others rely on a chained truthiness check that does not narrow well
(`app.js:3589`):

```js
const endDate = (this.isClosedStatus(trade.status) && exitCandidate) ? exitCandidate : this.currentDate;
const diffTime = endDate.getTime() - entryDate.getTime();
```

If a refactor of `isClosedStatus` ever makes `exitCandidate` null while
status is still "Closed", `endDate.getTime()` crashes. TypeScript's
strict null checks would catch this.

### 2.4 — Date arithmetic mixing UTC and local

`src/legacy/app.js:792-797` constructs `expWithMarketClose` via
`Date.UTC(year, month, day, 21, 0, 0)` to align option expiration with
4 PM ET. Reasonable, but the surrounding code is a mix of local-time
(`new Date(leg.executionDate)`) and UTC. Strict typing would not
prevent the bug class, but a `MarketDate` branded type would make
intent explicit.

### 2.5 — Sort comparisons relying on `Date` subtraction

`src/legacy/app.js:15294-15295`:
```js
.sort((a, b) =>
    new Date(b.closedDate || b.exitDate) - new Date(a.closedDate || a.exitDate)
);
```
`Date - Date` is a `number` in JavaScript runtime but TypeScript will
flag this without a cast. This is fine to leave in JS; in TS it must be
`b.getTime() - a.getTime()`.

### 2.6 — `formatDate` (`src/utils/dates.js:4-15`) accepts unknown

Returns `'—'` for invalid input, masking type errors. The signature
should be `(input: string | Date | number) => string` and the runtime
guard kept.

---

## 3. Untyped object bags

Anywhere `{}` appears as a return type or property type, the shape is
documented (if at all) only by reading the code that produces it.

### 3.1 — `summarizeLegs` return value (`app.js:625-1003`)

29 fields, mixed primitive/object/array/`Map`/null types. See
`phase2-domain-objects.md §5` for the full shape.

### 3.2 — `determineTradeLifecycleStatus` return value (`app.js:3760-...`)

Returns `{ status, exitReason, effectiveClosedDate, openContractsOverride, meta: { ... } }`.
`meta` itself has 9 boolean / numeric fields. Callers (`app.js:4329-4341`)
read `lifecycle.meta` and `lifecycle.status` directly. See
`phase2-domain-objects.md §6`.

### 3.3 — `enrichTradeData` mutates and returns the trade

`src/legacy/app.js:4180-4181`:
```js
enrichTradeData(trade) {
    const enriched = { ...trade };
    delete enriched.optionType;
    ...
    return enriched;
```

Shallow-spread; `enriched.legs` is then *replaced* with a new array
from `summarizeLegs`. The other reference fields (`primaryLeg`,
`lifecycleMeta`, etc.) are nested objects that share identity with the
summary. Phase-2 typing must distinguish *persisted* `Trade` from
*enriched* `Trade` — a single interface is wrong.

### 3.4 — `this.finnhub`, `this.gemini`, `this.shareCard` structs

Initialized in the constructor (no JSDoc):

- `this.finnhub` — `apiKey`, `encryptionKey`, `cache: Map<string,
  unknown>`, `cacheTTL`, `outstandingRequests: Map<string, Promise>`,
  `rateLimitQueue: Promise`, `maxRequestsPerMinute`, `timestamps:
  number[]`, `statusTimeoutId`, `lastStatus`, `elements: {}`. The
  `cache` Map's value shape (the Finnhub quote) is documented nowhere.
- `this.gemini` — `apiKey`, `encryptionKey`, `model`,
  `maxOutputTokens`, `statusTimeoutId`, `lastStatus`, `pendingStatus`,
  `elements: {}`. `lastStatus` and `pendingStatus` are read at e.g.
  `app.js:10050` as `{ message, variant, autoClearMs }` — not declared
  anywhere.
- `this.shareCard` — `root`, `card`, `button`, `chartCanvas`,
  `chartTitle`, `rangeLabel`, `chart`, `metrics: {}`, `timestamp`,
  `exportSize`. All DOM refs typed only as `null` initially.

### 3.5 — Filter state

`this.creditPlaybookStatus` / `Strategy` / `Horizon` / `Symbol` /
`Sort` are scattered fields, not a single `FilterState` object. The
trades-table filter uses DOM-bound multi-selects — see
`phase2-domain-objects.md §13`.

### 3.6 — Import payloads

`buildOfxImportPayload`, `buildRobinhoodImportPayload`,
`applyOfxImportResult`, `applyRobinhoodImportResult` — exchange object
shapes that include `trades`, `assignments`, `summary`, `legs`,
`reviewTrades`, `mergeable`, `errors`. None are documented; reading the
producer/consumer pair is the only way to know what's in there.

---

## 4. Functions with implicit return types

The calculation layer is where this matters most for migration safety —
a wrong inferred return type silently propagates into stats.

### 4.1 — Calculations on `GammaLedger`

| Method | Line | Returns | Notes |
|---|---|---|---|
| `calculatePL(trade)` | `app.js:3544` | `number` | May be `0` from many paths; no overflow guard. |
| `calculateROI(trade)` | `app.js:3559` | `number` | Returns `0` on missing data. |
| `calculateAnnualizedROI(trade)` | `app.js:3676` | `number` | Same. |
| `calculateWeeklyROI(trade)` | `app.js:3702` | `number` | Same. |
| `calculateMonthlyROI(trade)` | `app.js:3724` | `number` | Same. |
| `calculateMaxRisk(trade)` | `app.js:3599` | `number \| typeof Infinity` | Infinity for unlimited risk. |
| `getCapitalAtRisk(trade)` | `app.js:3637` | `number \| typeof Infinity` | Same. |
| `calculateDaysHeld(trade)` | `app.js:3581` | `number` | Returns `0` if entry date missing. |
| `calculateDTE(trade)` | (varies) | `number` | Returns negative for past expirations. |
| `calculateAdvancedStats()` | `app.js:7324`+ | `Stats` (object) | ~30 fields, see catalogue §7. |
| `calculateAssignmentStats()` | `app.js:7858` | `AssignmentStats` | See catalogue §9. |
| `calculateTickerPerformance()` | `app.js:7965` | `TickerPerformance` | See catalogue §8. |

### 4.2 — Lifecycle / leg helpers

| Method | Line | Returns | Notes |
|---|---|---|---|
| `summarizeLegs(legs)` | `app.js:625` | `LegSummary` | 29 fields. |
| `determineTradeLifecycleStatus(trade, summary)` | `app.js:3760` | `LegLifecycleResult` | 4 top + 9 in `meta`. |
| `enrichTradeData(trade)` | `app.js:4180` | `EnrichedTrade` | Adds ~35 runtime fields. |
| `normalizeLeg(leg, index)` | `app.js:558` | `NormalizedLeg` | Strict 14-field shape. |
| `getLegAction(leg)` | `app.js:~2200` | `'BUY' \| 'SELL'` | Magic-string; not a type. |
| `getLegSide(leg)` | `app.js:~2230` | `'OPEN' \| 'CLOSE' \| 'ROLL'` | Magic-string. |
| `normalizeLegOrderType(value)` | `app.js:~2160` | `'BTO' \| 'STO' \| 'BTC' \| 'STC' \| null` | Magic-string. |
| `getStrategyDisplayName(s)` | `app.js:~20730` | `string` (any of ~45 strategy names) | Magic-string set. |

### 4.3 — Payoff / Monte Carlo (still in legacy class — module placeholders)

| Method | Returns | Risk |
|---|---|---|
| `calculatePayoffSeries` | `{ prices: number[], pl: number[], maxProfit, maxLoss, breakeven }` | Shape changes per strategy variant. |
| `analyzeMultiLegStrategy` | discriminated by inferred strategy — vertical / PMCC / CC / multi-leg | Currently a switch; perfect candidate for a tagged union. |
| `generateMonteCarloProjection` | `{ paths, percentiles, statistics }` | No type today. |

---

## 5. localStorage parsing without validation

Eleven distinct keys (see `core/config.js` and the Phase-1 inventory).
`JSON.parse` sites in the live code:

| Site | Key | Validation present | Risk |
|---|---|---|---|
| `app.js:10034` | `GammaLedgerGeminiConfig` | Checks `typeof parsed === 'object'`; no field-level check | `parsed.model` may be missing/non-string; downstream `setGeminiModel(undefined)` quietly fails. |
| `app.js:10136` | `GammaLedgerGeminiConfig` | None | Reads `existing.payload` and `existing.enc` as if always strings/booleans. |
| `app.js:11648` | `GammaLedgerFinnhubConfig*` (dynamic) | None | Returns whatever was stored. |
| `app.js:11688` | `GammaLedgerFinnhubConfig*` | n/a (write site) | No schema enforcement on write either. |
| `app.js:11924` | `GammaLedgerDefaultFeePerContract` | `parseFloat` → no `Number.isFinite` guard | NaN pollution possible. |
| `app.js:11991` | `GammaLedgerGeminiMaxTokens` | `parseInt` + bounds check | OK. |
| `app.js:11957` | `GammaLedgerFinnhubRateLimit` | `parseInt` + bounds check | OK. |
| `app.js:12152` | `GammaLedgerDisclaimerAcceptedAt` | None — read as string | Low risk (used only for truthiness). |
| `app.js:12349` | `GammaLedgerAICoachConsentAt` | None | Same. |
| `app.js:12418` | `GammaLedgerSidebarCollapsed` | None | Read as `'true'`/`'false'` literal. |
| `app.js:18985-19006` | `GammaLedgerLocalDatabase` | `Array.isArray(parsed.trades)` | **Each trade enriched without per-trade shape check.** |
| `app.js:19036-19049` | Legacy keys (4) | `Array.isArray(parsedTrades)` | Same. |
| `app.js:15743, 15758` | (file import — not localStorage but JSON.parse on user file) | None | `processLoadedData(data, ...)` trusts the object. |

**Highest-risk site by far is `loadFromStorage` (the main DB load) at
`app.js:18985`+.** A user with malformed legacy data, or a corrupted
import, can pass a trade-shaped object that lacks required fields;
`enrichTradeData` will produce NaN/null cascades and silently corrupt
the persisted DB on the next save.

The Phase 2 spec mandates a `migrateSchema()` guard. Recommend it lives
in `src/core/migration.ts` and gates every `JSON.parse` of the database
key.

---

## 6. Null/undefined propagation

### 6.1 — Optional-chain hides type holes

`src/legacy/app.js` has 200+ `?.` sites. Many narrow the access but
not the broader expression. Examples:

- `app.js:984`: `Math.abs(Number(summary.primaryLeg?.quantity) || 0)`
  — works, but hides that `primaryLeg` may be null.
- `app.js:1310`: `multiplier = legWithMultiplier?.multiplier || 100;` —
  zero multiplier (legitimate?) becomes 100.
- `app.js:4240-4242`: 3 fields read off `primaryLeg?.X`, then used in
  arithmetic without re-checking.

### 6.2 — Falsy coercion `|| 0` on legitimately-zero numbers

`app.js` sites for `|| 0` on numeric fields where 0 is a valid value:
hundreds. Most are fine (premium of `0` and the fallback `0` are the
same), but `multiplier || 1` (line 691, 964, 983) and `quantity || 1`
in default-leg paths (line 972) silently change intent.

### 6.3 — `?? null` masking empty string

`app.js:596` (and 597, 598): `externalIdValue.toString().trim() ||
null` converts `''` to `null`. If callers later check `externalId !==
undefined`, they get `null` and may treat it as "set to nothing", not
"missing". Acceptable, but TS should encode the difference.

### 6.4 — `enriched.lifecycleStatus = lifecycle.status; ...
enriched.lifecycleStatus = 'awaiting_coverage'`

`app.js:4331, 4341` — `lifecycleStatus` is conditionally overwritten
after assignment. `lifecycle.status` is one of `'Open' | 'Closed' |
'Assigned' | 'Expired' | 'Rolling'`, and the override adds
`'awaiting_coverage'`. The union must include all six strings.

---

## 7. DOM element typing

`getElementById` returns `HTMLElement | null` in TS DOM lib types.
Almost no call site narrows. Sample:

- `app.js:2710` — `multiplierInput.value` (assumed input).
- `app.js:2938-2961` — quantityInput, executionInput, strikeInput,
  feesInput all assigned `.value` as if `HTMLInputElement`.
- `app.js:3022` — `underlyingInput.value`.
- `app.js:15752-15754` — `fileInput.onchange = (e) => { e.target.files[0] }`
  — `e.target` typed as `EventTarget` in TS, must cast to
  `HTMLInputElement`.

Volume: ~166 `getElementById` call sites + ~82 querySelector sites
(per Phase 1 inventory). Phase 2 should not block on full DOM typing —
narrow casts (`as HTMLInputElement`) are acceptable per CLAUDE.md.

---

## 8. Unsafe casts / dangerous coercion

### 8.1 — `JSON.parse(JSON.stringify(...))` deep clone

`src/legacy/app.js:403` clones `BUILTIN_SAMPLE_DATA`. Loses Date
objects, functions, undefined. Sample data uses ISO strings, so
currently safe — but a refactor that introduces Date objects in the
fixtures will silently break.

### 8.2 — Spread-clone leaves nested arrays shared

`app.js:4181` — `const enriched = { ...trade };`. `enriched.legs ===
trade.legs` until line 4190 reassigns `enriched.legs =
legSummary.legs`. Between those nine lines `enriched.legs` mutation
would also mutate `trade.legs`. None today, but TS types should
clearly model "this returns a new object that may share nested
references".

### 8.3 — Heterogeneous fallback chains

`app.js:574-577`:
```js
leg?.orderType || leg?.tradeType || leg?.order || this.deriveOrderTypeFromActionSide(leg?.action, leg?.side)
```
Three different field names mean the same concept. Robinhood imports
write `tradeType`, OFX writes `orderType`, hand entry writes `order`.
Phase 2 should pick one canonical name on the persisted shape and
migrate stored data.

### 8.4 — `Math.abs(Number(...) || 0)` ubiquity

Listed in §1. Aggregates to "any quantity, premium, fee, multiplier
that ever turned into NaN silently became zero". Hundreds of sites.
TS branded types (`Quantity`, `DollarAmount`) plus runtime parsers
that throw on NaN would be the long-term fix; for Phase 2, just
typing the inputs as `number` (no string union) eliminates a class.

---

## 9. External-data ingestion

Untrusted input enters the app at six points. None has schema
validation today.

| Source | Entry point | Risk |
|---|---|---|
| Finnhub HTTP API | `enqueueFinnhubRequest`, `performFinnhubFetch` (`app.js:13280-13912`) | Response shape assumed `{ c, h, l, o, pc, t }` — never checked. A breaking API change silently produces NaN quotes. |
| Gemini HTTP API | `gemini-agent.js:56-68`, `callGemini` | Response assumed `{ candidates: [{ content: { parts: [{ text }] } }] }`. No schema check. |
| OFX XML import | `parseOfx` and below (`app.js:19440-20210`) | DOMParser + ad-hoc selectors. Bad XML returns partial trades. |
| Robinhood CSV | `parseRobinhoodCsv` (`app.js:18430-19440`) | Row-by-row `parseCsvRow` (`utils/import-csv.js:4-36`); no header validation. Wrong column ordering yields wrong field assignments without error. |
| User JSON file (load DB) | `app.js:15743, 15758` → `processLoadedData` | Trusts `{ trades, version, mcpContext }`. |
| localStorage existing data | `loadFromStorage` (§5) | The most critical — runs on every app start. |

For each, a minimal Zod-style guard or hand-written `is*Schema()`
predicate would catch real bugs.

---

## 10. Magic-string enums

The codebase relies heavily on string literals for enum-like values.
None are constrained to a literal type today. Migration should turn
each into a `type X = 'a' | 'b' | ...`.

| Concept | Values | Example sites |
|---|---|---|
| Order type | `'BTO' \| 'STO' \| 'BTC' \| 'STC'` | normalizeLegOrderType, lifecycle switch (`app.js:3889-3906`) |
| Leg type | `'CALL' \| 'PUT' \| 'STOCK' \| 'CASH'` | normalizeLegType, lifecycle (`app.js:3804, 3843`) |
| Leg action | `'BUY' \| 'SELL'` | normalizeLegAction (default fallback to `'BUY'` is **silent**) |
| Leg side | `'OPEN' \| 'CLOSE' \| 'ROLL'` | normalizeLegSide |
| Underlying type | `'Stock' \| 'ETF' \| 'Index' \| 'Future'` | normalizeUnderlyingType |
| Trade direction | `'long' \| 'short' \| 'debit' \| 'credit' \| 'neutral' \| 'long_stock'` | enrichTradeData (`app.js:4216, 4235, 4259`) |
| Trade type | `'spread' \| 'single' \| 'wheel' \| 'pmcc' \| ...` | enrichTradeData (line 4215) — **values not enumerated in one place** |
| Lifecycle status | `'Open' \| 'Closed' \| 'Assigned' \| 'Expired' \| 'Rolling' \| 'awaiting_coverage'` | determineTradeLifecycleStatus + override at `app.js:4341` |
| Wheel coverage | `'covered' \| 'partial' \| 'uncovered' \| null` | getTradeWheelCoverage |
| Strategy | ~45 strings | `creditPlaybookStrategyOptions` array (`app.js:145-209`); `getStrategyDisplayName` |
| Cumulative P&L range | `'7D' \| 'MTD' \| '1M' \| '3M' \| 'YTD' \| '1Y' \| 'ALL'` | `core/config.js:32`, `app.js:15287` |
| Quote state | `'idle' \| 'loading' \| 'ready' \| 'error'` | quote rendering |
| Toast variant | `'success' \| 'error' \| 'warning' \| 'info'` | `showNotification` |

Two normalizer functions (`normalizeLegAction`, `normalizeLegSide`)
return a hardcoded default on unrecognized input
(`app.js:507-543`). After typing, this should throw or log — silent
defaulting is Phase-1 behavior preserved as-is, but **TypeScript
should make the default explicit at the type level** (return `Action |
null` rather than always `Action`).

---

## 11. Persisted shape vs. runtime shape

Critical point for the type library: **`Trade` and `Leg` each have
two shapes**, and the persisted shape is *smaller* than the runtime
shape. The differentiator is `core/config.js:59-115`:

- `RUNTIME_TRADE_FIELDS` (47 fields) — all stripped before save.
- `RUNTIME_LEG_FIELDS` (5 fields: `externalId`, `importGroupId`,
  `importSource`, `importBatchId`, `tickerSymbol`) — all stripped
  before save.

Counter-intuitively: **`externalId`, `importGroupId`, `importSource`
are NOT persisted on legs.** They are populated by import code, used
during the same session for merge/dedup logic, then dropped on save.
On reload, the import-source provenance is lost. This may be a bug;
out of scope for this report, but worth flagging — TypeScript types
will make it impossible to ignore.

**Counter-intuitively also**: `tradeReasoning`, `wheelCoverage`,
`shares`, `effectiveCostBasis`, `marketValue`, `unrealizedPL`,
`marketPriceSource` are listed in `RUNTIME_TRADE_FIELDS` and **are
not persisted**. Wheel coverage and effective cost basis are
recomputed on enrichment from the legs; user-entered
`tradeReasoning` would be lost on save unless persisted via a
different path. Flag for human review.

The catalogue (`phase2-domain-objects.md`) treats persisted vs.
enriched as two distinct interfaces.

---

## 12. Other migration-relevant observations

### 12.1 — Number serialization rounding

`enrichTradeData` rounds to 2 or 4 decimals before storing
(`app.js:4196-4203, 4271-4272, 4284`). The result is still `number`
but the precision is lossy. TypeScript can't model this; document in
a comment on the type alias.

### 12.2 — `this.currentDate` is a getter (`app.js:1531`) that always
returns `new Date()`

Used as the "now" reference throughout. Type is `Date`. Fine, but
worth knowing — a unit test that needs a frozen clock cannot
override it without re-implementing the class.

### 12.3 — `class GammaLedger` itself is the live state container

There is no separate `AppState` object. The class fields *are* the
state. Phase 2 should type the class. A separate `AppState` interface
would document the field bag for new readers but does not change
runtime.

### 12.4 — `safeLocalStorage` (`src/core/storage.js:6-39`)

Wraps three operations and returns `null` on quota / private-mode
errors. Callers test truthiness; null vs. empty-string distinction is
not enforced today. Type as `string | null`.

### 12.5 — Two `formatCurrencyValue` helpers

Phase 1 analysis flagged two same-named helpers in different scopes
(`app.js:10714` and `12890`). Phase 2 cannot dedupe them (out of scope
per CLAUDE.md), but TypeScript will surface the collision when both
end up in the same module. Resolve by giving them distinct names
during Phase 2 conversion of the file they live in.

### 12.6 — `assignmentStats` lives inside `calculateAdvancedStats`
return shape

Stats has an `assignmentStats` field. The catalogue treats it as a
distinct sub-shape but the live call hierarchy makes it a property
of `Stats`. Pick a structure (nested vs. flat) for the type.

---

## 13. Counts at a glance

| Category | Count |
|---|---|
| Distinct domain object shapes catalogued | 25 (see `phase2-domain-objects.md`) |
| Persisted localStorage keys | 11 (+ 4 legacy) |
| `JSON.parse` sites | 13 |
| Date-format conversion sites | ~40 |
| `Number(x) || 0` / `parseFloat(x) || 0` patterns | ~150 |
| Magic-string enums | 13 distinct enum-shaped concepts |
| Methods with implicit return types in calculation/lifecycle code | ~30 |
| `getElementById` sites without narrowing | 166 |
| Trade fields stripped before save (`RUNTIME_TRADE_FIELDS`) | 47 |
| Leg fields stripped before save (`RUNTIME_LEG_FIELDS`) | 5 |

---

## 14. Recommended Phase-2 type-coverage priorities

In the order CLAUDE.md anticipates:

1. **`common.ts`** — `ISODateString`, `DollarAmount`, `ContractCount`,
   `StrikePrice`, `OptionType`, `LegAction`, `LegSide`, `OrderType`,
   `LegType`, `UnderlyingType`, `LifecycleStatus`, `WheelCoverage`,
   `StrategyType`, `CumulativePLRange`, `ToastVariant`, `QuoteState`.
2. **`leg.ts`** — `Leg` (persisted) and `NormalizedLeg` (the strict
   14-field output of `normalizeLeg`).
3. **`trade.ts`** — `Trade` (persisted, post-strip) and `EnrichedTrade`
   (post-`enrichTradeData`).
4. **`leg-summary.ts`** — output of `summarizeLegs`. 29 fields with
   a mix of `Date | null`, `Leg | null`, `Map<...>` and primitives.
5. **`lifecycle.ts`** — output of `determineTradeLifecycleStatus`.
6. **`storage.ts`** — `StorageSchema { version: '2.5'; exportDate:
   ISODateString; trades: Trade[]; mcpContext: MCPContext }`.
   Discriminated by `version` once future schemas exist.
7. **`stats.ts`** — `Stats`, `TickerPerformance`,
   `AssignmentStats`. Used as the source object for the AI
   coach context, the share card, and `mcpContext`.
8. **`integrations.ts`** — `FinnhubQuote`, `GeminiResponse`. These
   are the boundary types and need runtime guards too.
9. **`imports.ts`** — `OFXImportPayload`, `RobinhoodImportPayload`,
   plus the merge / review entry shapes.
10. **`ui.ts`** — `FilterState`, `ToastOptions`,
    `PositionHighlightConfig`, `ShareCardMetrics`,
    `CreditPlaybookEntry`, `QuoteEntry`.
11. **`ai.ts`** — `AIAgentContext`, `Message`, `AIChatSession`.

---

## 15. Smoke-test implications

The Phase-2 plan adds a `tsc --noEmit` step to `npm run build`. After
type-library introduction, we expect:

- Zero changes to runtime behavior (types only).
- The first module conversions (`utils/dates.ts`, `utils/dom.ts`)
  produce no errors.
- `core/storage.ts` conversion forces the validation guard from §5.
- `trades/legs.ts` and `trades/positions.ts` will surface the
  magic-string normalization issues in §10.
- UI conversions (Phase E in CLAUDE.md) will produce the most
  cast-heavy code; expect `as HTMLInputElement` clusters in the
  add-trade form and trades-table modules.

---

## 16. Open questions for the human reviewer

1. **`tradeReasoning` is in `RUNTIME_TRADE_FIELDS`.** Is that a bug —
   should user-entered trade reasoning persist to localStorage? If
   yes, fix it before Phase 2 starts (a one-line removal from the
   set).
2. **`externalId`/`importGroupId`/`importSource` on legs are
   stripped on save.** Is that intentional? Without persisted
   provenance, re-running the same import will create duplicate legs.
3. **Field aliasing `entryDate`/`openedDate`, `exitDate`/`closedDate`.**
   Pick canonical names; type the others as deprecated aliases or
   remove.
4. **`order` / `orderType` / `tradeType` field aliases on legs.**
   Same — pick one.
5. **Strict mode rollout sequence.** CLAUDE.md proposes calculations
   first. Recommend `core/storage.ts` strict before calculations,
   because the `JSON.parse` boundary is the most leak-prone surface.
6. **Schema version field on the persisted database is the string
   `'2.5'`.** Phase 2 spec assumes `number`. Either change the
   constant to a number now and migrate stored payloads, or type as
   `string` and version-compare lexicographically. Recommend
   numeric.
7. **`Infinity` as a sentinel in P&L / risk results.** Acceptable
   today. TypeScript can model with `number` (Infinity is a finite
   `number` in TS), but the type does not signal the convention.
   Consider a branded type or a tagged union (`{ kind: 'unlimited' }
   | { kind: 'finite'; value: number }`). Out of scope for migration
   but flag for Phase 3.
