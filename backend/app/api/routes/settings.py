import os
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_action
from app.core.config import BASE_DIR, settings
from app.database import engine, get_db
from app.models import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])

BACKUP_DIR = Path(BASE_DIR) / "data" / "backups"


def live_db_path() -> Path:
    url = settings.database_url
    if not url.startswith("sqlite:///"):
        raise HTTPException(status_code=400, detail="Yedekleme yalnızca SQLite ile desteklenir")
    return Path(url.replace("sqlite:///", "", 1))
ALLOWED_KEYS = {
    "business_name",
    "business_phone",
    "business_email",
    "business_address",
    "business_website",
    "document_footer",
    "currency",
}
REQUIRED_TABLES = {"customers", "devices", "service_records", "parts", "payments"}

_restore_lock = threading.Lock()


def get_settings_dict(db: Session) -> dict[str, str]:
    rows = db.scalars(select(AppSetting)).all()
    return {r.key: r.value for r in rows}


@router.get("")
def read_settings(db: Session = Depends(get_db)):
    values = get_settings_dict(db)
    values.setdefault("currency", "TRY")
    return values


@router.put("")
def update_settings(payload: dict[str, str], db: Session = Depends(get_db)):
    unknown = set(payload) - ALLOWED_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Bilinmeyen ayar alanları: {', '.join(sorted(unknown))}")
    changed = []
    for key, value in payload.items():
        value = (value or "").strip()
        existing = db.get(AppSetting, key)
        if existing is None:
            if value:
                db.add(AppSetting(key=key, value=value))
                changed.append(key)
        elif existing.value != value:
            existing.value = value
            changed.append(key)
    if changed:
        log_action(db, "settings.update", "settings", None, f"Ayarlar güncellendi: {', '.join(sorted(changed))}")
    db.commit()
    return read_settings(db)


def _backup_path(name: str) -> Path:
    safe = Path(name).name
    if not safe.endswith(".db") or "/" in safe or "\\" in safe or ".." in safe:
        raise HTTPException(status_code=400, detail="Geçersiz yedek dosya adı")
    return BACKUP_DIR / safe


def _create_backup_file(label: str) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    import uuid

    name = f"gozel_teknik_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.db"
    target = BACKUP_DIR / name
    src = sqlite3.connect(str(live_db_path()))
    try:
        dst = sqlite3.connect(str(target))
        try:
            src.backup(dst)
            check = dst.execute("PRAGMA integrity_check").fetchone()[0]
            if check != "ok":
                raise RuntimeError(f"Yedek bütünlük kontrolü başarısız: {check}")
        finally:
            dst.close()
    finally:
        src.close()
    if not target.is_file() or target.stat().st_size == 0:
        raise RuntimeError("Yedek dosyası oluşturulamadı")
    return target


@router.post("/backup")
def create_backup(db: Session = Depends(get_db)):
    try:
        target = _create_backup_file("manual")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yedekleme başarısız: {e}")
    log_action(db, "backup.create", "backup", None, f"Veritabanı yedeği oluşturuldu: {target.name}")
    db.commit()
    return {"filename": target.name, "size": target.stat().st_size}


@router.get("/backups")
def list_backups():
    if not BACKUP_DIR.is_dir():
        return []
    return sorted(
        (
            {
                "filename": f.name,
                "size": f.stat().st_size,
                "created_at": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d.%m.%Y %H:%M:%S"),
            }
            for f in BACKUP_DIR.glob("*.db")
        ),
        key=lambda b: b["filename"],
        reverse=True,
    )


@router.get("/backups/{name}/download")
def download_backup(name: str, db: Session = Depends(get_db)):
    path = _backup_path(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    log_action(db, "backup.download", "backup", None, f"Yedek indirildi: {name}")
    db.commit()
    return FileResponse(path, media_type="application/octet-stream", filename=name)


def _validate_sqlite_file(path: Path) -> None:
    if path.stat().st_size == 0:
        raise HTTPException(status_code=400, detail="Dosya boş")
    try:
        conn = sqlite3.connect(str(path))
        try:
            if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise HTTPException(status_code=400, detail="Veritabanı bütünlük kontrolünü geçemedi")
            tables = {
                r[0]
                for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            }
            missing = REQUIRED_TABLES - tables
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Uyumsuz yedek: eksik tablolar ({', '.join(sorted(missing))})",
                )
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Dosya geçerli bir SQLite veritabanı değil")


@router.post("/restore")
def restore_backup(file: UploadFile, db: Session = Depends(get_db)):
    if not _restore_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Başka bir geri yükleme işlemi sürüyor")
    try:
        import tempfile

        tmp = Path(tempfile.mkdtemp(prefix="gt_restore_")) / "upload.db"
        with tmp.open("wb") as out:
            out.write(file.file.read())
        _validate_sqlite_file(tmp)

        live_db = live_db_path()
        safety = _create_backup_file("pre_restore")

        engine.dispose()
        os.replace(tmp, live_db)
        _restore_lock.release()

        conn = sqlite3.connect(str(live_db))
        try:
            conn.execute(
                "INSERT INTO audit_logs (action, entity_type, entity_id, description, source) "
                "VALUES ('restore', 'database', NULL, ?, 'app')",
                (f"Veritabanı geri yüklendi; güvenlik yedeği: {safety.name}",),
            )
            conn.commit()
        finally:
            conn.close()
        return {
            "status": "ok",
            "safety_backup": safety.name,
            "message": "Geri yükleme tamamlandı. Sayfayı yenileyerek devam edin.",
        }
    except HTTPException:
        if _restore_lock.locked():
            _restore_lock.release()
        raise
    except Exception as e:
        if _restore_lock.locked():
            _restore_lock.release()
        raise HTTPException(status_code=500, detail=f"Geri yükleme başarısız, mevcut veritabanı korundu: {e}")
