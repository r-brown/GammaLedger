# Migration Decisions

These decisions resolve the open questions from `MIGRATION_READINESS.md` and
are binding unless replaced by a later ADR.

## D1 — Repo Strategy

Use a `v2/` subdirectory in this repository. The legacy vanilla-JS app in
`src/` continues to ship through the existing GitHub Pages release workflow
until v2 reaches feature parity.

Rationale: keeps history and issue context together, avoids interrupting the
current app, and allows incremental parity work.

## D2 — Local Distribution

Support both developer Docker Compose and a local Python distribution:

- Dev/test: `docker compose up` from `v2/`
- Local user target: `pip install gammaledger && gammaledger serve`

Rationale: Docker is useful for contributors; a Python wheel is closer to the
existing MCP package distribution and preserves a lightweight local-first story.

## D3 — Hosted API Key Handling

Hosted mode uses a server-side proxy for Gemini and Finnhub. Users enter keys
once; the backend stores them encrypted and performs outbound API calls. Local
mode may retain browser-side keys for privacy-first/offline use.

Rationale: localStorage encryption stores the AES key alongside the ciphertext,
so it does not provide meaningful hosted-mode secret protection.

## D4 — Existing-User Migration UX

Implement both migration paths:

- Preferred: browser-side wizard reads `GammaLedgerLocalDatabase` and legacy
  keys, then uploads a validated payload to `/api/v1/migrate`.
- Fallback: user exports JSON from the legacy app and uploads it to v2.

Rationale: thousands of users may have localStorage-only data; requiring a
manual export would create unnecessary data-loss risk.

## D5 — MCP Compatibility

Maintain current `mcpContext` key names, nesting, numeric precision, and compact
null-stripping behavior for the compatibility window. Do not rename the
`gammaledger_*` MCP tools.

Rationale: the existing PyPI MCP server treats the JSON shape as its public
contract.

## D6 — Phase 0 Scope

Phase 0 is only the scaffold and green quality gates. Domain code that already
exists in `v2/` is treated as early Phase 1 work and must pass the same gates.

Acceptance gates:

- Backend: `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy src`, `uv run python -m pytest`
- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
- Docker: `docker compose up --build` starts API and frontend locally

## D7 — Deferral Boundary

Calculation parity, data migration, and MCP compatibility come before hosted
scaffolding. Auth, white-labeling, monetization, ARQ workers, Redis caching, and
PWA behavior are deferred until the migration path and core analytics are
correct.

Rationale: these features increase architectural surface area but do not reduce
the largest migration risk: financial correctness.
