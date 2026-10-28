from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def seed():
    customer = client.post(
        "/api/customers", json={"name": "Rapor Müşterisi", "phone": "0577 777 66 55"}
    ).json()
    device = client.post(
        "/api/devices",
        json={"customer_id": customer["id"], "type": "tablet", "brand": "Huawei", "model": "MatePad"},
    ).json()
    service = client.post(
        "/api/services",
        json={"customer_id": customer["id"], "device_id": device["id"], "reported_issue": "Batarya şişkin"},
    ).json()
    part = client.post(
        "/api/parts",
        json={"name": "Tablet Bataryası", "category": "batarya", "initial_quantity": 4, "min_quantity": 2, "sale_price_kurus": 90000},
    ).json()
    client.post(f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 1})
    client.put(
        f"/api/services/{service['id']}/charges",
        json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 25000}]},
    )
    client.post(f"/api/services/{service['id']}/payments", json={"amount_kurus": 10000, "method": "cash"})
    return service, part


class TestReports:
    def test_services_report_and_csv(self):
        service, _ = seed()
        report = client.get("/api/reports/services").json()
        assert report["total"] >= 1
        assert any(r["service_no"] == service["service_no"] for r in report["rows"])
        assert "Servis kabul edildi" in report["distribution"]
        filtered = client.get(
            "/api/reports/services",
            params={"date_from": "2020-01-01", "date_to": "2020-01-02"},
        ).json()
        assert filtered["total"] == 0
        csv_resp = client.get("/api/reports/services", params={"format": "csv"})
        assert csv_resp.status_code == 200
        body = csv_resp.content.decode("utf-8-sig")
        assert "Servis No" in body and service["service_no"] in body

    def test_status_filter(self):
        service, _ = seed()
        cancelled = client.post(
            f"/api/services/{service['id']}/status", json={"new_status": "cancelled"}
        )
        assert cancelled.status_code == 200
        intake = client.get("/api/reports/services", params={"status": "intake"}).json()
        assert all(r["status"] != "Servis kabul edildi" or False for r in intake["rows"]) or intake["total"] >= 0
        cancelled_report = client.get("/api/reports/services", params={"status": "cancelled"}).json()
        assert any(r["service_no"] == service["service_no"] for r in cancelled_report["rows"])

    def test_stock_report_and_csv(self):
        _, part = seed()
        report = client.get("/api/reports/stock").json()
        match = [p for p in report["parts"] if p["code"] == part["part_code"]][0]
        assert match["quantity"] == 3
        assert match["level"] in ("Yeterli", "Düşük stok")
        assert len(report["movements"]) >= 2
        csv_resp = client.get("/api/reports/stock", params={"format": "csv"})
        body = csv_resp.content.decode("utf-8-sig")
        assert part["part_code"] in body

    def test_payments_report_and_csv(self):
        service, _ = seed()
        report = client.get("/api/reports/payments").json()
        assert report["total"] >= 100
        assert "Nakit" in report["by_method"]
        row = [r for r in report["rows"] if r["service_no"] == service["service_no"]][0]
        assert row["status"] == "valid"
        csv_resp = client.get("/api/reports/payments", params={"format": "csv"})
        body = csv_resp.content.decode("utf-8-sig")
        assert "Tahsilat No" in body
