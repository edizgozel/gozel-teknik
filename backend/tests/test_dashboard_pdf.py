import tempfile, os
os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mkdtemp(prefix="gt_pdf_") + "/t.db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def seed():
    customer = client.post("/api/customers", json={"name": "PDF Müşterisi", "phone": "0555 444 33 22"}).json()
    device = client.post("/api/devices", json={"customer_id": customer["id"], "type": "telefon", "brand": "Nokia", "model": "G21"}).json()
    service = client.post("/api/services", json={"customer_id": customer["id"], "device_id": device["id"], "reported_issue": "Kamera açılmıyor", "physical_condition": "Çiziksiz", "accessories": "Kılıf"}).json()
    client.put(f"/api/services/{service['id']}/charges", json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 15000}]})
    client.post(f"/api/services/{service['id']}/payments", json={"amount_kurus": 5000, "method": "cash"})
    return service


class TestDashboard:
    def test_dashboard_real_numbers(self):
        service = seed()
        data = client.get("/api/dashboard").json()
        assert data["active_services"] >= 1
        assert data["by_status"]["intake"] >= 1
        assert data["collected_kurus"] >= 5000
        assert data["unpaid_services"] >= 1
        assert data["total_receivable_kurus"] >= 10000
        assert any(s["service_no"] == service["service_no"] for s in data["recent_services"])

    def test_cancelled_not_counted_active(self):
        service = seed()
        client.post(f"/api/services/{service['id']}/status", json={"new_status": "cancelled"})
        data = client.get("/api/dashboard").json()
        assert data["by_status"]["cancelled"] >= 1


class TestAuditLog:
    def test_actions_logged(self):
        service = seed()
        client.put(f"/api/services/{service['id']}/charges", json={"lines": [{"charge_type": "labor", "description": "İ", "quantity": 1, "unit_price_kurus": 1}]})
        logs = client.get("/api/audit").json()["rows"]
        actions = {l["action"] for l in logs}
        assert {"customer.create", "device.create", "service.create", "service.charges", "payment.create"} <= actions

    def test_audit_search_and_filter(self):
        seed()
        filtered = client.get("/api/audit", params={"action": "payment.create"}).json()
        assert all(l["action"] == "payment.create" for l in filtered["rows"])
        searched = client.get("/api/audit", params={"q": "tahsilat"}).json()
        assert len(searched["rows"]) >= 1


class TestPdfDocuments:
    def test_intake_pdf_download(self):
        service = seed()
        resp = client.get(f"/api/services/{service['id']}/documents/kabul.pdf")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert f"{service['service_no']}-servis-kabul.pdf" in resp.headers["content-disposition"]

    def test_delivery_pdf_download_with_draft_note(self):
        service = seed()
        resp = client.get(f"/api/services/{service['id']}/documents/teslim.pdf")
        assert resp.status_code == 200
        assert resp.content[:5] == b"%PDF-"
        assert "taslaktır" not in resp.text  # ikili içerik; metin kontrolü PDF içi değil
        assert f"{service['service_no']}-servis-teslim.pdf" in resp.headers["content-disposition"]

    def test_pdf_does_not_change_state(self):
        service = seed()
        before_status = client.get(f"/api/services/{service['id']}").json()["status"]
        finance_before = client.get(f"/api/services/{service['id']}/finance").json()["grand_total"]
        client.get(f"/api/services/{service['id']}/documents/kabul.pdf")
        client.get(f"/api/services/{service['id']}/documents/teslim.pdf")
        after = client.get(f"/api/services/{service['id']}/finance").json()
        assert client.get(f"/api/services/{service['id']}").json()["status"] == before_status
        assert after["grand_total"] == finance_before

    def test_unknown_kind_404(self):
        service = seed()
        assert client.get(f"/api/services/{service['id']}/documents/other.pdf").status_code == 404


class TestReportPdfs:
    def test_report_pdfs_download(self):
        seed()
        for kind in ["services", "stock", "payments"]:
            resp = client.get(f"/api/reports/{kind}/pdf", params={"date_from": "2020-01-01"})
            assert resp.status_code == 200, kind
            assert resp.content[:5] == b"%PDF-", kind
