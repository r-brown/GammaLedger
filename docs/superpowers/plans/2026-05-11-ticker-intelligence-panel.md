# Ticker Intelligence Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the per-ticker expand panel with momentum/valuation/balance-sheet score pills, 52W range with current price and active strike markers, HV30, volume trend, relative-to-S&P, earnings surprise history, company profile header, and additional sparklines — all from free-tier Finnhub data.

**Architecture:** All new data except company profile and earnings surprises comes from the existing `/stock/metric` endpoint already fetched per ticker — no extra API calls. Two new lazy-fetch endpoints are added: `/company-profile2` (cached once per ticker, shown in header) and `/stock/earnings` (last 4 quarters, shown in signals column). Score computation is pure functions in `position-detail-panel.ts`. State (cache Maps, Promise Maps) follows the existing metricsCache / metricsPromiseMap pattern in `index.ts`.

**Tech Stack:** TypeScript strict, Vite, AG Grid Community, GammaLedger `.call(this, …)` delegation pattern, `src/ui/tsconfig.json` strict mode.

---

## Background: existing code you must understand

### `src/types/integrations.ts` — `StockMetrics` interface (line 110)
The fields currently in `StockMetrics` are:
```
currentPrice, beta, marketCap, vol3MonthStd, return5Day, return52Week,
week52High, week52Low, week52HighDate, week52LowDate,
peTTM, forwardPE, pfcfTTM, evFCF,
grossMarginTTM, operatingMarginTTM, netMarginTTM, fcfMarginLatest,
revenueGrowthYoY, epsGrowthYoY, currentRatio, netDebtToEquity,
epsAnnual: { period: string; v: number }[]
```

### `src/integrations/finnhub.ts` — `fetchStockMetrics` (line 1327)
Fetches `GET /stock/metric?symbol=X&metric=all`. Response shape:
```
{
  "metric": { ...flat fields... },
  "series": {
    "annual": { "eps": [...], "peTTM": [...], "grossMargin": [...], "fcfPerShareTTM": [...], ... },
    "quarterly": { ... }
  }
}
```
**Current bug**: the function reads `m.series` (where `m = data.metric`) but `series` is at `data.series`, not inside `metric`. This means `epsAnnual` is always `[]`. Task 1 fixes this.

### `src/ui/tables/position-detail-panel.ts`
- `PositionDetailPanelContext` — structural interface for what GammaLedger provides
- `buildPanelSkeleton(ticker)` — builds the 3-part DOM: header + fund-col + signals-col
- `renderFundamentalsColumn(container, metrics, livePrice)` — renders the left card
- `renderSignalsColumn(container, signals, livePrice)` — renders the right card
- `triggerDataFetch(context, ticker, panelEl)` — orchestrates lazy fetches with cache checks
- `createPositionDetailPanelRenderer(context)` — returns AG Grid full-width cell renderer class

### `src/index.ts` — declare pattern (around line 144)
New Maps follow this pattern:
```ts
declare metricsCache: Map<string, StockMetrics | 'loading' | 'error'>
declare metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
// ... constructor:
this.metricsCache = new Map();
this.metricsPromiseMap = new Map();
// ... delegator:
async fetchStockMetrics(ticker: string) { return finnhubModule.fetchStockMetrics.call(this, ticker); }
```

### Row heights
`src/ui/tables/active-positions.ts` line ~252: `return row?._isDetailRow ? 220 : 46`
`src/ui/tables/trades-table.ts` line ~547: `_isDetailRow ? 220 : 50`

---

## File Structure

| File | Change |
|---|---|
| `src/types/integrations.ts` | Extend `StockMetrics` with 13 new fields; add `CompanyProfile`, `EarningsSurprise` interfaces |
| `src/integrations/finnhub.ts` | Fix series bug in `fetchStockMetrics`; extract 13 new fields; add `fetchCompanyProfile`; add `fetchEarningsSurprise` |
| `src/types/state.ts` | Add `profileCache`, `earningsCache` to `AppState` |
| `src/index.ts` | Declare + init 4 new Maps; add 2 delegators; add `StockMetrics` to import if not present |
| `src/ui/tables/position-detail-panel.ts` | Add context fields; add pure score functions; update skeleton, fundamentals renderer, signals renderer, triggerDataFetch, renderer init |
| `src/styles/app.css` | Add CSS for score pills, 52W price label, strike marker, earnings rows, profile header, HV30/vol/SPX rows |
| `src/ui/tables/active-positions.ts` | Row height 220 → 300 |
| `src/ui/tables/trades-table.ts` | Row height 220 → 300 |

---

## Task 1: Extend StockMetrics + fix series bug in fetchStockMetrics

**Files:**
- Modify: `src/types/integrations.ts` (StockMetrics interface, line 110–161)
- Modify: `src/integrations/finnhub.ts` (fetchStockMetrics, lines 1327–1409)

- [ ] **Step 1: Add 13 new fields to StockMetrics in `src/types/integrations.ts`**

After line 161 (end of current `StockMetrics`), the interface becomes:

```ts
export interface StockMetrics {
  // ── Price context ──────────────────────────────────────────
  currentPrice: number | null
  beta: number | null
  marketCap: number | null
  vol3MonthStd: number | null
  return5Day: number | null
  /** 13-week price return, in percent. */
  return13Week: number | null
  return52Week: number | null
  week52High: number | null
  week52Low: number | null
  week52HighDate: string | null
  week52LowDate: string | null
  /** 10-day average daily trading volume (thousands of shares). */
  vol10DayAvg: number | null
  /** 3-month average daily trading volume (thousands of shares). */
  vol3MonthAvg: number | null
  /** Price return relative to S&P 500 over 13 weeks, in percent. */
  priceRelToSP500_13W: number | null

  // ── Valuation ─────────────────────────────────────────────
  peTTM: number | null
  forwardPE: number | null
  /** Forward PEG ratio (forward PE / expected EPS growth). Near 1.0 = fair value. */
  forwardPEG: number | null
  pfcfTTM: number | null
  evFCF: number | null
  /** EV / EBITDA (TTM). */
  evEbitda: number | null

  // ── Quality (margins, all in percent) ─────────────────────
  grossMarginTTM: number | null
  operatingMarginTTM: number | null
  netMarginTTM: number | null
  fcfMarginLatest: number | null
  /** Return on equity, TTM, in percent. */
  roeTTM: number | null

  // ── Growth (in percent) ───────────────────────────────────
  revenueGrowthYoY: number | null
  epsGrowthYoY: number | null

  // ── Balance sheet ─────────────────────────────────────────
  currentRatio: number | null
  netDebtToEquity: number | null
  /** Total debt / total equity (annual). */
  debtToEquity: number | null
  /** Net interest coverage ratio (annual). */
  interestCoverage: number | null

  // ── Sparkline series (sorted oldest → newest) ─────────────
  epsAnnual: { period: string; v: number }[]
  /** Annual P/E series for historical percentile computation. */
  peAnnualSeries: { period: string; v: number }[]
  /** Annual gross margin series for sparkline. */
  grossMarginSeries: { period: string; v: number }[]
  /** Annual FCF-per-share series for sparkline. */
  fcfPerShareSeries: { period: string; v: number }[]
}
```

- [ ] **Step 2: Verify typecheck fails**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: errors because `fetchStockMetrics` return object is missing the new fields.

- [ ] **Step 3: Fix the series bug and extract new fields in `fetchStockMetrics`**

Replace the entire body of `fetchStockMetrics` (lines 1339–1404) with:

```ts
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] stock/metric request failed for ${ticker}: ${response.status}`);
            return null;
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') return null;

        const raw = data as Record<string, unknown>;
        // BUG FIX: series is at data.series, NOT data.metric.series
        const m = (raw.metric ?? {}) as Record<string, unknown>;
        const seriesRoot = (raw.series ?? {}) as Record<string, unknown>;
        const annual = (seriesRoot.annual ?? {}) as Record<string, unknown>;

        function safeNum(v: unknown): number | null {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }

        function parseSeriesArray(arr: unknown): { period: string; v: number }[] {
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(item => item && typeof item === 'object')
                .map(item => {
                    const i = item as Record<string, unknown>;
                    return { period: String(i.period ?? ''), v: Number(i.v ?? 0) };
                })
                .filter(item => Number.isFinite(item.v));
        }

        const quoteCache = this.finnhub?.cache;
        const cachedQuote = (quoteCache instanceof Map ? quoteCache.get(ticker.toUpperCase()) : null) as Record<string, unknown> | null;
        const currentPrice = safeNum(cachedQuote?.c);

        return {
            currentPrice,
            beta: safeNum(m['beta']),
            marketCap: safeNum(m['marketCapitalization']),
            vol3MonthStd: safeNum(m['3MonthADReturnStd']),
            return5Day: safeNum(m['5DayPriceReturnDaily']),
            return13Week: safeNum(m['13WeekPriceReturnDaily']),
            return52Week: safeNum(m['52WeekPriceReturnDaily']),
            week52High: safeNum(m['52WeekHigh']),
            week52Low: safeNum(m['52WeekLow']),
            week52HighDate: typeof m['52WeekHighDate'] === 'string' ? m['52WeekHighDate'] : null,
            week52LowDate: typeof m['52WeekLowDate'] === 'string' ? m['52WeekLowDate'] : null,
            vol10DayAvg: safeNum(m['10DayAverageTradingVolume']),
            vol3MonthAvg: safeNum(m['3MonthAverageTradingVolume']),
            priceRelToSP500_13W: safeNum(m['priceRelativeToS&P50013WeekPriceReturn']) ?? safeNum(m['priceRelativeToS&P50013Week']),
            peTTM: safeNum(m['peBasicExclExtraTTM']) ?? safeNum(m['peNormalizedAnnual']),
            forwardPE: safeNum(m['forwardPE']),
            forwardPEG: safeNum(m['forwardPEG']),
            pfcfTTM: safeNum(m['pfcfShareTTM']),
            evFCF: safeNum(m['currentEv/freeCashFlowTTM']),
            evEbitda: safeNum(m['evEbitdaTTM']),
            grossMarginTTM: safeNum(m['grossMarginTTM']),
            operatingMarginTTM: safeNum(m['operatingMarginTTM']),
            netMarginTTM: safeNum(m['netProfitMarginTTM']),
            fcfMarginLatest: null, // no longer using annual series for this; see fcfPerShareSeries
            roeTTM: safeNum(m['roeTTM']),
            revenueGrowthYoY: safeNum(m['revenueGrowthTTMYoy']),
            epsGrowthYoY: safeNum(m['epsGrowthTTMYoy']),
            currentRatio: safeNum(m['currentRatioAnnual']),
            netDebtToEquity: safeNum(m['netDebtToTotalEquityAnnual']),
            debtToEquity: safeNum(m['totalDebt/totalEquityAnnual']),
            interestCoverage: safeNum(m['netInterestCoverageAnnual']),
            epsAnnual: parseSeriesArray(annual['eps']),
            peAnnualSeries: parseSeriesArray(annual['pe']),
            grossMarginSeries: parseSeriesArray(annual['grossMargin']),
            fcfPerShareSeries: parseSeriesArray(annual['fcfPerShareTTM']),
        };
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch stock metrics for ${ticker}:`, error);
        return null;
    }
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: exits 0. Fix any remaining type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/types/integrations.ts src/integrations/finnhub.ts
git commit -m "feat(metrics): extend StockMetrics with 13 new fields; fix series extraction bug"
```

---

## Task 2: Add CompanyProfile type + fetchCompanyProfile + wire state

**Files:**
- Modify: `src/types/integrations.ts` (add after SignalsData)
- Modify: `src/types/state.ts` (add profileCache to AppState)
- Modify: `src/integrations/finnhub.ts` (add fetchCompanyProfile before fetchSignalsData)
- Modify: `src/index.ts` (declare + init + delegator)

- [ ] **Step 1: Add CompanyProfile interface to `src/types/integrations.ts`**

Add after the `SignalsData` interface:

```ts
export interface CompanyProfile {
  /** Full company name, e.g. "Apple Inc". */
  name: string
  /** Finnhub industry category, e.g. "Technology". */
  industry: string
  /** URL to company logo PNG (from Finnhub CDN). May be empty string. */
  logo: string
  /** Exchange name, e.g. "NASDAQ/NMS (GLOBAL MARKET)". */
  exchange: string
}
```

- [ ] **Step 2: Add profileCache to AppState in `src/types/state.ts`**

Find the `signalsCache` line (around line 126) and add after it:

```ts
  /** ticker → CompanyProfile | 'loading' | 'error'. Fetched lazily on first expand. */
  profileCache: Map<string, import('./integrations').CompanyProfile | 'loading' | 'error'>
```

- [ ] **Step 3: Add fetchCompanyProfile to `src/integrations/finnhub.ts`**

Add before the `fetchSignalsData` export function:

```ts
// ---------------------------------------------------------------------------
// Company profile — fetched lazily on first row expand, cached permanently
// ---------------------------------------------------------------------------

export async function fetchCompanyProfile(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').CompanyProfile | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const url = new URL('https://finnhub.io/api/v1/stock/profile2');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('token', String(apiKey));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] company-profile2 failed for ${ticker}: ${response.status}`);
            return null;
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') return null;
        const d = data as Record<string, unknown>;
        const name = typeof d.name === 'string' ? d.name : '';
        if (!name) return null; // empty response = unknown ticker
        return {
            name,
            industry: typeof d.finnhubIndustry === 'string' ? d.finnhubIndustry : '',
            logo: typeof d.logo === 'string' ? d.logo : '',
            exchange: typeof d.exchange === 'string' ? d.exchange : '',
        };
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch company profile for ${ticker}:`, error);
        return null;
    }
}
```

- [ ] **Step 4: Wire declares, init, and delegator in `src/index.ts`**

After `declare signalsPromiseMap` (around line 149), add:
```ts
    declare profileCache: Map<string, import('./types/integrations.js').CompanyProfile | 'loading' | 'error'>
    declare profilePromiseMap: Map<string, Promise<import('./types/integrations.js').CompanyProfile | null>>
```

After `this.signalsPromiseMap = new Map();` in the constructor, add:
```ts
        this.profileCache = new Map();
        this.profilePromiseMap = new Map();
```

After the `fetchSignalsData` delegator (around line 1411), add:
```ts
    async fetchCompanyProfile(ticker: string) { return finnhubModule.fetchCompanyProfile.call(this, ticker); }
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/types/integrations.ts src/types/state.ts src/integrations/finnhub.ts src/index.ts
git commit -m "feat(profile): add CompanyProfile type + fetchCompanyProfile endpoint"
```

---

## Task 3: Add EarningsSurprise type + fetchEarningsSurprise + wire state

**Files:**
- Modify: `src/types/integrations.ts` (add after CompanyProfile)
- Modify: `src/types/state.ts` (add earningsCache to AppState)
- Modify: `src/integrations/finnhub.ts` (add fetchEarningsSurprise)
- Modify: `src/index.ts` (declare + init + delegator)

The `/stock/earnings` endpoint returns an array of quarterly results sorted newest→oldest. We keep the 4 most recent.

- [ ] **Step 1: Add EarningsSurprise interface to `src/types/integrations.ts`**

Add after `CompanyProfile`:

```ts
export interface EarningsSurprise {
  /** ISO date of earnings period end, e.g. "2023-03-31". */
  period: string
  quarter: number
  year: number
  actual: number | null
  estimate: number | null
  /** Surprise as a percentage of estimate. Positive = beat. */
  surprisePercent: number | null
}
```

- [ ] **Step 2: Add earningsCache to AppState in `src/types/state.ts`**

After the `profileCache` line, add:

```ts
  /** ticker → EarningsSurprise[] | 'loading' | 'error'. Last 4 quarters, newest first. */
  earningsCache: Map<string, import('./integrations').EarningsSurprise[] | 'loading' | 'error'>
```

- [ ] **Step 3: Add fetchEarningsSurprise to `src/integrations/finnhub.ts`**

Add after `fetchCompanyProfile`:

```ts
// ---------------------------------------------------------------------------
// Earnings surprise history — last 4 quarters
// ---------------------------------------------------------------------------

export async function fetchEarningsSurprise(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').EarningsSurprise[] | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const url = new URL('https://finnhub.io/api/v1/stock/earnings');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('token', String(apiKey));

    function safeNum(v: unknown): number | null {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] stock/earnings failed for ${ticker}: ${response.status}`);
            return null;
        }
        const data: unknown = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        return (data as Record<string, unknown>[])
            .filter(item => item && typeof item === 'object')
            .slice(0, 4)  // already sorted newest-first by Finnhub
            .map(item => ({
                period: typeof item.period === 'string' ? item.period : '',
                quarter: Number(item.quarter) || 0,
                year: Number(item.year) || 0,
                actual: safeNum(item.actual),
                estimate: safeNum(item.estimate),
                surprisePercent: safeNum(item.surprisePercent),
            }));
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch earnings for ${ticker}:`, error);
        return null;
    }
}
```

- [ ] **Step 4: Wire declares, init, and delegator in `src/index.ts`**

After `declare profilePromiseMap`, add:
```ts
    declare earningsCache: Map<string, import('./types/integrations.js').EarningsSurprise[] | 'loading' | 'error'>
    declare earningsPromiseMap: Map<string, Promise<import('./types/integrations.js').EarningsSurprise[] | null>>
```

After `this.profilePromiseMap = new Map();`, add:
```ts
        this.earningsCache = new Map();
        this.earningsPromiseMap = new Map();
```

After the `fetchCompanyProfile` delegator, add:
```ts
    async fetchEarningsSurprise(ticker: string) { return finnhubModule.fetchEarningsSurprise.call(this, ticker); }
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/types/integrations.ts src/types/state.ts src/integrations/finnhub.ts src/index.ts
git commit -m "feat(earnings): add EarningsSurprise type + fetchEarningsSurprise endpoint"
```

---

## Task 4: Add pure score computation functions

**Files:**
- Modify: `src/ui/tables/position-detail-panel.ts` (add after the `buildSparklineSVG` function, before `buildPanelSkeleton`)

These are **pure functions** — no DOM access, no side effects. They take `StockMetrics` and return a grade + a short detail string for the tooltip.

- [ ] **Step 1: Add the score type and three compute functions to `position-detail-panel.ts`**

Add this block after `buildSparklineSVG` (around line 114, before `buildPanelSkeleton`):

```ts
// ---------------------------------------------------------------------------
// Score computation — pure functions, no DOM access
// ---------------------------------------------------------------------------

type MomentumGrade = 'bullish' | 'neutral' | 'bearish'
type HealthGrade = 'healthy' | 'ok' | 'weak'
type ValuationGrade = 'cheap' | 'fair' | 'expensive'

function computeMomentumScore(m: StockMetrics): { grade: MomentumGrade; detail: string } {
  // Weighted average of 5D (20%), 13W (40%), 52W (40%)
  const fields: (number | null)[] = [m.return5Day, m.return13Week, m.return52Week]
  const weights = [0.2, 0.4, 0.4]
  let sum = 0, wSum = 0
  for (let i = 0; i < 3; i++) {
    const v = fields[i]
    if (v !== null) { sum += v * weights[i]; wSum += weights[i] }
  }
  if (wSum === 0) return { grade: 'neutral', detail: '—' }
  const score = sum / wSum
  const detail = [
    m.return5Day !== null ? `5D ${fmtPct(m.return5Day, true)}` : null,
    m.return13Week !== null ? `13W ${fmtPct(m.return13Week, true)}` : null,
    m.return52Week !== null ? `52W ${fmtPct(m.return52Week, true)}` : null,
  ].filter(Boolean).join(' · ')
  if (score > 5) return { grade: 'bullish', detail }
  if (score < -5) return { grade: 'bearish', detail }
  return { grade: 'neutral', detail }
}

function computeBalanceSheetScore(m: StockMetrics): { grade: HealthGrade; detail: string } {
  const cr = m.currentRatio
  const de = m.debtToEquity
  const ic = m.interestCoverage
  if (cr === null && de === null) return { grade: 'ok', detail: '—' }
  const weak = (cr !== null && cr < 1.0) || (de !== null && de > 2.0)
  const healthy = (cr === null || cr >= 1.5) && (de === null || de < 0.5) && (ic === null || ic > 5)
  const detail = [
    cr !== null ? `CR ${cr.toFixed(1)}` : null,
    de !== null ? `D/E ${de.toFixed(1)}` : null,
    ic !== null ? `IC ${ic.toFixed(0)}×` : null,
  ].filter(Boolean).join(' · ')
  if (weak) return { grade: 'weak', detail }
  if (healthy) return { grade: 'healthy', detail }
  return { grade: 'ok', detail }
}

function computeValuationScore(m: StockMetrics): { grade: ValuationGrade; detail: string } {
  // PE percentile within own annual history (if ≥4 points)
  const series = m.peAnnualSeries
  const currentPE = m.peTTM
  if (series.length >= 4 && currentPE !== null && currentPE > 0) {
    const vals = series.map(s => s.v).filter(v => v > 0).sort((a, b) => a - b)
    if (vals.length >= 4) {
      const rank = vals.filter(v => v <= currentPE).length
      const pct = rank / vals.length
      const pctLabel = `${Math.round(pct * 100)}th %ile`
      const detail = `PE ${currentPE.toFixed(0)}× · ${pctLabel}`
      if (pct <= 0.25) return { grade: 'cheap', detail }
      if (pct >= 0.75) return { grade: 'expensive', detail }
      return { grade: 'fair', detail }
    }
  }
  // Fallback: absolute forward PE thresholds
  const fpe = m.forwardPE
  if (fpe === null || fpe <= 0) return { grade: 'fair', detail: '—' }
  const detail = `Fwd P/E ${fpe.toFixed(0)}×`
  if (fpe < 13) return { grade: 'cheap', detail }
  if (fpe > 25) return { grade: 'expensive', detail }
  return { grade: 'fair', detail }
}
```

Note: `StockMetrics` must be imported at the top of the file. The current import is:
```ts
import type { StockMetrics, SignalsData } from '../../types/integrations.js'
```
Add `CompanyProfile`, `EarningsSurprise` to this import in the same step:
```ts
import type { StockMetrics, SignalsData, CompanyProfile, EarningsSurprise } from '../../types/integrations.js'
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:strict 2>&1 | grep "position-detail"
```

Expected: no errors for `position-detail-panel.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/tables/position-detail-panel.ts
git commit -m "feat(panel): add momentum, balance-sheet, valuation score computation functions"
```

---

## Task 5: Update PositionDetailPanelContext + pass activeStrike through init

**Files:**
- Modify: `src/ui/tables/position-detail-panel.ts`

The panel renderer's `init()` receives `_parentTrade` (the enriched trade). We need to pass the active strike price down to the fundamentals renderer so it can draw a second marker on the 52W range bar. We also need to add profile/earnings cache fields to the context.

- [ ] **Step 1: Update `PositionDetailPanelContext` interface**

Replace the existing interface (lines 7–18):

```ts
export interface PositionDetailPanelContext {
  metricsCache: Map<string, StockMetrics | 'loading' | 'error'>
  signalsCache: Map<string, SignalsData | 'loading' | 'error'>
  profileCache: Map<string, CompanyProfile | 'loading' | 'error'>
  earningsCache: Map<string, EarningsSurprise[] | 'loading' | 'error'>
  metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
  signalsPromiseMap: Map<string, Promise<SignalsData | null>>
  profilePromiseMap: Map<string, Promise<CompanyProfile | null>>
  earningsPromiseMap: Map<string, Promise<EarningsSurprise[] | null>>
  fetchSignalsData(ticker: string): Promise<SignalsData | null>
  fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
  fetchCompanyProfile(ticker: string): Promise<CompanyProfile | null>
  fetchEarningsSurprise(ticker: string): Promise<EarningsSurprise[] | null>
  finnhub: { apiKey: string | null; cache: Map<string, { c?: number }> }
  formatCurrency(v: unknown): string
  formatDate(v: unknown): string
  formatNumber(v: unknown, opts?: { decimals?: number }): string | null
}
```

- [ ] **Step 2: Update `triggerDataFetch` signature to accept `activeStrike`**

Change its signature from:
```ts
function triggerDataFetch(
  context: PositionDetailPanelContext,
  ticker: string,
  panelEl: HTMLElement
): void {
```
to:
```ts
function triggerDataFetch(
  context: PositionDetailPanelContext,
  ticker: string,
  panelEl: HTMLElement,
  activeStrike: number | null
): void {
```

And update the call to `renderFundamentalsColumn` inside the function to pass `activeStrike`:
```ts
// Change: renderFundamentalsColumn(fundCard, cachedMetrics, livePrice)
// To:
renderFundamentalsColumn(fundCard, cachedMetrics, livePrice, activeStrike)
// (3 places: cache-hit, promise-attach, and fetch-resolve branches)
```

- [ ] **Step 3: Update `createPositionDetailPanelRenderer` init to extract and pass activeStrike**

Replace the `init` method:
```ts
    init(params: { node: { data: Record<string, unknown> } }) {
      const trade = params.node.data._parentTrade as Record<string, unknown>
      const ticker = String(trade.ticker ?? '').toUpperCase()
      this.container = buildPanelSkeleton(ticker)
      const activeStrike = typeof trade.activeStrikePrice === 'number'
        ? trade.activeStrikePrice
        : (typeof trade.strikePrice === 'number' ? trade.strikePrice : null)
      triggerDataFetch(context, ticker, this.container, activeStrike)
    }
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. There will be an error on `renderFundamentalsColumn` because its signature doesn't yet accept `activeStrike` — leave that for Task 6.

Actually `renderFundamentalsColumn` will cause a compile error now. Temporarily add the parameter as an optional `activeStrike?: number | null` in its signature to unblock typecheck. Task 6 will use it properly.

```ts
function renderFundamentalsColumn(
  container: HTMLElement,
  metrics: StockMetrics,
  livePrice: number | null,
  activeStrike?: number | null
): void {
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/tables/position-detail-panel.ts
git commit -m "feat(panel): extend context with profile/earnings caches; pass activeStrike to renderer"
```

---

## Task 6: Update renderFundamentalsColumn

**Files:**
- Modify: `src/ui/tables/position-detail-panel.ts` (`renderFundamentalsColumn`)

Add: current price label on 52W range bar, active strike marker, HV30, volume trend, vs S&P, gross margin sparkline, FCF sparkline.

- [ ] **Step 1: Replace `renderFundamentalsColumn` entirely**

Replace the whole function with:

```ts
function renderFundamentalsColumn(
  container: HTMLElement,
  metrics: StockMetrics,
  livePrice: number | null,
  activeStrike: number | null = null
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Fundamentals'))
  container.appendChild(header)

  // ── 52W Range bar ──────────────────────────────────────────
  const price = livePrice ?? metrics.currentPrice
  if (metrics.week52High !== null && metrics.week52Low !== null) {
    const rng = metrics.week52High - metrics.week52Low

    // Price label row above the bar
    if (price !== null) {
      const priceLabel = el('div', 'pdp-range-price-label')
      priceLabel.appendChild(txt(`$${price.toFixed(2)}`))
      container.appendChild(priceLabel)
    }

    const rangeRow = el('div', 'pdp-range-row')
    const lowLabel = el('span', 'pdp-range-label')
    lowLabel.appendChild(txt(`$${metrics.week52Low.toFixed(0)}`))

    const track = el('div', 'pdp-range-track')

    // Current price dot (primary, blue)
    if (price !== null && rng > 0) {
      const pct = Math.min(100, Math.max(0, ((price - metrics.week52Low) / rng) * 100))
      const dot = el('div', 'pdp-range-dot')
      dot.style.left = `${pct}%`
      track.appendChild(dot)
    }

    // Active strike marker (secondary, orange) — only if within range ±20%
    if (activeStrike !== null && rng > 0) {
      const strikePct = ((activeStrike - metrics.week52Low) / rng) * 100
      if (strikePct >= -5 && strikePct <= 105) {
        const clampedPct = Math.min(100, Math.max(0, strikePct))
        const strikeMarker = el('div', 'pdp-range-strike')
        strikeMarker.style.left = `${clampedPct}%`
        strikeMarker.title = `Strike: $${activeStrike.toFixed(2)}`
        track.appendChild(strikeMarker)
      }
    }

    const highLabel = el('span', 'pdp-range-label')
    highLabel.appendChild(txt(`$${metrics.week52High.toFixed(0)}`))
    rangeRow.appendChild(lowLabel)
    rangeRow.appendChild(track)
    rangeRow.appendChild(highLabel)
    container.appendChild(rangeRow)
  }

  // ── KV Grid ────────────────────────────────────────────────
  const grid = el('div', 'pdp-kv-grid')

  // Row 1: Beta · HV30 (realized vol)
  grid.appendChild(makeKV('Beta', metrics.beta !== null ? metrics.beta.toFixed(2) : '—'))
  const hv30 = metrics.vol3MonthStd
  grid.appendChild(makeKV('HV30', hv30 !== null ? `${hv30.toFixed(0)}%` : '—'))

  // Row 2: Mkt Cap · ROE
  grid.appendChild(makeKV('Mkt Cap', fmtCap(metrics.marketCap)))
  grid.appendChild(makeKV('ROE', fmtPct(metrics.roeTTM), (metrics.roeTTM ?? 0) > 0, false))

  // Row 3: P/E TTM · Fwd P/E
  grid.appendChild(makeKV('P/E TTM', metrics.peTTM !== null ? `${metrics.peTTM.toFixed(0)}×` : '—'))
  grid.appendChild(makeKV('Fwd P/E', metrics.forwardPE !== null ? `${metrics.forwardPE.toFixed(0)}×` : '—'))

  // Row 4: Net Margin · Op Margin
  grid.appendChild(makeKV('Net Margin', fmtPct(metrics.netMarginTTM), (metrics.netMarginTTM ?? 0) > 0, (metrics.netMarginTTM ?? 0) < 0))
  grid.appendChild(makeKV('Op Margin', fmtPct(metrics.operatingMarginTTM), (metrics.operatingMarginTTM ?? 0) > 0, (metrics.operatingMarginTTM ?? 0) < 0))

  // Row 5: Rev Growth · EPS Growth
  grid.appendChild(makeKV('Rev Growth', fmtPct(metrics.revenueGrowthYoY, true), (metrics.revenueGrowthYoY ?? 0) > 0, (metrics.revenueGrowthYoY ?? 0) < 0))
  grid.appendChild(makeKV('EPS Growth', fmtPct(metrics.epsGrowthYoY, true), (metrics.epsGrowthYoY ?? 0) > 0, (metrics.epsGrowthYoY ?? 0) < 0))

  container.appendChild(grid)

  // ── Volume trend ───────────────────────────────────────────
  if (metrics.vol10DayAvg !== null && metrics.vol3MonthAvg !== null && metrics.vol3MonthAvg > 0) {
    const ratio = metrics.vol10DayAvg / metrics.vol3MonthAvg
    const volRow = el('div', 'pdp-meta-row')
    const volLabel = el('span', 'pdp-meta-label')
    volLabel.appendChild(txt('Vol 10D'))
    const volVal = el('span', `pdp-meta-value${ratio > 1.3 ? ' pdp-meta-value--warn' : ratio < 0.7 ? ' pdp-meta-value--muted' : ''}`)
    volVal.appendChild(txt(`${ratio.toFixed(2)}× avg`))
    volRow.appendChild(volLabel)
    volRow.appendChild(volVal)
    container.appendChild(volRow)
  }

  // ── vs S&P 500 (13W) ──────────────────────────────────────
  if (metrics.priceRelToSP500_13W !== null) {
    const spRow = el('div', 'pdp-meta-row')
    const spLabel = el('span', 'pdp-meta-label')
    spLabel.appendChild(txt('vs SPX 13W'))
    const v = metrics.priceRelToSP500_13W
    const spVal = el('span', `pdp-meta-value${v > 0 ? ' pdp-meta-value--pos' : ' pdp-meta-value--neg'}`)
    spVal.appendChild(txt(fmtPct(v, true)))
    spRow.appendChild(spLabel)
    spRow.appendChild(spVal)
    container.appendChild(spRow)
  }

  // ── Sparklines ─────────────────────────────────────────────
  // EPS annual
  if (metrics.epsAnnual.length >= 2) {
    const spRow = el('div', 'pdp-sparkline-row')
    const spLabel = el('div', 'pdp-sparkline-label')
    spLabel.appendChild(txt('EPS (annual)'))
    spRow.appendChild(spLabel)
    spRow.appendChild(buildSparklineSVG(metrics.epsAnnual.map(p => p.v)))
    container.appendChild(spRow)
  }

  // Gross margin annual
  if (metrics.grossMarginSeries.length >= 2) {
    const spRow = el('div', 'pdp-sparkline-row')
    const spLabel = el('div', 'pdp-sparkline-label')
    spLabel.appendChild(txt('Gross Margin (annual)'))
    spRow.appendChild(spLabel)
    spRow.appendChild(buildSparklineSVG(metrics.grossMarginSeries.map(p => p.v)))
    container.appendChild(spRow)
  }

  // FCF per share annual
  if (metrics.fcfPerShareSeries.length >= 2) {
    const spRow = el('div', 'pdp-sparkline-row')
    const spLabel = el('div', 'pdp-sparkline-label')
    spLabel.appendChild(txt('FCF/Share (annual)'))
    spRow.appendChild(spLabel)
    spRow.appendChild(buildSparklineSVG(metrics.fcfPerShareSeries.map(p => p.v)))
    container.appendChild(spRow)
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/tables/position-detail-panel.ts
git commit -m "feat(panel): update fundamentals column — 52W range with price/strike, HV30, vol trend, vs SPX, FCF+margin sparklines"
```

---

## Task 7: Update renderSignalsColumn with earnings history

**Files:**
- Modify: `src/ui/tables/position-detail-panel.ts` (`renderSignalsColumn`)

Add an earnings surprise section showing the last 4 quarters. This function now takes an optional `earnings` parameter.

- [ ] **Step 1: Update `renderSignalsColumn` signature and add earnings section**

Replace the entire `renderSignalsColumn` function:

```ts
function renderSignalsColumn(
  container: HTMLElement,
  signals: SignalsData,
  livePrice: number | null,
  earnings: EarningsSurprise[] | null = null
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Signals'))
  container.appendChild(header)

  function addSignalRow(icon: string, label: string, detail: string): void {
    const row = el('div', 'pdp-signal-row')
    const iconEl = el('span', 'pdp-signal-icon')
    iconEl.appendChild(txt(icon))
    const body = el('span')
    const labelEl = el('span', 'pdp-signal-label')
    labelEl.appendChild(txt(label))
    const detailEl = el('span', 'pdp-signal-detail')
    detailEl.appendChild(txt(detail))
    body.appendChild(labelEl)
    body.appendChild(detailEl)
    row.appendChild(iconEl)
    row.appendChild(body)
    container.appendChild(row)
  }

  // ── Earnings surprise history (last 4Q) ───────────────────
  if (earnings && earnings.length > 0) {
    const earnHeader = el('div', 'pdp-earnings-header')
    earnHeader.appendChild(txt('Earnings surprises'))
    container.appendChild(earnHeader)
    const earnGrid = el('div', 'pdp-earnings-grid')
    for (const q of earnings) {
      const cell = el('div', 'pdp-earnings-cell')
      const periodEl = el('div', 'pdp-earnings-period')
      periodEl.appendChild(txt(`Q${q.quarter}'${String(q.year).slice(-2)}`))
      const surpriseEl = el('div', q.surprisePercent === null ? 'pdp-earnings-neutral'
        : q.surprisePercent >= 0 ? 'pdp-earnings-beat' : 'pdp-earnings-miss')
      const sign = q.surprisePercent !== null && q.surprisePercent > 0 ? '+' : ''
      surpriseEl.appendChild(txt(
        q.surprisePercent !== null ? `${sign}${q.surprisePercent.toFixed(1)}%` : '—'
      ))
      cell.appendChild(periodEl)
      cell.appendChild(surpriseEl)
      earnGrid.appendChild(cell)
    }
    container.appendChild(earnGrid)
  }

  // ── Analyst consensus ─────────────────────────────────────
  if (signals.recommendation) {
    const r = signals.recommendation
    const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell || 1
    const label = r.strongBuy + r.buy > r.sell + r.strongSell + r.hold ? 'Buy consensus' :
                  r.sell + r.strongSell > r.strongBuy + r.buy + r.hold ? 'Sell consensus' : 'Hold consensus'
    const detail = `${r.strongBuy + r.buy} buy · ${r.hold} hold · ${r.sell + r.strongSell} sell`
    const row = el('div', 'pdp-signal-row')
    const iconEl = el('span', 'pdp-signal-icon')
    iconEl.appendChild(txt('📊'))
    const body = el('span')
    const labelEl = el('span', 'pdp-signal-label')
    labelEl.appendChild(txt(label))
    const detailEl = el('span', 'pdp-signal-detail')
    detailEl.appendChild(txt(detail))
    const bar = el('div', 'pdp-analyst-bar')
    const segments: [string, number][] = [
      ['pdp-analyst-bar__sb', r.strongBuy],
      ['pdp-analyst-bar__b', r.buy],
      ['pdp-analyst-bar__h', r.hold],
      ['pdp-analyst-bar__s', r.sell],
      ['pdp-analyst-bar__ss', r.strongSell],
    ]
    for (const [cls, count] of segments) {
      if (count > 0) {
        const seg = el('div', cls)
        seg.style.flex = String(count / total)
        bar.appendChild(seg)
      }
    }
    body.appendChild(labelEl)
    body.appendChild(detailEl)
    body.appendChild(bar)
    row.appendChild(iconEl)
    row.appendChild(body)
    container.appendChild(row)
  } else {
    addSignalRow('📊', 'Analyst consensus', '—')
  }

  // ── News (most recent item) ───────────────────────────────
  const newsToShow = signals.news.slice(0, 2)
  if (newsToShow.length > 0) {
    const first = newsToShow[0]
    const truncated = first.headline.length > 55
      ? first.headline.slice(0, 52) + '…'
      : first.headline
    addSignalRow('📰', truncated, `${first.source} · ${fmtRelTime(first.datetime)}`)
  } else {
    addSignalRow('📰', 'Recent news', '—')
  }

  // ── Insider activity ──────────────────────────────────────
  if (signals.insiderTransactions.length > 0) {
    const ins = signals.insiderTransactions[0]
    const valueStr = ins.value !== null ? ` · $${(ins.value / 1_000_000).toFixed(1)}M` : ''
    addSignalRow(
      ins.transactionType === 'Buy' ? '🟢' : '🔴',
      `Insider ${ins.transactionType.toLowerCase()} · ${ins.name.split(' ').slice(-1)[0]}`,
      `${ins.filingDate}${valueStr}`
    )
  } else {
    addSignalRow('👤', 'Insider activity', '—')
  }
}
```

- [ ] **Step 2: Update all 3 call sites of `renderSignalsColumn` in `triggerDataFetch`**

Inside `triggerDataFetch`, find all calls to `renderSignalsColumn(sigCard, ..., livePrice)` and add the earnings argument. At this stage, the earnings data isn't plumbed yet, so pass `null`:

```ts
// Change all 3 call sites from:
renderSignalsColumn(sigCard, cachedSignals, livePrice)
// To:
renderSignalsColumn(sigCard, cachedSignals, livePrice, null)
```

Task 8 will wire the real earnings data.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/tables/position-detail-panel.ts
git commit -m "feat(panel): add earnings surprise history to signals column"
```

---

## Task 8: Update skeleton + triggerDataFetch — profile header, score pills, wire new caches

**Files:**
- Modify: `src/ui/tables/position-detail-panel.ts`

This task wires the three new caches (profile, earnings) and renders score pills in the header once metrics are available. The header also shows company name + industry once the profile loads.

- [ ] **Step 1: Update `buildPanelSkeleton` to add identity slot and scores slot**

Replace `buildPanelSkeleton`:

```ts
function buildPanelSkeleton(ticker: string): HTMLElement {
  const panel = el('div', 'position-detail-panel')

  // Header: identity (ticker → company name) + score pills
  const header = el('div', 'pdp-header')
  const identity = el('div', 'pdp-header-identity')
  identity.dataset.role = 'identity'
  const tickerSpan = el('span', 'pdp-header-ticker')
  tickerSpan.appendChild(txt(ticker))
  identity.appendChild(tickerSpan)
  const scores = el('div', 'pdp-header-scores')
  scores.dataset.role = 'scores'
  header.appendChild(identity)
  header.appendChild(scores)

  // Fundamentals column
  const fundCol = el('div', 'pdp-fund-col')
  const fundCard = el('div', 'pdp-card')
  fundCard.dataset.role = 'fundamentals'
  const fundLoading = el('div', 'pdp-loading')
  fundLoading.appendChild(txt('Loading…'))
  fundCard.appendChild(fundLoading)
  fundCol.appendChild(fundCard)

  // Signals column
  const sigCol = el('div', 'pdp-signals-col')
  const sigCard = el('div', 'pdp-card')
  sigCard.dataset.role = 'signals'
  const sigLoading = el('div', 'pdp-loading')
  sigLoading.appendChild(txt('Loading…'))
  sigCard.appendChild(sigLoading)
  sigCol.appendChild(sigCard)

  panel.appendChild(header)
  panel.appendChild(fundCol)
  panel.appendChild(sigCol)
  return panel
}
```

- [ ] **Step 2: Add helper functions `renderProfileHeader` and `renderScorePills`**

Add these two helpers just before `triggerDataFetch`:

```ts
function renderProfileHeader(identityEl: HTMLElement, ticker: string, profile: CompanyProfile): void {
  identityEl.textContent = ''
  if (profile.logo) {
    const img = document.createElement('img')
    img.src = profile.logo
    img.className = 'pdp-company-logo'
    img.alt = ''
    img.width = 20
    img.height = 20
    identityEl.appendChild(img)
  }
  const nameSpan = el('span', 'pdp-company-name')
  nameSpan.appendChild(txt(profile.name || ticker))
  identityEl.appendChild(nameSpan)
  if (profile.industry) {
    const badge = el('span', 'pdp-industry-badge')
    badge.appendChild(txt(profile.industry))
    identityEl.appendChild(badge)
  }
}

function renderScorePills(scoresEl: HTMLElement, metrics: StockMetrics): void {
  scoresEl.textContent = ''

  const momentum = computeMomentumScore(metrics)
  const health = computeBalanceSheetScore(metrics)
  const valuation = computeValuationScore(metrics)

  const momentumConfig: Record<MomentumGrade, { label: string; cls: string }> = {
    bullish: { label: '🟢 Bullish', cls: 'pdp-score-pill pdp-score-pill--bull' },
    neutral: { label: '🟡 Neutral', cls: 'pdp-score-pill pdp-score-pill--neut' },
    bearish: { label: '🔴 Bearish', cls: 'pdp-score-pill pdp-score-pill--bear' },
  }
  const healthConfig: Record<HealthGrade, { label: string; cls: string }> = {
    healthy: { label: '✅ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--bull' },
    ok: { label: '⚠️ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--neut' },
    weak: { label: '❌ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--bear' },
  }
  const valConfig: Record<ValuationGrade, { label: string; cls: string }> = {
    cheap: { label: '💚 Cheap', cls: 'pdp-score-pill pdp-score-pill--bull' },
    fair: { label: '🟡 Fair Value', cls: 'pdp-score-pill pdp-score-pill--neut' },
    expensive: { label: '🔴 Expensive', cls: 'pdp-score-pill pdp-score-pill--bear' },
  }

  for (const [cfg, detail] of [
    [momentumConfig[momentum.grade], momentum.detail] as const,
    [healthConfig[health.grade], health.detail] as const,
    [valConfig[valuation.grade], valuation.detail] as const,
  ]) {
    const pill = el('span', cfg.cls)
    pill.appendChild(txt(cfg.label))
    pill.title = detail
    scoresEl.appendChild(pill)
  }
}
```

- [ ] **Step 3: Rewrite `triggerDataFetch` to wire all 4 caches**

Replace the entire `triggerDataFetch` function:

```ts
function triggerDataFetch(
  context: PositionDetailPanelContext,
  ticker: string,
  panelEl: HTMLElement,
  activeStrike: number | null
): void {
  const fundCard = panelEl.querySelector('[data-role="fundamentals"]') as HTMLElement | null
  const sigCard = panelEl.querySelector('[data-role="signals"]') as HTMLElement | null
  const identityEl = panelEl.querySelector('[data-role="identity"]') as HTMLElement | null
  const scoresEl = panelEl.querySelector('[data-role="scores"]') as HTMLElement | null

  const livePrice = context.finnhub.cache.get(ticker)?.c ?? null

  // Helper to re-render signals with both signals + earnings data
  function reRenderSignals(signals: SignalsData): void {
    if (!sigCard?.isConnected) return
    const earned = context.earningsCache.get(ticker)
    const earnings = (earned && earned !== 'loading' && earned !== 'error') ? earned : null
    renderSignalsColumn(sigCard, signals, livePrice, earnings)
  }

  // ── Fundamentals (metrics) ────────────────────────────────
  const cachedMetrics = context.metricsCache.get(ticker)
  if (cachedMetrics && cachedMetrics !== 'loading' && cachedMetrics !== 'error') {
    if (fundCard) renderFundamentalsColumn(fundCard, cachedMetrics, livePrice, activeStrike)
    if (scoresEl) renderScorePills(scoresEl, cachedMetrics)
  } else if (cachedMetrics === 'loading') {
    context.metricsPromiseMap.get(ticker)?.then(data => {
      if (fundCard?.isConnected && data) renderFundamentalsColumn(fundCard, data, livePrice, activeStrike)
      if (scoresEl?.isConnected && data) renderScorePills(scoresEl, data)
    })
  } else {
    context.metricsCache.set(ticker, 'loading')
    const promise = context.fetchStockMetrics(ticker)
    context.metricsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.metricsPromiseMap.delete(ticker)
      if (data) {
        context.metricsCache.set(ticker, data)
        if (fundCard?.isConnected) renderFundamentalsColumn(fundCard, data, livePrice, activeStrike)
        if (scoresEl?.isConnected) renderScorePills(scoresEl, data)
      } else {
        context.metricsCache.set(ticker, 'error')
        if (fundCard?.isConnected) {
          fundCard.textContent = ''
          const errEl = el('div', 'pdp-error')
          errEl.appendChild(txt('Unavailable'))
          fundCard.appendChild(errEl)
        }
      }
    })
  }

  // ── Signals ───────────────────────────────────────────────
  const cachedSignals = context.signalsCache.get(ticker)
  if (cachedSignals && cachedSignals !== 'loading' && cachedSignals !== 'error') {
    if (sigCard) reRenderSignals(cachedSignals)
  } else if (cachedSignals === 'loading') {
    context.signalsPromiseMap.get(ticker)?.then(data => {
      if (sigCard?.isConnected && data) reRenderSignals(data)
    })
  } else {
    context.signalsCache.set(ticker, 'loading')
    const promise = context.fetchSignalsData(ticker)
    context.signalsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.signalsPromiseMap.delete(ticker)
      if (data) {
        context.signalsCache.set(ticker, data)
        if (sigCard?.isConnected) reRenderSignals(data)
      } else {
        context.signalsCache.set(ticker, 'error')
        if (sigCard?.isConnected) {
          sigCard.textContent = ''
          const errEl = el('div', 'pdp-error')
          errEl.appendChild(txt('Unavailable'))
          sigCard.appendChild(errEl)
        }
      }
    })
  }

  // ── Company profile ───────────────────────────────────────
  const cachedProfile = context.profileCache.get(ticker)
  if (cachedProfile && cachedProfile !== 'loading' && cachedProfile !== 'error') {
    if (identityEl) renderProfileHeader(identityEl, ticker, cachedProfile)
  } else if (cachedProfile === 'loading') {
    context.profilePromiseMap.get(ticker)?.then(data => {
      if (identityEl?.isConnected && data) renderProfileHeader(identityEl, ticker, data)
    })
  } else {
    context.profileCache.set(ticker, 'loading')
    const promise = context.fetchCompanyProfile(ticker)
    context.profilePromiseMap.set(ticker, promise)
    promise.then(data => {
      context.profilePromiseMap.delete(ticker)
      if (data) {
        context.profileCache.set(ticker, data)
        if (identityEl?.isConnected) renderProfileHeader(identityEl, ticker, data)
      } else {
        context.profileCache.set(ticker, 'error')
        // leave ticker text as-is on error — no DOM change needed
      }
    })
  }

  // ── Earnings surprises ────────────────────────────────────
  const cachedEarnings = context.earningsCache.get(ticker)
  if (cachedEarnings && cachedEarnings !== 'loading' && cachedEarnings !== 'error') {
    // Re-render signals with earnings data if signals already rendered
    const cs = context.signalsCache.get(ticker)
    if (cs && cs !== 'loading' && cs !== 'error' && sigCard?.isConnected) {
      reRenderSignals(cs)
    }
  } else if (cachedEarnings === 'loading') {
    context.earningsPromiseMap.get(ticker)?.then(data => {
      if (!data || !sigCard?.isConnected) return
      const cs = context.signalsCache.get(ticker)
      if (cs && cs !== 'loading' && cs !== 'error') reRenderSignals(cs)
    })
  } else {
    context.earningsCache.set(ticker, 'loading')
    const promise = context.fetchEarningsSurprise(ticker)
    context.earningsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.earningsPromiseMap.delete(ticker)
      const result = data ?? 'error'
      context.earningsCache.set(ticker, result)
      if (data && sigCard?.isConnected) {
        const cs = context.signalsCache.get(ticker)
        if (cs && cs !== 'loading' && cs !== 'error') reRenderSignals(cs)
      }
    })
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. Fix any errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tables/position-detail-panel.ts
git commit -m "feat(panel): wire profile header, score pills, earnings cache into triggerDataFetch"
```

---

## Task 9: CSS for all new elements + row height + typecheck + build

**Files:**
- Modify: `src/styles/app.css` (within the `/* ── Position detail panel */` block, lines 2330–2412)
- Modify: `src/ui/tables/active-positions.ts` (line ~252: height 220 → 300)
- Modify: `src/ui/tables/trades-table.ts` (line ~547: height 220 → 300)

- [ ] **Step 1: Update row heights**

In `src/ui/tables/active-positions.ts`, change:
```ts
return row?._isDetailRow ? 220 : 46;
```
to:
```ts
return row?._isDetailRow ? 300 : 46;
```

In `src/ui/tables/trades-table.ts`, change:
```ts
_isDetailRow ? 220 : 50,
```
to:
```ts
_isDetailRow ? 300 : 50,
```

- [ ] **Step 2: Add all new CSS to `src/styles/app.css`**

Find the line `.pdp-range-dot { ... }` (around line 2380) and add the new strike marker immediately after:

```css
.pdp-range-strike { position: absolute; top: -5px; width: 2px; height: 14px; border-radius: 1px; background: var(--color-warning, #f59e0b); border: 1px solid var(--color-surface); transform: translateX(-50%); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
```

Find `.pdp-range-row { ... }` (line ~2377) and add the price label above it:

```css
.pdp-range-price-label { font-size: 11px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 2px; }
```

After `.pdp-sparkline-label { ... }` add:

```css
/* Meta rows (HV30, volume, vs SPX) */
.pdp-meta-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: var(--space-4); }
.pdp-meta-label { font-size: 10px; color: var(--color-text-secondary); }
.pdp-meta-value { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.pdp-meta-value--pos { color: var(--color-success); }
.pdp-meta-value--neg { color: var(--color-error); }
.pdp-meta-value--warn { color: var(--color-warning, #f59e0b); }
.pdp-meta-value--muted { color: var(--color-text-secondary); }
```

After `.pdp-header-ticker { ... }` add:

```css
/* Profile header */
.pdp-header-identity { display: flex; align-items: center; gap: var(--space-6); flex: 1; min-width: 0; }
.pdp-company-logo { border-radius: 3px; flex-shrink: 0; object-fit: contain; }
.pdp-company-name { font-weight: var(--font-weight-bold); font-size: var(--font-size-base); color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pdp-industry-badge { font-size: 10px; color: var(--color-text-secondary); background: var(--color-border); border-radius: var(--radius-sm); padding: 1px 6px; white-space: nowrap; flex-shrink: 0; }
.pdp-header-scores { display: flex; align-items: center; gap: var(--space-6); flex-shrink: 0; flex-wrap: wrap; }

/* Score pills */
.pdp-score-pill { font-size: 10px; font-weight: var(--font-weight-semibold); padding: 2px 8px; border-radius: 10px; white-space: nowrap; cursor: default; }
.pdp-score-pill--bull { background: #dcfce7; color: #15803d; }
.pdp-score-pill--neut { background: var(--color-border); color: var(--color-text-secondary); }
.pdp-score-pill--bear { background: #fee2e2; color: #b91c1c; }
```

After `.pdp-analyst-bar__ss { ... }` add:

```css
/* Earnings surprise grid */
.pdp-earnings-header { font-size: 10px; color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-4); }
.pdp-earnings-grid { display: flex; gap: var(--space-6); margin-bottom: var(--space-8); }
.pdp-earnings-cell { display: flex; flex-direction: column; align-items: center; flex: 1; }
.pdp-earnings-period { font-size: 9px; color: var(--color-text-secondary); margin-bottom: 2px; }
.pdp-earnings-beat { font-size: 10px; font-weight: var(--font-weight-bold); color: var(--color-success); }
.pdp-earnings-miss { font-size: 10px; font-weight: var(--font-weight-bold); color: var(--color-error); }
.pdp-earnings-neutral { font-size: 10px; color: var(--color-text-secondary); }
```

- [ ] **Step 3: Full typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Production build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.Xs` with no TypeScript errors. The large bundle size warning is pre-existing and acceptable.

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Open http://localhost:5173 in Chrome.

Checklist:
- [ ] Import sample data via Import view (use a file from `tests/`)
- [ ] Navigate to Active Positions — grid renders, no console errors
- [ ] Click a position row — panel expands at 300px height
- [ ] Panel header shows ticker text; once profile loads (needs Finnhub API key), shows company name + industry badge
- [ ] Three score pills appear in the header once metrics load: momentum 🟢/🟡/🔴, balance sheet ✅/⚠️/❌, valuation 💚/🟡/🔴
- [ ] Fundamentals column: 52W range bar with price label above it and current price dot; a second orange/yellow vertical line appears at the active strike position if within range
- [ ] Vol 10D and vs SPX 13W rows appear below the KV grid
- [ ] EPS, gross margin, FCF sparklines appear (if series data available from Finnhub)
- [ ] Signals column: earnings surprise grid shows 4 quarter badges (Q1/Q2/Q3/Q4 with beat/miss %)
- [ ] Analyst consensus bar appears
- [ ] Click same row again — panel collapses
- [ ] Navigate to Trades List — same expand behavior works
- [ ] HV30 appears in the KV grid (Beta · HV30 row)

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css src/ui/tables/active-positions.ts src/ui/tables/trades-table.ts
git commit -m "feat(panel): CSS for score pills, profile header, earnings grid, strike marker, meta rows; row height 300px"
```

---

## Self-review checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| Momentum Score 🔴/🟡/🟢 (5D, 13W, 52W) | Task 4, Task 8 |
| Valuation Score (PE vs own history, percentile) | Task 4, Task 8 |
| Balance Sheet Health badge | Task 4, Task 8 |
| 52W Range with low/high and current price label | Task 6 |
| Active strike marker on 52W range | Task 5, Task 6 |
| HV30 (realized vol proxy) | Task 1 (field), Task 6 (render) |
| Volume trend (10D vs 3M avg) | Task 1 (field), Task 6 (render) |
| Relative to S&P 13W | Task 1 (field), Task 6 (render) |
| ROE TTM | Task 1 (field), Task 6 (KV grid) |
| Company profile header (name, logo, industry) | Task 2, Task 8 |
| Earnings surprise history (last 4Q) | Task 3, Task 7, Task 8 |
| Gross margin sparkline | Task 1 (series), Task 6 (render) |
| FCF per share sparkline | Task 1 (series), Task 6 (render) |
| Fix series extraction bug (epsAnnual always empty) | Task 1 |
| CSS for all new elements | Task 9 |
| Row height increase | Task 9 |

**Type consistency check:**
- `StockMetrics.peAnnualSeries` defined in Task 1, used in `computeValuationScore` in Task 4 ✓
- `StockMetrics.debtToEquity` defined in Task 1, used in `computeBalanceSheetScore` in Task 4 ✓
- `CompanyProfile` defined in Task 2, used in `PositionDetailPanelContext` in Task 5 and `renderProfileHeader` in Task 8 ✓
- `EarningsSurprise[]` defined in Task 3, used in `renderSignalsColumn` in Task 7 ✓
- `activeStrike` parameter added to `triggerDataFetch` in Task 5, used in Task 8's rewrite ✓
- `renderFundamentalsColumn` signature updated in Task 5 (optional) and Task 6 (used) ✓
- `MomentumGrade`, `HealthGrade`, `ValuationGrade` types defined in Task 4, used in `renderScorePills` in Task 8 ✓
