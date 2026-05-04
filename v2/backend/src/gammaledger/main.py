"""FastAPI app factory."""

from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, database
from .domains.ai.router import router as ai_router
from .domains.analytics.router import router as analytics_router
from .domains.monetization.router import router as monetization_router
from .domains.pnl.router import router as pnl_router
from .domains.positions.router import router as positions_router
from .domains.strategies import strategies_router
from .domains.tenants.middleware import TenantMiddleware
from .domains.tenants.router import router as tenant_router
from .domains.trades.router import router as trades_router
from .domains.users.router import router as users_router
from .shared.envelope import envelope
from .shared.migration_router import router as migration_router

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(_: FastAPI) -> Any:
    log.info("startup", env=config.APP_ENV, debug=config.DEBUG)
    if config.is_local_mode():
        await database.init_db()
    yield
    await database.dispose_db()
    log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="GammaLedger API",
        version="0.1.0",
        lifespan=lifespan,
    )

    if config.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=config.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.add_middleware(TenantMiddleware)

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return envelope(
            {
                "status": "ok",
                "env": config.APP_ENV,
                "version": "0.1.0",
            }
        )

    app.include_router(analytics_router, prefix="/api/v1")
    app.include_router(ai_router, prefix="/api/v1")
    app.include_router(monetization_router, prefix="/api/v1")
    app.include_router(pnl_router, prefix="/api/v1")
    app.include_router(positions_router, prefix="/api/v1")
    app.include_router(strategies_router, prefix="/api/v1")
    app.include_router(tenant_router, prefix="/api/v1")
    app.include_router(trades_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(migration_router, prefix="/api/v1")

    return app


app = create_app()
