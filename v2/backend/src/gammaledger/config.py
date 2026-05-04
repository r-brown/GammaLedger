"""Application settings loaded from environment via python-decouple.

Local mode: SQLite, auth disabled, no Redis.
Hosted mode: PostgreSQL, auth enabled, Redis required.
"""

from decouple import config  # type: ignore[import-untyped]

ENV_VARS: dict[str, str] = {
    "APP_NAME": "Human-readable service name exposed in logs and health checks.",
    "APP_ENV": "Runtime mode: local for SQLite single-user installs, hosted for PostgreSQL deployments.",
    "DEBUG": "Enable SQL echo and verbose runtime diagnostics.",
    "DATABASE_URL": "Async SQLAlchemy URL. Defaults to local SQLite; use postgresql+asyncpg for hosted mode.",
    "AUTH_ENABLED": "Feature flag for hosted authentication. False bypasses auth and injects LOCAL_USER_ID.",
    "LOCAL_USER_ID": "Synthetic user id used by local mode when AUTH_ENABLED=false.",
    "JWT_SECRET": "HMAC secret for hosted JWT access and refresh tokens. Override in hosted deployments.",
    "JWT_ACCESS_TTL_MINUTES": "Access token lifetime in minutes.",
    "JWT_REFRESH_TTL_DAYS": "Refresh token lifetime in days.",
    "AUTH_REQUIRE_VERIFIED_EMAIL": "Require verified email before login when AUTH_ENABLED=true.",
    "TENANTS_ENABLED": "Feature flag for hosted multi-tenant data scoping. Deferred until analytics parity is stable.",
    "DEFAULT_TENANT_SLUG": "Fallback tenant slug used when tenant resolution is disabled or missing.",
    "REDIS_URL": "Redis connection URL for hosted background jobs and caching. Empty in local mode.",
    "GEMINI_API_KEY": "Hosted-mode server-side Gemini proxy key. Local mode keeps user keys browser-side.",
    "GEMINI_MODEL": "Gemini model id used when external AI calls are enabled.",
    "GEMINI_ENDPOINT": "Gemini API base endpoint for generateContent calls.",
    "GEMINI_MAX_TOKENS": "Maximum Gemini response tokens for assistant output.",
    "AI_EXTERNAL_CALLS_ENABLED": "Feature flag controlling outbound AI calls. False keeps AI fully local.",
    "FINNHUB_API_KEY": "Hosted-mode server-side quote proxy key. Local mode keeps user keys browser-side.",
    "CORS_ORIGINS": "Comma-separated browser origins allowed to call the API. Empty means same-origin only.",
}

APP_NAME: str = config("APP_NAME", default="gammaledger")
APP_ENV: str = config("APP_ENV", default="local")  # "local" | "hosted"
DEBUG: bool = config("DEBUG", default=False, cast=bool)

DATABASE_URL: str = config(
    "DATABASE_URL",
    default="sqlite+aiosqlite:///./gammaledger.db",
)

# Feature flags wired up but inert in Phase 0.
AUTH_ENABLED: bool = config("AUTH_ENABLED", default=False, cast=bool)
LOCAL_USER_ID: str = config("LOCAL_USER_ID", default="local")
JWT_SECRET: str = config("JWT_SECRET", default="dev-only-change-me")
JWT_ACCESS_TTL_MINUTES: int = config("JWT_ACCESS_TTL_MINUTES", default=15, cast=int)
JWT_REFRESH_TTL_DAYS: int = config("JWT_REFRESH_TTL_DAYS", default=30, cast=int)
AUTH_REQUIRE_VERIFIED_EMAIL: bool = config(
    "AUTH_REQUIRE_VERIFIED_EMAIL", default=False, cast=bool
)
TENANTS_ENABLED: bool = config("TENANTS_ENABLED", default=False, cast=bool)
DEFAULT_TENANT_SLUG: str = config("DEFAULT_TENANT_SLUG", default="gammaledger")

# Redis (hosted only). Leave unset in local mode.
REDIS_URL: str = config("REDIS_URL", default="")

# Server-side third-party proxies (hosted only). Phase 4+ wires these up.
GEMINI_API_KEY: str = config("GEMINI_API_KEY", default="")
GEMINI_MODEL: str = config("GEMINI_MODEL", default="gemini-2.5-flash")
GEMINI_ENDPOINT: str = config(
    "GEMINI_ENDPOINT",
    default="https://generativelanguage.googleapis.com/v1beta/models",
)
GEMINI_MAX_TOKENS: int = config("GEMINI_MAX_TOKENS", default=65536, cast=int)
AI_EXTERNAL_CALLS_ENABLED: bool = config("AI_EXTERNAL_CALLS_ENABLED", default=False, cast=bool)
FINNHUB_API_KEY: str = config("FINNHUB_API_KEY", default="")

# CORS — split comma list. Empty default means same-origin only.
CORS_ORIGINS: list[str] = [
    o.strip() for o in config("CORS_ORIGINS", default="").split(",") if o.strip()
]


def is_local_mode() -> bool:
    return APP_ENV == "local"


def is_hosted_mode() -> bool:
    return APP_ENV == "hosted"
