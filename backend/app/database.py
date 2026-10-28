from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Gelecekteki tüm modellerin (müşteri, cihaz, servis kaydı, stok, ödeme) ortak tabanı."""


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


# Mevcut tablolara sonradan eklenen kolonlar; create_all yeni tabloları
# oluşturur ama var olanlara dokunmadığı için eksik kolonlar burada eklenir.
REQUIRED_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "parts": [("sale_price_kurus", "INTEGER")],
    "part_usages": [
        ("reversed_by_movement_id", "INTEGER"),
        ("sale_price_kurus", "INTEGER"),
    ],
    "stock_movements": [("original_movement_id", "INTEGER")],
    "payments": [("recorded_at", "DATETIME")],
}


def migrate_schema() -> None:
    with engine.begin() as conn:
        for table, columns in REQUIRED_COLUMNS.items():
            existing = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            }
            if not existing:
                continue
            for column, column_type in columns:
                if column not in existing:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
                    )
