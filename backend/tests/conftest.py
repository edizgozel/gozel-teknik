import os
import tempfile

# Testler gerçek veritabanına dokunmasın; uygulama import edilmeden önce
# geçici bir SQLite dosyasına yönlendir.
_tmpdir = tempfile.mkdtemp(prefix="gozel_teknik_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"

from app.database import Base, engine, migrate_schema  # noqa: E402
import app.models  # noqa: E402,F401

Base.metadata.create_all(bind=engine)
migrate_schema()
