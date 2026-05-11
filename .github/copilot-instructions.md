# GammaLedger Copilot Instructions

## Commands

### Browser app (`/`)

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

Focused TypeScript checks exist for the strict subprojects:

```bash
npm run typecheck:strict:calculations
npm run typecheck:strict:core
npm run typecheck:strict:trades
npm run typecheck:strict:utils
npm run typecheck:strict:ui
npm run typecheck:strict:imports
npm run typecheck:strict:integrations
```

The browser app currently has no dedicated JS/TS unit-test or lint script in `package.json`; use `npm run typecheck` for automated validation and the JSON/OFX fixtures under `tests/` for manual smoke testing.

### Relevant MCP servers

If Playwright MCP is available in the environment, use it for browser-driven smoke checks against the Vite app instead of guessing about UI state from code alone. It is especially useful for validating view switches, add-trade flows, import/export UX, sidebar behavior, and dashboard rendering across the `index.html` shell plus delegated UI modules.

### MCP server (`/mcp`)

Run `uv sync --all-extras` once before `pytest`, `ruff`, or `mypy`; those tools live in the MCP package's dev extras.

```bash
cd mcp
uv sync --all-extras
uv run python -m pytest tests/ -v
uv run python -m pytest tests/test_database.py::test_loads_basic_db -v
uv run python -m ruff check src tests
uv run python -m ruff format --check src tests
uv run python -m mypy src
uv run mcp dev src/gammaledger_mcp/server.py
```

## High-level architecture

GammaLedger is a local-first SPA built with Vite and TypeScript. The runtime entrypoint is `src/index.ts`, which instantiates the `GammaLedger` class as `window.tracker`. `index.html` is the app shell and defines the major views (`dashboard`, `trades-list`, `credit-playbook`, `add-trade`, `import`, `settings`); view switching is handled in `src/ui/views.ts`, not by a framework router.

The core architectural pattern is delegation from `GammaLedger` into feature modules. Modules under `src/core`, `src/trades`, `src/calculations`, `src/ui`, `src/imports`, `src/integrations`, and `src/payoff` export plain functions that are invoked with `.call(this, ...)` from thin delegator methods in `src/index.ts`. When adding logic, follow that pattern: define a narrow `this` context interface in the module, keep mutable state on the `GammaLedger` instance, and avoid module-level mutable state.

Persistence flows through the browser app into the MCP server. The browser app stores the working database in `localStorage` and can save/load JSON files via the File System Access API fallback flow in `src/database/persist.ts`. Saved payloads are migrated and validated through `src/core/migration.ts` + `src/core/schema.ts`, and the app writes an `mcpContext` snapshot into exported JSON. The nested `mcp/` package is a separate Python project that reads that saved JSON and uses `mcpContext` as its source of truth instead of recomputing analytics.

## Key conventions

- Use the path aliases from `tsconfig.json`/`vite.config.ts`: `@core`, `@trades`, `@calculations`, `@ui`, `@utils`, and `@types-gl`.
- Do not access `localStorage` directly. Use `safeLocalStorage` from `src/core/storage.ts`.
- Do not parse imported or persisted database payloads ad hoc. Use `parseStorageSchema()` from `src/core/migration.ts`, and reuse the Zod schemas in `src/core/schema.ts` for form/persistence validation.
- Runtime-enriched trade fields are transient. Anything in `RUNTIME_TRADE_FIELDS` / `RUNTIME_LEG_FIELDS` must be recomputed, not treated as canonical persisted data.
- Prefer the `RiskValue` tagged union from `src/trades/risk.ts` over using `Infinity` checks in new code.
- `index.html` remains the source of truth for view containers and many UI anchors; when wiring a new view or major UI surface, update both the HTML shell and the delegated UI module.
- Charts are managed through the shared ECharts helpers in `src/ui/charts/echarts.ts`; update existing chart roots through `renderEChart(...)` rather than creating ad hoc chart instances.
- Trade-facing tables use the shared AG Grid wrapper in `src/ui/tables/ag-grid.ts`; keep new table work aligned with that wrapper instead of custom table bootstrapping.
- The repo contains a second toolchain under `mcp/` with its own Python dependencies, tests, lint, and type-checking. Treat browser-app and MCP changes as related but separate workflows.
