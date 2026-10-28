import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import customers, dashboard, devices, finance, health, parts, reports, services
from app.api.routes import settings as settings_routes
from app.core.config import settings
from app.core.logging import setup_logging
from app.database import Base, engine, migrate_schema
import app.models  # noqa: F401  (tabloların metadata'ya kaydolması için)

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.frontend_dist_dir.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    migrate_schema()
    logger.info("%s v%s başlatıldı", settings.app_name, settings.app_version)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("İşlenmeyen hata: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Sunucu hatası"})

    app.include_router(health.router, prefix="/api")
    app.include_router(customers.router, prefix="/api")
    app.include_router(devices.router, prefix="/api")
    app.include_router(services.router, prefix="/api")
    app.include_router(parts.router, prefix="/api")
    app.include_router(finance.router, prefix="/api")
    app.include_router(finance.payments_router, prefix="/api")
    app.include_router(reports.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(dashboard.audit_router, prefix="/api")
    app.include_router(settings_routes.router, prefix="/api")

    dist = settings.frontend_dist_dir
    if dist.is_dir():
        assets = dist / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            if full_path == "api" or full_path.startswith("api/"):
                return JSONResponse(status_code=404, content={"detail": "Bulunamadı"})
            candidate = (dist / full_path).resolve()
            if full_path and candidate.is_file() and dist.resolve() in candidate.parents:
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()
