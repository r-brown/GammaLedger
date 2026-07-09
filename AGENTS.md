# GammaLedger — AI Agent Code Context

Privacy-first, local-first options trading journal and analytics dashboard. Single-page
TypeScript + Vite app (~83 ES modules → one bundle in `dist/`), no backend. No automated
test runner — see TDD section below. Live: https://gammaledger.com. AGPLv3.

## Commands
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production bundle
npm run typecheck    # tsc --noEmit + 7 strict subproject checks
```
File System Access API (save/load `.json` db files) requires Chrome/Edge.

## Structure
`src/{core,utils,trades,calculations,ai,ui,imports,database,integrations,settings,types}`.
`mcp/` — Python MCP server (uv-managed, **own nested git repo** — commit separately).
`.claude/superpowers/{plans,specs}` — feature plans/specs (see Superpowers below).

## Architecture
- **Delegation pattern**: feature modules export plain functions typed `this: SomeContext`
  (structural — only the `GammaLedger` fields they need). `GammaLedger` (`src/index.ts`)
  imports each module and wires its functions as thin delegators via `.call(this, …)`.
  No module-level mutable state — everything lives on the class instance.
- Path aliases: `@core`, `@trades`, `@calculations`, `@ui`, `@utils`, `@types-gl` (barrel
  + subpaths) — see `tsconfig.json`/`vite.config.ts`.
- Root `tsconfig.json` is `strict: false`. Seven subdirs (core, trades, calculations,
  utils, ui, imports, integrations) are `strict: true` — new modules there must pass
  `npm run typecheck:strict`.

## Data model
- `Trade` (persisted, `src/types/trade.ts`) → `EnrichedTrade` (runtime) via
  `enrichTradeData()` — computes every `RUNTIME_TRADE_FIELDS` entry; never read those
  fields back from raw storage.
- `RiskValue` tagged union replaces `Infinity` sentinels for `maxRisk`/`capitalAtRisk` —
  use `isFiniteRisk()` / `toRiskValue()` from `@trades/risk`.
- Storage: `localStorage["GammaLedgerLocalDatabase"]` = `{ version, trades, exportDate,
  mcpContext? }`, guarded by `parseStorageSchema()` (`@core/migration`, Zod schemas in
  `@core/schema.ts`). Always go through `safeLocalStorage` (`@core/storage`), never raw
  `localStorage`.

## Non-Negotiable Rules
No React/Vue (until the documented Vue3 migration plan) · no undocumented CDN scripts ·
no `Infinity` as a financial sentinel · no direct `localStorage` · never skip
`enrichTradeData()` · never read `RUNTIME_TRADE_FIELDS` from raw storage · no `as` casts
on external JSON (use `isGeminiApiResponse()`/Zod) · no module-level mutable state · new
`localStorage` keys go in `APP_CONFIG.STORAGE` + `parseStorageSchema()`.

## Gotchas
- `this.currentDate` is a getter — always live, never a stored value.
- `trade.status` can be `'Rolling'`; use `hasAssignedInventory()`, not
  `status === 'Assigned'`, to check for held shares.
- Realized P&L is leg-level (`calculateRealizedPL`) — an open short call's credit isn't
  realized until the leg terminates, even inside an assigned wheel.
- Gemini calls require `AI_COACH_CONSENT_STORAGE_KEY` consent.
- ECharts: update via `renderEChart()`, never new instances for existing roots. AG Grid
  uses `theme: 'legacy'` — don't change.

## Workflow
New feature: extend a module in the right `src/` subdir → export `this`-typed functions →
add a thin delegator in `GammaLedger` → `npm run typecheck`. Write a plan/spec in
`.claude/superpowers/{plans,specs}/YYYY-MM-DD-{slug}.md` before any new feature or major
refactor.

## Knowledge Graph
`graphify-out/` holds a persistent knowledge graph of the repo. Query with
`graphify query "<question>"`, `graphify path A B`, `graphify explain X`. Rebuild with
`/graphify . --update`.
