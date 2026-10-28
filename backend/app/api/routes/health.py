from fastapi import APIRouter

from app.core.config import settings
from app.database import check_database

router = APIRouter(tags=["system"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "database": "connected" if check_database() else "unavailable",
    }
