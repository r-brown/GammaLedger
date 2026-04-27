"""gammaledger-mcp — MCP server for the GammaLedger options trading journal."""

from __future__ import annotations

try:
    from gammaledger_mcp._version import __version__
except ImportError:  # pragma: no cover — fallback when not installed via build
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
