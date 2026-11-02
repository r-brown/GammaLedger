"""gammaledger-mcp — MCP server for the GammaLedger options trading journal."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _dist_version


def _resolve_version() -> str:
    try:
        # Authoritative: the version recorded in the installed wheel's metadata.
        return _dist_version("gammaledger-mcp")
    except PackageNotFoundError:  # pragma: no cover — running from a source tree
        try:
            from gammaledger_mcp._version import __version__ as scm_version
        except ImportError:
            return "0.0.0+unknown"
        return str(scm_version)


__version__ = _resolve_version()

__all__ = ["__version__"]
