# GammaLedger — Claude Code Instructions (Phase 2)

## Project Context

GammaLedger is a **local-only, privacy-first, open-source** options portfolio tracker.
It runs entirely in the browser with no backend. All data lives in `localStorage`.

Phase 1 is complete: the codebase is now split into ES modules under `src/`, built with Vite.
The module structure is:

```
src/
  core/         config.js, state.js, storage.js
  trades/       positions.js, wheel.js, pmcc.js, spreads.js
  calculations/ pnl.js, costbasis.js, greeks.js, formatting.js
  ui/           tables.js, charts.js, modals.js, filters.js, toasts.js
  utils/        dates.js, dom.js, export.js, import.js
  styles/       base.css, layout.css, tables.css, ...
  index.js
```

---

## Phase 2 Goal

Add **TypeScript** to the codebase for type safety, IDE support, and long-term correctness.
Priority is the **financial calculation and data model layers** — these carry the highest risk
of silent bugs from wrong types (e.g. string vs number for P&L, wrong date format, missing fields).

This is an **incremental migration**. JS and TS files coexist throughout.
The app must work correctly after every step. No feature changes.

---

## Constraints — Read Before Acting

- **Do not change any business logic** — add types to existing code, do not rewrite it
- **Do not introduce UI frameworks** (React, Vue, etc.)
- **Do not change the localStorage schema** — existing user data must survive migration
- **Do not rename public API functions** — external callers (e.g. `index.js`) must not break
- **Do not enable `strict: true` globally at the start** — tighten incrementally per module
- **Commit after each file is converted** — bisectable history is mandatory
- **All existing functionality must work after every step** — run the smoke test checklist

---

## Step 1 — Pre-Migration Analysis

Before touching any file, read the current codebase and produce an analysis report.

### 1.1 — Identify type-unsafe hotspots

Read every `.js` file under `src/` and identify:

- Functions that mix `string` and `number` for financial values (prices, premiums, P&L)
- Date values stored/passed as `string`, `number` (timestamp), or `Date` objects — note inconsistencies
- Objects passed between modules with no documented shape (plain `{}` bags)
- Functions with no return type that callers depend on
- `localStorage` values parsed with `JSON.parse()` and used without validation
- Any `null` / `undefined` values that could propagate silently

### 1.2 — Catalogue the domain objects

List every distinct data shape used in the app. For each one, note:
- Where it is created
- Where it is read
- All fields and their apparent types
- Whether it is persisted to `localStorage`

Expected objects include (adjust based on actual codebase):
`Trade`, `Position`, `WheelCycle`, `PMCCPosition`, `PMCCLeg`, `Spread`, `AppState`,
`StorageSchema`, `ChartDataset`, `FilterState`, `ExportRow`

Output this as: `docs/refactor/phase2-analysis.md`

**Wait for human review and approval before proceeding.**

---

## Step 2 — TypeScript Tooling Setup

### 2.1 — Install TypeScript and Vite plugin

```bash
npm install --save-dev typescript @types/node vite-plugin-checker
```

Install `@types` for any third-party libraries already in use:

```bash
# Install only the ones that apply to this project
npm install --save-dev @types/chart.js       # if Chart.js is used
```

For CDN libraries without `@types` packages, create a minimal declaration shim
(see Step 3.3 below).

### 2.2 — Create `tsconfig.json`

Use permissive settings initially. Strictness is added per-module as files are converted.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "skipLibCheck": true,
    "isolatedModules": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@core/*":         ["src/core/*"],
      "@trades/*":       ["src/trades/*"],
      "@calculations/*": ["src/calculations/*"],
      "@ui/*":           ["src/ui/*"],
      "@utils/*":        ["src/utils/*"],
      "@types-gl/*":     ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3 — Update `vite.config.js` → `vite.config.ts`

Rename the file and update it:

```ts
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'

export default defineConfig({
  root: '.',
  plugins: [
    checker({ typescript: true })   // shows TS errors in the browser overlay
  ],
  resolve: {
    alias: {
      '@core':         '/src/core',
      '@trades':       '/src/trades',
      '@calculations': '/src/calculations',
      '@ui':           '/src/ui',
      '@utils':        '/src/utils',
      '@types-gl':     '/src/types'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
})
```

### 2.4 — Update `package.json` scripts

```json
{
  "scripts": {
    "dev":       "vite",
    "build":     "tsc --noEmit && vite build",
    "preview":   "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

### 2.5 — Validate the setup

Run `npm run dev`. The app must load correctly with no new runtime errors.
The browser overlay may show TS warnings — that is expected at this stage.

Commit: `git commit -m "build: add TypeScript tooling and tsconfig"`

---

## Step 3 — Define the Domain Type Library

Create all types **before** converting any implementation files.
Types live in `src/types/`. No logic goes here — interfaces and type aliases only.

### 3.1 — Create the type files

```
src/
  types/
    index.ts           ← re-exports everything; single import point
    trade.ts           ← core trade and option types
    position.ts        ← aggregated position types
    wheel.ts           ← Wheel strategy types
    pmcc.ts            ← PMCC types
    spreads.ts         ← spread strategy types
    storage.ts         ← localStorage schema types
    state.ts           ← app state shape
    ui.ts              ← UI-specific types (filter state, chart config, etc.)
    common.ts          ← shared primitives and utility types
```

### 3.2 — Implement the type definitions

Use the domain object catalogue from Step 1.2 as the source of truth.
Annotate every field. Use TSDoc comments for any field that is not self-evident.

**`src/types/common.ts`** — primitives used everywhere:

```ts
/** ISO 8601 date string, e.g. "2024-11-15" */
export type ISODateString = string

/** Dollar amount as a decimal number, e.g. 1.25 = $1.25 per share */
export type DollarAmount = number

/** Number of option contracts (1 contract = 100 shares) */
export type ContractCount = number

/** Strike price in dollars */
export type StrikePrice = number

/** Option type */
export type OptionType = 'call' | 'put'

/** Trade direction */
export type TradeDirection = 'long' | 'short'

/** Strategy label */
export type StrategyType =
  | 'CSP'
  | 'CC'
  | 'PMCC'
  | 'BullPutSpread'
  | 'BearCallSpread'
  | 'Wheel'
  | 'NakedCall'
  | 'Other'

/** Position status */
export type PositionStatus = 'open' | 'closed' | 'assigned' | 'expired'
```

**`src/types/trade.ts`** — the core persisted trade record:

```ts
import type { ISODateString, DollarAmount, ContractCount, StrikePrice, OptionType, TradeDirection, StrategyType, PositionStatus } from './common'

export interface Trade {
  /** Unique identifier (UUID or timestamp-based) */
  id: string
  /** Underlying ticker symbol, uppercased */
  ticker: string
  /** Option type */
  optionType: OptionType
  /** Long or short */
  direction: TradeDirection
  /** Strategy this trade belongs to */
  strategy: StrategyType
  /** Strike price */
  strike: StrikePrice
  /** Expiration date */
  expiry: ISODateString
  /** Date the trade was opened */
  openDate: ISODateString
  /** Date the trade was closed, null if still open */
  closeDate: ISODateString | null
  /** Premium received (positive) or paid (negative) per share */
  premium: DollarAmount
  /** Number of contracts */
  contracts: ContractCount
  /** Status */
  status: PositionStatus
  /** Free-text notes */
  notes?: string
  /** ID of a linked parent trade (e.g. the short put that was assigned) */
  linkedTradeId?: string | null
}
```

**`src/types/wheel.ts`** — Wheel cycle tracker:

```ts
import type { ISODateString, DollarAmount, ContractCount, StrikePrice, PositionStatus } from './common'

export interface WheelCycle {
  id: string
  ticker: string
  /** Number of shares held if assigned */
  sharesHeld: number
  /** Cost basis per share after assignment */
  costBasisPerShare: DollarAmount
  /** Total premium collected across all CSP and CC legs in this cycle */
  totalPremiumCollected: DollarAmount
  /** All trade IDs that belong to this cycle */
  tradeIds: string[]
  status: PositionStatus
  openDate: ISODateString
  closeDate: ISODateString | null
}
```

**`src/types/pmcc.ts`** — PMCC legs:

```ts
import type { ISODateString, DollarAmount, ContractCount, StrikePrice } from './common'

export interface PMCCPosition {
  id: string
  ticker: string
  /** The long call (LEAPS) leg trade ID */
  longLegId: string
  /** All short call leg trade IDs sold against the LEAPS */
  shortLegIds: string[]
  /** Cost paid for the long LEAPS */
  longLegCost: DollarAmount
  /** Total premium collected from short legs to date */
  premiumCollected: DollarAmount
  /** Net debit (longLegCost - premiumCollected) */
  netDebit: DollarAmount
  openDate: ISODateString
  closeDate: ISODateString | null
  status: 'open' | 'closed'
}
```

**`src/types/storage.ts`** — what is persisted to `localStorage`:

```ts
import type { Trade } from './trade'
import type { WheelCycle } from './wheel'
import type { PMCCPosition } from './pmcc'

export interface StorageSchema {
  trades: Trade[]
  wheelCycles: WheelCycle[]
  pmccPositions: PMCCPosition[]
  /** Schema version — increment when the shape changes */
  version: number
}

/** All valid localStorage keys used by GammaLedger */
export type StorageKey = keyof StorageSchema
```

**`src/types/state.ts`** — runtime app state:

```ts
import type { Trade } from './trade'
import type { WheelCycle } from './wheel'
import type { PMCCPosition } from './pmcc'
import type { FilterState } from './ui'

export interface AppState {
  trades: Trade[]
  wheelCycles: WheelCycle[]
  pmccPositions: PMCCPosition[]
  activeFilters: FilterState
  isLoading: boolean
}
```

**`src/types/ui.ts`** — UI-layer types:

```ts
import type { ISODateString, StrategyType, PositionStatus } from './common'

export interface FilterState {
  ticker: string
  strategy: StrategyType | 'all'
  status: PositionStatus | 'all'
  dateFrom: ISODateString | null
  dateTo: ISODateString | null
}

export interface ToastOptions {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  durationMs?: number
}
```

**`src/types/index.ts`** — re-export everything:

```ts
export * from './common'
export * from './trade'
export * from './position'
export * from './wheel'
export * from './pmcc'
export * from './spreads'
export * from './storage'
export * from './state'
export * from './ui'
```

### 3.3 — Shim CDN libraries

For any library loaded via a CDN `<script>` tag (not npm), create a declaration file:

```ts
// src/types/vendor.d.ts  — example for Chart.js loaded from CDN
declare const Chart: typeof import('chart.js').Chart
```

Adjust based on which libraries are actually loaded from CDN.

Commit: `git commit -m "types: add domain type library"`

**Wait for human review of all types before proceeding.**
The types must accurately reflect the actual data in `localStorage` — verify against real data.

---

## Step 4 — Convert Modules to TypeScript

Convert in dependency order — same order as Phase 1 migration.
After converting each file:

1. Rename `.js` → `.ts`
2. Add type annotations to function parameters and return values
3. Import types from `@types-gl` (resolves to `src/types/`)
4. Fix any type errors reported by the checker
5. Run `npm run dev` and smoke-test the affected feature
6. Run `npm run typecheck` — zero new errors allowed before committing
7. Commit: `git commit -m "types(<module>): convert <filename> to TypeScript"`

### Conversion order

```
Phase A — Utils and Core (no domain dependencies)
  1.  src/utils/dates.ts
  2.  src/utils/dom.ts
  3.  src/utils/formatting.ts
  4.  src/core/config.ts
  5.  src/core/storage.ts
  6.  src/core/state.ts

Phase B — Calculations (depend on types and core)
  7.  src/calculations/pnl.ts
  8.  src/calculations/costbasis.ts
  9.  src/calculations/greeks.ts        ← skip if not present

Phase C — Trade logic (depend on calculations and core)
  10. src/trades/positions.ts
  11. src/trades/wheel.ts
  12. src/trades/pmcc.ts
  13. src/trades/spreads.ts

Phase D — UI layer (depend on everything above)
  14. src/ui/tables.ts
  15. src/ui/charts.ts
  16. src/ui/modals.ts
  17. src/ui/filters.ts
  18. src/ui/toasts.ts

Phase E — Data IO
  19. src/utils/export.ts
  20. src/utils/import.ts

Phase F — Entry point
  21. src/index.ts
```

### Per-file typing rules

**When converting a utility or calculation file:**

```ts
// Before (JS)
export function calcPnl(trade, closePrice) {
  return (closePrice - trade.premium) * trade.contracts * 100
}

// After (TS)
import type { Trade, DollarAmount } from '@types-gl'

export function calcPnl(trade: Trade, closePrice: DollarAmount): DollarAmount {
  return (closePrice - trade.premium) * trade.contracts * 100
}
```

**When converting `storage.ts`:**

- Type the return value of every `localStorage.getItem()` call
- Add a runtime validation guard after `JSON.parse()` — use a type predicate or a minimal `isValidSchema()` check
- Never silently swallow a parse failure — throw or return a typed error

```ts
import type { StorageSchema } from '@types-gl'

export function loadFromStorage(): StorageSchema | null {
  try {
    const raw = localStorage.getItem('gl_data')
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorageSchema
    if (!isValidSchema(parsed)) {
      console.error('[storage] Invalid schema in localStorage')
      return null
    }
    return parsed
  } catch (e) {
    console.error('[storage] Failed to parse localStorage', e)
    return null
  }
}

function isValidSchema(data: unknown): data is StorageSchema {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as StorageSchema).trades)
  )
}
```

**When converting `state.ts`:**

- The app state object must be fully typed as `AppState`
- All setter functions must accept typed values — no `any`

**When converting calculation files:**

- All dollar amounts must be `DollarAmount` (number)
- Never accept `string` for a financial value
- Use `ContractCount` and `StrikePrice` type aliases for clarity

**When converting UI files:**

- DOM references: use `HTMLElement`, `HTMLInputElement`, `HTMLSelectElement`, etc.
- Never use `any` for DOM elements — use specific types or `Element`
- Chart.js datasets must be typed if `@types/chart.js` is installed

---

## Step 5 — Enable Strict Mode Per Module

After all files are converted, enable strict mode one module at a time, starting with
the most critical (calculations) and ending with UI.

Edit `tsconfig.json` — do **not** enable globally yet. Use per-file overrides via
`@ts-check` comments or a per-directory `tsconfig` approach:

```
src/
  calculations/
    tsconfig.json    ← extends root, adds "strict": true
  core/
    tsconfig.json    ← extends root, adds "strict": true
```

Example per-directory `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  },
  "include": ["./**/*"]
}
```

**Strict mode order:**

```
1. src/calculations/     ← highest value — P&L bugs are silent and dangerous
2. src/core/             ← storage parsing and state management
3. src/trades/           ← domain logic
4. src/utils/            ← low risk, easy to type strictly
5. src/ui/               ← DOM types are noisy; do last
```

After enabling strict mode in each directory:
- Fix all errors — do not suppress with `@ts-ignore` unless absolutely unavoidable
- If `@ts-ignore` must be used, add a comment explaining why
- Commit: `git commit -m "types(<dir>): enable strict mode"`

---

## Step 6 — Add a localStorage Migration Guard

The schema type is now `StorageSchema` with a `version` field.
Implement a migration function to handle users upgrading from a pre-typed version.

Create `src/core/migration.ts`:

```ts
import type { StorageSchema } from '@types-gl'

const CURRENT_VERSION = 1

export function migrateSchema(raw: unknown): StorageSchema {
  if (!raw || typeof raw !== 'object') {
    return emptySchema()
  }

  const data = raw as Record<string, unknown>
  const version = typeof data.version === 'number' ? data.version : 0

  // Version 0 → 1: ensure all trades have an `id` field
  if (version < 1) {
    const trades = Array.isArray(data.trades) ? data.trades : []
    data.trades = trades.map((t: Record<string, unknown>, i: number) => ({
      ...t,
      id: t.id ?? `legacy-${i}`
    }))
    data.version = 1
  }

  // Add future version migrations here as version < N blocks

  return data as StorageSchema
}

export function emptySchema(): StorageSchema {
  return {
    trades: [],
    wheelCycles: [],
    pmccPositions: [],
    version: CURRENT_VERSION
  }
}
```

Call `migrateSchema()` inside `loadFromStorage()` before returning data.
Write a migration log entry to `docs/refactor/phase2-migrations.md`.

---

## Step 7 — Production Build Validation

Run:

```bash
npm run typecheck    # must exit with 0 errors
npm run build        # must produce a clean dist/
npm run preview      # validate the production build
```

Verify:

- App loads without console errors
- Existing `localStorage` data is read correctly (migration guard worked)
- All trade data displays correctly — P&L values match pre-migration values exactly
- Wheel tracker, PMCC tracker, spreads all function correctly
- CSV export and import work correctly
- Charts render without errors
- Bundle size is similar to Phase 1 — TypeScript adds zero runtime overhead

---

## Step 8 — Update `docs/refactor/phase2-summary.md`

Document:

- All types defined and their key fields
- Which modules now have `strict: true` enabled
- Any `@ts-ignore` usages and the reason for each
- `localStorage` migration steps performed
- Bundle size before and after
- Remaining type coverage gaps (any unconverted files, known `any` usages)
- Recommended next steps for Phase 3 (Vue 3 component migration)

---

## Smoke Test Checklist

Run after every module conversion and after every strict mode activation:

- [ ] `npm run typecheck` exits with 0 errors for all converted files
- [ ] App loads without console errors
- [ ] Dashboard renders with existing localStorage data
- [ ] Add a new trade — it persists after reload
- [ ] Wheel tracker shows open positions correctly
- [ ] PMCC tracker links legs correctly
- [ ] P&L values are numerically correct (not NaN, not string-concatenated)
- [ ] Date fields display correctly (no epoch timestamps, no Invalid Date)
- [ ] CSV export produces a valid file with correct column types
- [ ] CSV import reads back correctly and all fields are typed
- [ ] Charts render without errors
- [ ] All modals open and close correctly
- [ ] Existing localStorage data survives a page reload after migration

---

## Naming and Typing Conventions

- TypeScript files: `kebab-case.ts`
- Type files: `kebab-case.ts` under `src/types/`
- Interfaces: `PascalCase` (e.g. `Trade`, `WheelCycle`)
- Type aliases: `PascalCase` (e.g. `OptionType`, `DollarAmount`)
- Generic parameters: single uppercase letter or descriptive (`T`, `TKey`, `TValue`)
- Never use `any` — use `unknown` for unvalidated external data and narrow it
- Never use `object` — use a specific interface or `Record<string, unknown>`
- Prefer `interface` over `type` for object shapes that may be extended
- Prefer `type` for unions, primitives, and computed types

---

## Questions / Blockers

- A function takes many heterogeneous arguments → introduce a typed options object parameter
- A `localStorage` field doesn't match any defined type → update the type, add a migration step
- A third-party CDN library has no `@types` package and no shim is sufficient → document it in `phase2-summary.md` and type the wrapper function's return value manually
- A type error in a UI file requires significant refactoring → use `as HTMLInputElement` cast with a comment, leave a `// TODO Phase 3` note, and do not block the migration
- Circular type dependency between two files → extract the shared type to `src/types/common.ts`

Do not use `@ts-ignore` without a comment.
Do not use `as any` — use `as unknown as TargetType` with a comment if a cast is genuinely needed.
Do not proceed past a blocker silently. Report it.
