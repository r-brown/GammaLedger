# GammaLedger backend (v2)

Python 3.12+, FastAPI, SQLModel, async SQLAlchemy.

## Setup

```bash
cd v2/backend
uv sync --extra dev
cp .env.example .env
uv run uvicorn gammaledger.main:app --reload --port 8765
# or:
uv run gammaledger serve --reload
```

Hit `http://127.0.0.1:8765/health` — should return `{"data": {"status": "ok", ...}}`.

## Import legacy data

```bash
uv run gammaledger import-json ../../tests/gammaledger-wheel-reference-KO.json
```

The command prints imported/replaced/skipped counts plus validation totals for
source vs persisted trades, legs, and key financial checksums.

## Tests

```bash
uv run pytest
```

## Migrations

```bash
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "describe change"
```

In **local mode**, `init_db()` creates tables from `SQLModel.metadata` on
startup — Alembic is optional for single-user installs. In **hosted mode**,
Alembic is the source of truth; do not call `init_db()`.

## Layout (Phase 0)

```
src/gammaledger/
  main.py         # app factory + /health
  config.py       # env via python-decouple
  database.py     # async engine + session factory
  cli.py          # `gammaledger serve`
  shared/
    envelope.py   # response shape helpers
```

Phase 1 adds `domains/trades/`, `domains/pnl/`, etc.
