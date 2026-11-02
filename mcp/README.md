# GammaLedger MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) server that exposes a [GammaLedger](https://gammaledger.com) options trading journal to AI agents (Claude, Hermes, Gemini, etc.) — read-only.

The server reads the JSON database file produced by the GammaLedger app's **Save Database** action (schema `2.6`) and uses the pre-computed `mcpContext` section as the single source of truth for portfolio metrics, active positions, Wheel/PMCC tracking, breakdowns, and audits. The raw `trades` and the `watchlist` are available too.

## Features

- **Local-first** — reads a JSON file or folder on your machine; no API keys, no cloud calls.
- **Or remote** — point it at an `https://` URL (optionally with a bearer token) when the agent runs on a different machine.
- **Pre-computed** — leans on the GammaLedger app's analytics engine, so the AI sees the same numbers as the dashboard without re-deriving them.
- **Auto-refresh** — local files are re-read when their mtime changes; remote files are re-checked every 60 s (ETag aware). No restart needed after re-saving.
- **Resilient** — if a remote refresh fails, the last good copy keeps being served and `gammaledger_database_info` reports `stale: true`.
- **Tools, prompts, resources** — headline summary, position drill-down, risk audits, watchlist, and guided analysis.

## Install & run with `uvx`

The server is designed to launch via [`uvx`](https://docs.astral.sh/uv/):

```bash
uvx gammaledger-mcp --db-path ~/gammaledger.json

# pin an exact release
uvx gammaledger-mcp@1.0.0 --db-path ~/gammaledger.json

# from a checkout (development)
uvx --from ./mcp gammaledger-mcp --db-path ~/gammaledger.json
```

## Where the database lives

| You have | Use |
|---|---|
| A file | `--db-path ~/gammaledger.json` |
| A folder of saved databases | `--db-path ~/GammaLedger/` — uses `gammaledger.json` if present, otherwise the newest `*.json` that contains a `trades` list |
| A URL | `--db-url https://example.com/gammaledger.json` (a `--db-path` that starts with `http(s)://` or `file://` works too) |

Resolution order: `--db-url` > `--db-path` > `GAMMALEDGER_DB_URL` > `GAMMALEDGER_DB_PATH` > `~/gammaledger.json`.

| Environment variable | Meaning |
|---|---|
| `GAMMALEDGER_DB_PATH` / `GAMMALEDGER_DB_URL` | Same as the flags (handy for MCP client configs). |
| `GAMMALEDGER_DB_TOKEN` | Remote only. Sent as `Authorization: Bearer <token>`. Refused over plain `http://` (except loopback) and never forwarded to a different host after a redirect. |
| `GAMMALEDGER_DB_REFRESH_SECONDS` | Remote only. Minimum seconds between re-checks (default `60`). `--refresh-seconds` does the same. |
| `GAMMALEDGER_MCP_VERBOSE` | `1` for debug logging on stderr. |

Your database is your trading history. For remote access use `https://` and a token, or a pre-signed URL; the server never logs credentials or query strings (it shows only `scheme://host/path`).

Ways to get the file to a machine that is not your laptop: sync the folder (Syncthing, rsync, Dropbox, …) and use `--db-path`, or host it behind HTTPS (private object storage with a pre-signed URL, a private GitHub repo's raw URL with a token, your own server) and use `--db-url`.

## Wire it into an AI client

### Hermes Agent

Add the server to `~/.hermes/config.yaml` (check the Hermes docs for your version if the key names differ):

```yaml
mcp_servers:
  gammaledger:
    command: "uvx"
    args: ["gammaledger-mcp@1.0.0"]   # pin a released version
    env:
      # local file or folder ...
      GAMMALEDGER_DB_PATH: "/home/hermes/gammaledger/gammaledger.json"
      # ... or a remote database:
      # GAMMALEDGER_DB_URL: "https://example.com/gammaledger.json"
      # GAMMALEDGER_DB_TOKEN: "<token>"
```

Then restart Hermes (or reload its MCP servers). `uv` must be installed on the Hermes host.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gammaledger": {
      "command": "uvx",
      "args": ["gammaledger-mcp", "--db-path", "/Users/you/gammaledger.json"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add gammaledger -- uvx gammaledger-mcp --db-path ~/gammaledger.json
```

Sample configs are in [`examples/`](https://github.com/r-brown/GammaLedger/tree/main/mcp/examples).

## Tools

| Tool | Purpose |
|---|---|
| `gammaledger_database_info` | Source (file/dir/url), location, schema version, trade/watchlist counts, `mcpContext` freshness, `stale` flag. |
| `gammaledger_portfolio_summary` | Headline dashboard — counts, P&L, win rate, profit factor, Sharpe/Sortino, drawdown, expectancy, streak. |
| `gammaledger_pl_breakdown` | Time-windowed P&L: total / realized / unrealized / YTD / MTD / 7d / 30d / 90d / 1y. |
| `gammaledger_open_positions` | Active positions with optional filters: `ticker`, `strategy`, `dte_max`, `underwater_only`. |
| `gammaledger_position` | One trade: persisted record (all legs) plus the app's computed `summary` (P&L, ROI, DTE, basis, coverage). |
| `gammaledger_wheel_pmcc_positions` | Wheel and PMCC tracker: cost basis, premium history summary, coverage status. |
| `gammaledger_recent_closed_trades` | The 10 most recently closed trades (all the app embeds in the file). |
| `gammaledger_strategy_breakdown` | Per-strategy stats: counts, win rate, total/avg P&L. |
| `gammaledger_ticker_exposure` | Per-ticker performance (top 15 by abs P&L as saved by the app). |
| `gammaledger_underlying_breakdown` | By Stock / ETF / Index / Future. |
| `gammaledger_concentration_risk` | Top active positions as % of total collateral. |
| `gammaledger_expiring_positions` | Active positions within N days of expiry. |
| `gammaledger_audit_risk` | Risk audit grouped by severity (high / watch / healthy): concentration, expiry, underwater, past-expiration-still-active, unlimited risk, Wheel/PMCC coverage gaps, drawdown. |
| `gammaledger_audit_wheel_pmcc` | Coverage gaps and cost-basis-vs-strike concerns for Wheel/PMCC. |
| `gammaledger_search_trades` | Cross-status trade search by ticker / strategy / status. |
| `gammaledger_watchlist` | Followed tickers with rating, notes, and target price. |

**About per-trade P&L.** The app deliberately does not persist computed fields (`pl`, `roi`, `dte`, `capitalAtRisk`, …) on each trade. They exist in the file only inside `mcpContext`, for active positions, Wheel/PMCC positions and the 10 most recent closed trades. For older trades `gammaledger_position` / `gammaledger_search_trades` return the persisted record with a null `summary` / `pl` (and `hasComputedSummary: false`) rather than inventing numbers. Portfolio-level totals and the strategy/ticker breakdowns always cover every trade.

## Prompts

| Prompt | Description |
|---|---|
| `analyze_portfolio` | Step-by-step full portfolio review covering performance, risk, exposure, Wheel/PMCC. |
| `risk_audit` | Risk-focused review with structured severity buckets. |
| `wheel_pmcc_review` | Per-position deep-dive on premium income and coverage. |
| `weekly_review` | Tight weekly check-in: this week's P&L, closed trades, expirations. |
| `position_inspect` | Single-position deep dive (takes a `trade_id` argument). |

## Saving your GammaLedger database

1. Open the GammaLedger web app.
2. Settings → **Save Database** to write a JSON file to disk.
3. Point this MCP server at that file via `--db-path` or `GAMMALEDGER_DB_PATH`.

The app writes a `mcpContext` section into the JSON containing pre-computed metrics, breakdowns, and position summaries the server uses verbatim. If you save with an older app version that lacks `mcpContext`, the tools that need it return a clear error asking you to re-save; `gammaledger_search_trades`, `gammaledger_position`, `gammaledger_watchlist` and `gammaledger_database_info` keep working from the raw data. The watchlist appears in files saved by app versions that have the Watchlist feature (schema 2.6).

## Development

```bash
cd mcp          # from the gammaledger repo root
uv sync --all-extras
uv run pytest
uv run ruff check src tests scripts && uv run ruff format --check src tests scripts
uv run mypy src
```

Run with the MCP inspector during development:

```bash
uv run mcp dev src/server.py
```

The package depends on `mcp>=1.23,<2` (the `FastMCP` API was removed in MCP SDK 2.x).

## Releasing

Releases are published to [PyPI](https://pypi.org/project/gammaledger-mcp/) by the **GammaLedger MCP — Release & Publish to PyPI** GitHub Actions workflow (Actions → Run workflow, input `version` such as `1.0.0`). It lints, type-checks and tests on Python 3.10/3.12/3.13, builds the wheel and sdist, installs the wheel into a clean virtualenv and drives it over stdio as an MCP client would, then publishes that exact artifact via PyPI trusted publishing and creates a GitHub release tagged `mcp-<version>`.

One-time setup on PyPI (no API token needed): *Account → Publishing → Add a pending publisher* with project `gammaledger-mcp`, owner `r-brown`, repository `GammaLedger`, workflow `mcp-release.yml`, and no environment.

## 📜 License

GammaLedger is open source and free forever under the AGPLv3 license for non-commercial and open-source compliant use. See the [LICENSE](https://github.com/r-brown/GammaLedger/blob/main/LICENSE) file for full terms.

This means you can freely use, modify, and distribute GammaLedger for personal projects, research, or open-source applications, as long as you share any modifications under the same license—especially if deployed over a network (e.g., in SaaS setups).

For proprietary integrations, commercial deployments, or use without sharing your changes (ideal for fintech startups or hedge funds protecting IP), we offer a flexible commercial license. Benefits include:
- No copyleft requirements
- Priority support
- Custom features or indemnification

For commercial use, please contact us to obtain a commercial license


## ⚖️ Disclaimer

This software is for **educational and analytical purposes only**. Options trading involves substantial risk and may not be suitable for all investors. Past performance does not guarantee future results. The AI Coach provides educational insights and is not financial advice. Please consult with a qualified financial advisor before making investment decisions.

**Options Risk Disclosure**: Trading options involves risk and is not suitable for all investors. You could lose more than your initial investment. Please read the Characteristics and Risks of Standardized Options before trading.