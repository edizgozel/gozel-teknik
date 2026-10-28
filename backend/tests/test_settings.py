import tempfile, os
os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mkdtemp(prefix="gt_set_") + "/t.db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestSettings:
    def test_update_and_read(self):
        resp = client.put("/api/settings", json={"business_name": "Gozel Teknik Servis", "business_phone": "0850 000 00 00"})
        assert resp.status_code == 200
        assert resp.json()["business_name"] == "Gozel Teknik Servis"
        again = client.get("/api/settings").json()
        assert again["business_phone"] == "0850 000 00 00"
        assert again["currency"] == "TRY"

    def test_unknown_key_rejected(self):
        assert client.put("/api/settings", json={"hacker_key": "x"}).status_code == 422

    def test_settings_audit_logged(self):
        logs = client.get("/api/audit", params={"action": "settings.update"}).json()["rows"]
        assert len(logs) >= 1


class TestBackupRestore:
    def test_create_backup_and_list(self):
        resp = client.post("/api/settings/backup")
        assert resp.status_code == 200
        name = resp.json()["filename"]
        assert name.endswith(".db")
        listing = client.get("/api/settings/backups").json()
        assert any(b["filename"] == name for b in listing)
        download = client.get(f"/api/settings/backups/{name}/download")
        assert download.status_code == 200
        assert download.content[:16] == b"SQLite format 3\x00"
        logs = client.get("/api/audit", params={"action": "backup.create"}).json()["rows"]
        assert len(logs) >= 1

    def test_restore_valid_backup(self):
        put_resp = client.put("/api/settings", json={"business_name": "Gozel Teknik Servis"})
        backup_resp = client.post("/api/settings/backup")
        print("PUT STATUS:", put_resp.status_code, "| BACKUP STATUS:", backup_resp.status_code, "| BACKUP BODY:", backup_resp.text[:120])
        backup = backup_resp.json()["filename"]
        client.put("/api/settings", json={"business_name": "Değişti"})
        path = client.get("/api/settings/backups").json()
        target = [b for b in path if b["filename"] == backup][0]
        content = client.get(f"/api/settings/backups/{backup}/download").content
        restore = client.post(
            "/api/settings/restore",
            files={"file": (backup, content, "application/octet-stream")},
        )
        assert restore.status_code == 200, restore.text
        import sqlite3
        from app.core.config import settings as app_settings
        conn = sqlite3.connect(app_settings.database_url.replace("sqlite:///", ""))
        print("RESTORE SONRASI app_settings:", conn.execute("SELECT key, value FROM app_settings").fetchall())
        print("RESTORE SONRASI tablolar:", len(conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()))
        value = conn.execute("SELECT value FROM app_settings WHERE key='business_name'").fetchone()
        conn.close()
        assert value and value[0] == "Gozel Teknik Servis"
        assert client.get("/api/settings").json()["business_name"] == "Gozel Teknik Servis"
        filenames = [b["filename"] for b in client.get("/api/settings/backups").json()]
        assert target["filename"] in filenames
        logs = client.get("/api/audit", params={"action": "restore"}).json()["rows"]
        assert len(logs) >= 1

    def test_restore_rejects_corrupt_file(self):
        restore = client.post(
            "/api/settings/restore",
            files={"file": ("bad.db", b"bu bir sqlite dosyasi degil", "application/octet-stream")},
        )
        assert restore.status_code == 400
        assert "geçerli" in restore.json()["detail"].lower() or "uyumsuz" in restore.json()["detail"].lower()

    def test_restore_rejects_incompatible_db(self):
        import sqlite3, tempfile
        tmp = tempfile.mktemp(suffix=".db")
        conn = sqlite3.connect(tmp)
        conn.execute("CREATE TABLE farkli_tablo (id INTEGER)")
        conn.commit(); conn.close()
        content = open(tmp, "rb").read()
        restore = client.post(
            "/api/settings/restore",
            files={"file": ("incompatible.db", content, "application/octet-stream")},
        )
        assert restore.status_code == 400
        assert "eksik tablolar" in restore.json()["detail"]

    def test_path_traversal_blocked(self):
        assert client.get("/api/settings/backups/..%2F..%2Fsecret.db/download").status_code in (400, 404)


class TestOccurredAt:
    def test_payment_with_custom_date(self):
        customer = client.post("/api/customers", json={"name": "Tarih Müşterisi", "phone": "0511 111 22 33"}).json()
        device = client.post("/api/devices", json={"customer_id": customer["id"], "type": "diger", "brand": "X", "model": "Y"}).json()
        service = client.post("/api/services", json={"customer_id": customer["id"], "device_id": device["id"], "reported_issue": "t"}).json()
        client.put(f"/api/services/{service['id']}/charges", json={"lines": [{"charge_type": "labor", "description": "İ", "quantity": 1, "unit_price_kurus": 10000}]})
        resp = client.post(
            f"/api/services/{service['id']}/payments",
            json={"amount_kurus": 5000, "method": "cash", "occurred_at": "2026-10-01T10:30:00"},
        )
        assert resp.status_code in (200, 201)
        row = resp.json()["payments"][0]
        assert row["created_at"].startswith("2026-10-01")

    def test_stock_movement_with_custom_date(self):
        part = client.post("/api/parts", json={"name": "Tarih Parçası", "category": "diger", "initial_quantity": 1}).json()
        resp = client.post(
            f"/api/parts/{part['id']}/movements",
            json={"movement_type": "purchase", "quantity": 2, "occurred_at": "2026-09-15T08:00:00"},
        )
        assert resp.status_code == 200
        movements = client.get(f"/api/parts/{part['id']}/movements").json()
        assert movements[0]["created_at"].startswith("2026-09-15")
