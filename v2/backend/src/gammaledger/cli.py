"""`gammaledger` console script."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import uvicorn

from .database import dispose_db, get_sessionmaker, init_db
from .shared.migrations import import_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gammaledger")
    sub = parser.add_subparsers(dest="cmd", required=True)

    serve = sub.add_parser("serve", help="Run the local-mode server")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--reload", action="store_true")

    import_json = sub.add_parser("import-json", help="Import a legacy GammaLedger JSON export")
    import_json.add_argument("path", type=Path)
    import_json.add_argument(
        "--keep-existing",
        action="store_true",
        help="Skip existing trade ids instead of replacing them",
    )

    args = parser.parse_args(argv)

    if args.cmd == "serve":
        uvicorn.run(
            "gammaledger.main:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
        )
        return 0

    if args.cmd == "import-json":
        return asyncio.run(_import_json(args.path, replace_existing=not args.keep_existing))

    return 1


async def _import_json(path: Path, *, replace_existing: bool) -> int:
    await init_db()
    try:
        async with get_sessionmaker()() as session:
            result = await import_file(session, path, replace_existing=replace_existing)
            await session.commit()
    finally:
        await dispose_db()
    print(
        json.dumps(
            {
                "imported": result.imported,
                "replaced": result.replaced,
                "skipped": result.skipped,
                "errors": result.errors,
                "validation": {
                    "importBatchId": result.import_batch_id,
                    "sourceTradeCount": result.source_trade_count,
                    "persistedTradeCount": result.persisted_trade_count,
                    "sourceLegCount": result.source_leg_count,
                    "persistedLegCount": result.persisted_leg_count,
                    "sourceFinancialChecksum": result.source_financial_checksum,
                    "persistedFinancialChecksum": result.persisted_financial_checksum,
                    "runtimeSnapshots": result.runtime_snapshots,
                    "legMetadataRows": result.leg_metadata_rows,
                    "settingsRows": result.settings_rows,
                    "matches": result.source_trade_count == result.persisted_trade_count
                    and result.source_leg_count == result.persisted_leg_count
                    and result.source_financial_checksum == result.persisted_financial_checksum,
                },
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 1 if result.errors else 0


if __name__ == "__main__":
    sys.exit(main())
