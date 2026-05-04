# GammaLedger v2

The next-generation GammaLedger stack: FastAPI + SQLModel backend, React 18 + TypeScript frontend.

The legacy vanilla-JS app remains in `../src/` and continues to ship via the
existing `gh-pages` workflow until v2 reaches feature parity.

## Modes

- **Local** — single-user, SQLite, no auth, no Redis. Distributed as
  `pip install gammaledger` (`gammaledger serve`) or via `docker compose up`.
- **Hosted** — multi-tenant, PostgreSQL, FastAPI-Users auth, Redis,
  feature-flagged AI. Same codebase, different env (`APP_ENV=hosted`).

## Layout

```
v2/
├── backend/           # FastAPI app — see backend/README.md
├── frontend/          # Vite + React — see frontend/README.md
├── docker/            # Dockerfiles + nginx config
├── docker-compose.yml # local dev (api + web); `--profile hosted` adds pg + redis
├── .pre-commit-config.yaml
└── .gitignore
```

## Quickstart (local dev, no Docker)

Two terminals:

```bash
# Terminal 1: backend on :8765
cd v2/backend
uv sync --extra dev
uv run gammaledger serve --reload

# Terminal 2: frontend on :5173 (proxies /api -> :8765)
cd v2/frontend
npm install
npm run dev
```

Open http://localhost:5173. The dashboard placeholder hits `/api/health`.

## Quickstart (Docker)

```bash
cd v2
docker compose up --build       # local mode: api + web
# or:
docker compose --profile hosted up --build   # adds postgres + redis
```

Frontend on `http://localhost:8080`, API on `http://localhost:8765`.

## Phase status

- [x] **Phase 0** — skeleton exists; backend, frontend, and Docker gates pass
- [x] Phase 1 — JSON migration, full legacy storage schema, Trade/Leg persistence, settings/consent/API-config envelopes, runtime compatibility snapshots, closed Wheel P&L, closed-trade MCP parity, and minimal React list
- [x] Phase 2 — core backend APIs complete for trades CRUD/bulk delete/OFX import, open positions/detail/expiring filters, strategy breakdown/Wheel-PMCC/CSP grouping, P&L summary, analytics summary/ticker exposure/MCP context, lifecycle transitions, migration validation, and Wheel tracker rows
- [x] Phase 3 — React frontend complete for dashboard, trades, positions, Wheel/PMCC, analytics, settings, responsive shell, and PWA manifest/service worker
- [x] Phase 4 — AI domain, Gemini-compatible backend integration, local privacy fallback, trade analysis endpoint, feature flags, and frontend assistant panel

Remaining verification before public financial-parity claims:

- Add broader golden/property fixtures for exact all-62 strategy max-risk parity before public financial-parity claims
- [ ] Phase 5 — auth + multi-user
- [ ] Phase 6 — white-label + monetization scaffold

See `../docs/migration/` for the canonical reference docs.

## Quality gates

Backend:

```bash
cd v2/backend
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run python -m pytest
```

Frontend:

```bash
cd v2/frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

Docker:

```bash
cd v2
docker compose up --build
```

## Pre-commit

```bash
pip install pre-commit
pre-commit install --config v2/.pre-commit-config.yaml
```
