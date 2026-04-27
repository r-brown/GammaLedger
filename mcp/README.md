# GammaLedger MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) server that exposes a local [GammaLedger](https://gammaledger.com) options trading journal to AI agents (Claude, Gemini, etc.) — read-only, fully local, no cloud round-trip.

The server reads the JSON database file produced by the GammaLedger app's **Save Database** action and uses the pre-computed `mcpContext` section as the single source of truth for portfolio metrics, active positions, Wheel/PMCC tracking, breakdowns, and audits.

## Features

- **Local-first** — reads a JSON file on your machine; no API keys, no cloud calls.
- **Pre-computed** — leans on the GammaLedger app's analytics engine, so the AI sees the same numbers as the dashboard without re-deriving them.
- **Auto-refresh** — re-reads the DB whenever its mtime changes; no restart required after re-saving.
- **Tools, prompts, resources** — covers headline summary, position drill-down, risk audits, and guided analysis.

## Install & run with `uvx`

The server is designed to launch via [`uvx`](https://docs.astral.sh/uv/):

```bash
# Local (during development — run from the gammaledger repo root)
uvx --from ./mcp gammaledger-mcp \
    --db-path ~/gammaledger.json

# Once published to PyPI
uvx gammaledger-mcp --db-path ~/gammaledger.json
```

Configuration precedence: `--db-path` > `GAMMALEDGER_DB_PATH` env var > `~/gammaledger.json`.

## Wire it into an AI client

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

A sample config is in [`examples/`](./examples/).

## Tools

| Tool | Purpose |
|---|---|
| `get_database_info` | File path, schema version, trade count, mcpContext freshness. |
| `get_portfolio_summary` | Headline dashboard — counts, P&L, win rate, profit factor, Sharpe/Sortino, drawdown, expectancy, streak. |
| `get_pl_breakdown` | Time-windowed realised P&L: total / realized / unrealized / YTD / MTD / 7d / 30d / 90d / 1y. |
| `get_open_positions` | Active positions with optional filters: `ticker`, `strategy`, `dte_max`, `underwater_only`. |
| `get_position` | Full detail for a specific trade ID, including all legs. |
| `get_wheel_pmcc_positions` | Wheel and PMCC tracker: cost basis, premium history summary, coverage status. |
| `get_recent_closed_trades` | Most recently closed trades (default 10). |
| `get_strategy_breakdown` | Per-strategy stats: counts, win rate, total/avg P&L. |
| `get_ticker_exposure` | Per-ticker performance, top N by abs P&L. |
| `get_underlying_breakdown` | By Stock / ETF / Index / Future. |
| `get_concentration_risk` | Top active positions as % of total collateral. |
| `get_expiring_positions` | Active positions within N days of expiry. |
| `audit_risk` | Comprehensive risk audit grouped by severity (high / watch / healthy). |
| `audit_wheel_pmcc` | Coverage gaps and cost-basis-vs-strike concerns for Wheel/PMCC. |
| `search_trades` | Cross-status trade search by ticker / strategy / status. |

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

The app writes a `mcpContext` section into the JSON containing pre-computed metrics, breakdowns, and position summaries the server uses verbatim. If you save with an older app version that lacks `mcpContext`, most tools will return an error message asking you to re-save.

## Development

```bash
cd mcp          # from the gammaledger repo root
uv sync --all-extras
uv run pytest
uv run ruff check src tests
```

Run with the MCP inspector during development:

```bash
uv run mcp dev src/gammaledger_mcp/server.py
```

## 📜 License

GammaLedger is open source and free forever under the AGPLv3 license for non-commercial and open-source compliant use. See the [LICENSE](LICENSE) file for full terms.

This means you can freely use, modify, and distribute GammaLedger for personal projects, research, or open-source applications, as long as you share any modifications under the same license—especially if deployed over a network (e.g., in SaaS setups).

For proprietary integrations, commercial deployments, or use without sharing your changes (ideal for fintech startups or hedge funds protecting IP), we offer a flexible commercial license. Benefits include:
- No copyleft requirements
- Priority support
- Custom features or indemnification

For commercial use, please contact us to obtain a commercial license


## ⚖️ Disclaimer

This software is for **educational and analytical purposes only**. Options trading involves substantial risk and may not be suitable for all investors. Past performance does not guarantee future results. The AI Coach provides educational insights and is not financial advice. Please consult with a qualified financial advisor before making investment decisions.

**Options Risk Disclosure**: Trading options involves risk and is not suitable for all investors. You could lose more than your initial investment. Please read the Characteristics and Risks of Standardized Options before trading.