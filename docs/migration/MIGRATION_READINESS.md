# Migration Readiness

This document is the operational plan for the v2 migration. Resolved decisions
live in `DECISIONS.md`; canonical legacy behavior lives in `DOMAIN_MODEL_MAP.md`,
`FEATURE_INVENTORY.md`, and `INTEGRATIONS.md`.

---

## Codebase reality check

The current codebase is **vanilla JavaScript**, not Java (the prompt's framing was wrong). What exists:

- `src/app.js` — 21,440 lines, single-file SPA, no build system, no npm
- `src/index.html` — 1,011 lines, all views inline
- `src/style.css` — 4,731 lines, design tokens + dark mode
- `mcp/` — Python FastMCP server, read-only over the JSON DB, published to PyPI on `mcp-X.Y.Z` tags
- Storage: `localStorage` + JSON files via File System Access API (no server)
- Deployment: minify + push to `gh-pages` on GitHub release

Detailed inventories: `DOMAIN_MODEL_MAP.md`, `FEATURE_INVENTORY.md`, `INTEGRATIONS.md`.

---

## Migration scope (confirmed)

- Target stack as specified in `gammaledger-migration-prompt.md`: FastAPI + SQLModel + Alembic + ARQ; React 18 + TS + Vite + shadcn/ui + Zustand + TanStack Query
- **Dual-mode** product: local mode (single-user, SQLite, no auth) AND hosted mode (Postgres, FastAPI-Users, multi-tenant, feature flags, white-label)
- Local mode preserves the privacy-first promise of the current app
- Hosted mode adds auth, monetization scaffold, white-label scaffold

---

## Technical debt / risks identified

### Load-bearing
1. **62-strategy max-risk dispatch table** (app.js:2868) is the single largest source of correctness risk. Every formula must be ported with property-based tests. Current dispatcher mixes credit-width, debit, and special-case strategies — a Python dict-of-handlers is the natural shape.
2. **Lifecycle state machine** (app.js:5096) is tightly coupled to `summarizeLegs` output and uses `strike.toFixed(4)` as a join key — float drift past 4 d.p. silently breaks pair matching.
3. **Mark-to-market override of `pl`/`roi`** (app.js:5733) for held Wheel/PMCC positions is non-obvious. Backend must replicate the price fallback chain (snapshot → live → strike).
4. **`currentDate` is a getter** — `daysHeld` for open trades is non-deterministic. Backend must pin `as_of` per request.
5. **`annualizedROI` is capital-days weighted**, not a simple mean — easy to get wrong.

### Architectural
6. **Hand-rolled OFX parser** uses `DOMParser` — port to `ofxtools` (already in target stack); golden-file tests required to confirm parity.
7. **No test suite exists** in the JS codebase. Two reference fixtures live in `tests/` (AAPL & KO Wheel JSONs). Migration tests must use these as golden inputs and assert numeric equivalence on every metric `buildMCPContext` exposes.
8. **CSP commented out**. Hosted mode should ship with one enforced.
9. **AES key in localStorage alongside ciphertext** — same-origin scope only. Cannot meaningfully migrate to hosted mode; users must re-enter API keys (or hosted mode proxies third-party calls server-side, see Open Question 1).
10. **Several unguarded `innerHTML` assignments** (app.js:4168, 8395, 8399, 8506) — port carefully; React's default escaping helps.

### MCP contract
11. **`mcpContext` is a frozen wire format** — both `app.js` writes it and `mcp/src/server.py` reads it. New backend must emit it byte-compatible (key names, nesting, precision, null-stripping). Otherwise existing PyPI MCP clients break.
12. **`mcp/README.md` documents shortened tool names** (`get_database_info`) but actual names are `gammaledger_*`. Keep the actual names.

### Missing features (advertised but absent)
13. **OFX export** is mentioned in CLAUDE.md but no emitter exists. Either implement in the new system or remove from the marketing surface.
14. **Sharpe / Sortino gauge charts** are coded but commented out in HTML. Decision needed: ship or drop.

---

## Resolved decisions

See `DECISIONS.md` for the binding record. Summary:

- Hosted API keys: server-side proxy; local mode can keep browser-side keys.
- Local distribution: Python wheel target plus Docker Compose for contributors.
- Existing-user migration: browser wizard plus JSON upload fallback.
- Repo strategy: `v2/` subdirectory; `src/` keeps shipping until parity.
- MCP: maintain current `mcpContext` and `gammaledger_*` tool names.
- Phase 0: scaffold plus green gates only.
- Deferral boundary: auth/white-label/monetization/ARQ/Redis/PWA wait until migration and analytics parity are correct.

---

## Phase 0 status

Phase 0 scaffold exists in `v2/` and its quality gates have been verified.

```bash
cd v2/backend
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run python -m pytest

cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run build

cd ..
docker compose build
docker compose up -d
curl -fsS http://127.0.0.1:8765/health
curl -fsS http://127.0.0.1:8080/
docker compose down
```

Note: `trades` and partial `pnl` domain code already exists. Treat that as
early Phase 1 work, not Phase 0 scope.

---

## Phase 1 plan

Phase 1 proceeds as a complete vertical slice before broadening:

1. [x] JSON import accepts both legacy envelope shapes and bare legacy `trades[]` arrays.
2. [x] `trades` persists Trade + Leg with schema, service, router, Alembic migration, and tests.
3. [x] `pnl` ports the closed Wheel load-bearing primitives with fixture parity.
4. [x] `mcpContext` parity tests compare the stable closed-trade surface in the AAPL and KO fixtures.
5. [x] Minimal React path can list imported trades from the API.
6. [x] Feature parity matrix is generated from `FEATURE_INVENTORY.md`.

Reading-order priority for the new team during Phase 1:
1. `DOMAIN_MODEL_MAP.md` §7 (financial calcs) — porting target
2. `tests/gammaledger-wheel-reference-AAPL.json` + `KO.json` — golden inputs
3. `INTEGRATIONS.md` §7 (mcpContext contract) — output target

### Phase 1 acceptance gates

- Row counts match legacy JSON input.
- Checksums or exact comparisons cover key financial fields: `cashFlow`, `pl`, `fees`, `entryPrice`, `exitPrice`, `roi`, `maxRisk`, `capitalAtRisk`.
- `mcpContext` output matches the legacy fixture for all stable closed-trade keys.
- Open-trade analytics accept an explicit `as_of` date so date-sensitive metrics are deterministic.
- Existing backend CI gates remain green.

---

## Status

- [x] Step 1 — file inventory
- [x] Step 2 — read codebase (3 parallel Explore agents)
- [x] Step 3 — feature inventory grouped by area (`FEATURE_INVENTORY.md`)
- [x] Step 4 — external integrations identified (`INTEGRATIONS.md`)
- [x] Step 5 — Domain Model Map + Feature Inventory written
- [x] Step 6 — decisions recorded in `DECISIONS.md`
- [x] Phase 0 — scaffold present; backend, frontend, and Docker gates pass
- [x] Phase 1 — domain storage complete for legacy Trade/Leg data, import batches, runtime compatibility snapshots, leg import metadata, local settings, API config envelopes, consents, JSON migration, closed Wheel P&L, closed-trade MCP parity, and minimal React list

## Phase audit against requested checklist

### Phase 0 — Foundation

- [x] Monorepo structure exists under `v2/`: `backend/`, `frontend/`, `docker/`, and migration docs.
- [x] `backend/config.py` defines and documents env vars via `ENV_VARS` plus `.env.example`.
- [x] `backend/database.py` defaults to SQLite and accepts PostgreSQL async URLs.
- [x] `backend/main.py` provides an app factory and `/health`.
- [x] Alembic is configured with initial empty migration plus the current Trade/Leg schema migration.
- [x] Vite + React + TypeScript + Tailwind + shadcn-style UI scaffolding exists.
- [x] Docker Compose starts local API + web stack.
- [x] GitHub Actions runs backend lint/type/test and frontend type/lint/test/build.
- [x] Pre-commit hooks cover whitespace/YAML, backend Ruff, backend mypy/tests, and frontend typecheck.

### Phase 1 — Domain Models & Storage

- [x] Persisted Trade and Leg domain models are represented in SQLModel.
- [x] Legacy import batches, runtime trade snapshots, leg import metadata, app settings, consent records, and API credential envelopes are represented in SQLModel.
- [x] Alembic migrations exist for the full Phase 1 schema.
- [x] Pydantic v2 request/response schemas exist for every Phase 1 entity.
- [x] Legacy JSON migration imports file exports, localStorage envelopes, and bare trade arrays through both `/api/v1/migrate` and `gammaledger import-json`.
- [x] Migration responses validate row counts, leg counts, and key financial checksums.
- [x] Non-trade localStorage settings/preferences/consents are modeled as SQL tables.
- [x] Runtime JS fields are preserved in compatibility snapshots and recomputed on read rather than treated as canonical financial columns.

### Phase 2 — Core Backend APIs

- [x] `trades` CRUD, OFX import, and bulk delete endpoints exist.
- [x] OFX import parses the supplied Interactive Brokers sample (`v2/samples/U6752716_202604_202604.ofx`) into trades, legs, and leg import metadata.
- [x] `positions` exposes open aggregation, filters, expiring positions, detail, and assignment/coverage detection.
- [x] `strategies` endpoints expose breakdown, Wheel/PMCC tracker rows, and CSP grouping.
- [x] `pnl` computes realized P&L, fallback unrealized P&L for held assigned stock, ROI, annualized return, and current summary windows.
- [x] `analytics` exposes portfolio summary, strategy breakdown, ticker exposure, active positions, concentration, and MCP context.
- [~] Full JavaScript parity is covered for the tested Phase 2 surface and supplied OFX sample. Exact per-strategy max-risk parity for all 62 strategies still needs broader legacy golden/property fixtures.

## Phase 2 plan

Phase 2 expands the backend analytics surface beyond the Phase 1 closed-Wheel
fixture slice:

1. [x] Add deterministic `as_of` handling for open-position analytics.
2. [x] Add active-position MCP rows, DTE buckets, concentration, and open-position API.
3. [x] Add `/api/v1/analytics/mcp-context` as the server-computed MCP snapshot.
4. [x] Port full lifecycle state machine, including assignment, cash settlement, rolling, and expiration cutoff behavior.
   Covered so far: date-only expiration rollover, cash-settlement closure, assigned Wheel awaiting coverage, covered Wheel reactivation, and simple roll detection.
5. [~] Expand max-risk dispatch beyond Wheel/CSP into the 62-strategy table.
   Implemented: strategy-family dispatch for debit, credit-width, CSP/Wheel, PMCC, Covered Call, Short Call unlimited-risk, and fallback formulas. Pending: per-strategy golden/property fixtures for every one of the 62 formulas.
6. [x] Port Wheel/PMCC tracker output, including coverage and effective cost basis.
   Covered: assigned-share rows, premium collected, effective cost basis, covered/uncovered share counts, active short-call count, and fallback held-stock mark-to-market.

Next action: Phase 3 frontend can begin against the completed Phase 2 API surface.
Before shipping financial parity broadly, add golden/property fixtures for all 62
strategy risk formulas.

## Phase 3 status

Phase 3 frontend is implemented against the Phase 2 API surface:

1. [x] Dashboard with key metrics, P&L trend, strategy bars, DTE buckets, and summary tables.
2. [x] Trades feature with list, ticker filter, add/edit form, delete, JSON migration hook, and OFX import.
3. [x] Positions feature with open positions, expiring positions, filters, and detail view.
4. [x] Wheel/PMCC tracker with coverage, basis, premium, and CSP grouping.
5. [x] Analytics feature with P&L windows, calendar buckets, strategy breakdown, and ticker exposure.
6. [x] Settings feature with theme, fee/rate-limit defaults, disclaimer, and AI consent preferences.
7. [x] Responsive app shell with desktop sidebar and mobile bottom navigation.
8. [x] PWA manifest and service worker for static asset caching.

Phase 3 quality gates verified:

```bash
cd v2/frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

## Phase 4 status

Phase 4 AI integration is implemented with local-first safety:

1. [x] Existing Gemini request shape is ported to the backend `ai` domain with model, endpoint, temperature, max-token, and API-key handling.
2. [x] External Gemini calls are feature-flagged via `AI_EXTERNAL_CALLS_ENABLED`; local mode defaults to deterministic offline analysis.
3. [x] AI assistant chat panel is implemented in the React frontend.
4. [x] AI-powered trade analysis endpoint is implemented at `/api/v1/ai/trades/{trade_id}/analysis`.
5. [x] AI feature endpoint is implemented at `/api/v1/ai/features`.

Phase 4 quality gates verified:

```bash
cd v2/backend
uv run ruff check .
uv run mypy src
uv run python -m pytest

cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run build
```
