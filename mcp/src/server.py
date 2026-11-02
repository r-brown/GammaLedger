"""GammaLedger MCP Server.

Reads a GammaLedger JSON database (saved via the app's "Save Database"
feature) from a local file/folder or a remote http(s) URL and exposes its
pre-computed metrics, positions, and audits as MCP tools, prompts, and
resources.

Usage:
    gammaledger-mcp --db-path /path/to/gammaledger.json
    gammaledger-mcp --db-path /path/to/folder
    gammaledger-mcp --db-url https://example.com/gammaledger.json   (token: GAMMALEDGER_DB_TOKEN)
    gammaledger-mcp --db-path ~/gammaledger.json --http --port 8765  (token: GAMMALEDGER_MCP_TOKEN)

The tools live in ``tools_meta`` (database / portfolio), ``tools_positions`` (positions,
trade search) and ``tools_risk`` (risk views and audits); this module wires them together
and owns the command line.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from . import __version__, tools_meta, tools_positions, tools_risk
from .database import DatabaseError, configure_db
from .http_app import (
    LOOPBACK_BIND_HOSTS,
    build_http_app,
    register_health_route,
    serve_http,
)
from .prompts import register_analysis_prompts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)

INSTRUCTIONS = """
You are connected to a GammaLedger options trading journal — a privacy-first,
local-first record of the user's options trades, positions, and analytics.
The database is read-only from your perspective: you can query and analyse
but cannot create, modify, or delete trades.

## Data sources

- `mcpContext` — pre-computed dashboard metrics, position summaries, and
  breakdowns produced by the GammaLedger app on every save. This is the
  authoritative view of portfolio state. Prefer it over re-deriving from
  raw trades.
- `trades` — the persisted trade objects with leg-level detail. The app does
  not persist computed fields (P&L, ROI, DTE) on these. `gammaledger_position`
  and `gammaledger_search_trades` join them back in: from `mcpContext` where the
  app embedded them (active positions, Wheel/PMCC positions, the 10 most recent
  closed trades; `plSource: "app"`), otherwise realized P&L is computed from the
  legs of Closed/Expired trades (`plSource: "derived"`, same arithmetic as the app).

## Freshness — check this first

The database is a snapshot taken when the user last saved it from the app. Call
`gammaledger_database_info` (or look for `dataWarning` on other answers): if
`isStale` is true, open positions, DTE and P&L describe the day of the export, not
today. Say so and ask the user to re-save the database; do not present an old
snapshot as the current book.

## What the user typically wants

- A high-level snapshot: call `gammaledger_portfolio_summary`.
- Active positions overview: `gammaledger_open_positions` (slim rows by default;
  `fields` picks keys, `fields='all'` returns everything).
- Specific trade detail (legs, cash flows): `gammaledger_position`.
- History across all trades: `gammaledger_search_trades` — filter by ticker,
  strategy, status, opened/closed date range, and P&L range; `matchedTotalPL`
  sums the P&L of every match.
- Risk view: `gammaledger_audit_risk` for a comprehensive audit, plus
  `gammaledger_concentration_risk` and `gammaledger_expiring_positions`.
- Wheel/PMCC tracking: `gammaledger_wheel_pmcc_positions` or `gammaledger_audit_wheel_pmcc`.
- Per-strategy or per-ticker performance: `gammaledger_strategy_breakdown`,
  `gammaledger_ticker_exposure`.
- Followed tickers: `gammaledger_watchlist`.
- If a tool reports `stale: true`, the database file/URL could not be
  refreshed and the last good copy is being served (see `gammaledger_database_info`).

## Conventions

- Trade IDs look like `TRD-0042`. Tickers are uppercase (e.g. SPY, AAPL).
- Strategies use display names like "Iron Condor", "Wheel", "Poor Man's
  Covered Call". Substring matching is case-insensitive.
- Status values: Open, Rolling, Closed, Expired, Assigned.
- Currency values are in the user's account currency (typically USD).
- Dates are ISO `YYYY-MM-DD`. P&L is realised for closed trades and
  marked-to-current for open trades.

## Safety

- This is informational data — the user's trading journal. Surface
  observations and flag risks, but do not provide financial advice or
  buy/sell recommendations.
- Always include a brief disclaimer when delivering analysis.
"""


def create_server() -> FastMCP:
    """Build a fully wired server (tests build their own; the CLI uses the module-level one)."""
    server = FastMCP("gammaledger-mcp", instructions=INSTRUCTIONS)
    # Clients show serverInfo.version; without this it reports the MCP SDK's version.
    server._mcp_server.version = __version__
    tools_meta.register(server)
    tools_positions.register(server)
    tools_risk.register(server)
    register_analysis_prompts(server)
    register_health_route(server)
    return server


mcp = create_server()


# ═══════════════════════════════════════════════════════════════════════════
# COMMAND LINE
# ═══════════════════════════════════════════════════════════════════════════


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="gammaledger-mcp",
        description=f"GammaLedger MCP {__version__}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Database location (first match wins):
  --db-url URL / --db-path P   A local file, a folder, or an http(s):// URL.
  GAMMALEDGER_DB_URL           Same, as an environment variable.
  GAMMALEDGER_DB_PATH          Same, as an environment variable.
  Default                      ~/gammaledger.json

Remote databases:
  GAMMALEDGER_DB_TOKEN              Sent as "Authorization: Bearer <token>" (https only).
  GAMMALEDGER_DB_REFRESH_SECONDS    Re-check interval for remote URLs (default 60).

Freshness:
  GAMMALEDGER_STALE_DAYS            Report the data as stale after this many days (default 3).

Serving over HTTP (so web clients can connect; put HTTPS in front of it):
  --http                            Listen for streamable HTTP instead of stdio.
  GAMMALEDGER_MCP_TOKEN             Bearer token clients must send (preferred over --token).

Save your database from the GammaLedger app (Settings → Save Database)
before launching this server.
""",
    )
    db = parser.add_argument_group("database")
    db.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="Path to the GammaLedger JSON database file (or a folder of them).",
    )
    db.add_argument(
        "--db-url",
        default=None,
        help="http(s):// URL (or file:// URL) of the GammaLedger JSON database.",
    )
    db.add_argument(
        "--refresh-seconds",
        type=float,
        default=None,
        help="How often to re-check a remote database (default 60).",
    )
    db.add_argument(
        "--stale-days",
        type=float,
        default=None,
        help="Flag the data as stale when the export is older than this (default 3 days).",
    )

    net = parser.add_argument_group("HTTP transport (default is stdio)")
    net.add_argument(
        "--http",
        action="store_true",
        help="Serve streamable HTTP instead of stdio.",
    )
    net.add_argument(
        "--host",
        default="127.0.0.1",
        help="Interface to bind in --http mode (default 127.0.0.1; put a TLS proxy in front).",
    )
    net.add_argument("--port", type=int, default=8765, help="Port for --http mode (default 8765).")
    net.add_argument(
        "--path", default="/mcp", help="URL path of the MCP endpoint in --http mode (default /mcp)."
    )
    net.add_argument(
        "--token",
        default=None,
        help="Bearer token required from HTTP clients. Prefer the GAMMALEDGER_MCP_TOKEN "
        "environment variable: command-line arguments are visible to other users in `ps`.",
    )
    net.add_argument(
        "--allowed-host",
        action="append",
        default=[],
        metavar="HOST",
        help="Public host name clients use to reach you through a proxy (repeatable), "
        "e.g. mcp.example.com. Use '*' to skip the Host-header check.",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        default=None,
        help="Enable verbose debug logging on stderr.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"gammaledger-mcp {__version__}",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    verbose = args.verbose or os.getenv("GAMMALEDGER_MCP_VERBOSE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")

    token = args.token or os.environ.get("GAMMALEDGER_MCP_TOKEN") or None
    if args.http:
        if not 0 < args.port < 65536:
            parser.error("--port must be between 1 and 65535")
        if not args.path.startswith("/"):
            parser.error("--path must start with '/'")
        if not token and args.host not in LOOPBACK_BIND_HOSTS:
            parser.error(
                f"--host {args.host} is reachable from other machines; set a bearer token "
                "with GAMMALEDGER_MCP_TOKEN (or --token) so your journal is not open to anyone."
            )

    try:
        db = configure_db(
            args.db_url or args.db_path,
            refresh_seconds=args.refresh_seconds,
            stale_days=args.stale_days,
        )
    except DatabaseError as exc:
        parser.error(str(exc))

    logger.info(
        "Starting GammaLedger MCP %s (source=%s, db=%s, transport=%s)",
        __version__,
        db.source.kind,
        db.location,
        "streamable-http" if args.http else "stdio",
    )
    try:
        info = db.info()
        for warning in info["warnings"]:
            logger.warning("%s", warning)
    except DatabaseError as exc:
        logger.warning("Database not readable yet: %s — tools will return errors until it is.", exc)

    if not args.http:
        mcp.run(transport="stdio")
        return

    if not token:
        logger.warning(
            "No bearer token set: anything that can reach %s:%d can read your journal.",
            args.host,
            args.port,
        )
    app = build_http_app(
        mcp,
        host=args.host,
        port=args.port,
        path=args.path,
        token=token,
        allowed_hosts=args.allowed_host,
    )
    logger.info("Listening on http://%s:%d%s", args.host, args.port, args.path)
    serve_http(app, host=args.host, port=args.port, verbose=bool(verbose))


if __name__ == "__main__":
    main()
