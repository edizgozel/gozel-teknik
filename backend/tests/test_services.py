from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_customer_device():
    customer = client.post(
        "/api/customers", json={"name": "Servis Müşterisi", "phone": "0555 111 22 33"}
    ).json()
    device = client.post(
        "/api/devices",
        json={"customer_id": customer["id"], "type": "telefon", "brand": "Sony", "model": "Xperia"},
    ).json()
    return customer, device


def create_service(**overrides):
    payload = {
        "reported_issue": "Açılmıyor",
        "physical_condition": "Ekranda çizik",
        "accessories": "Şarj aleti",
    }
    payload.update(overrides)
    return client.post("/api/services", json=payload)


class TestServiceCreation:
    def test_create_service_with_correct_relations(self):
        customer, device = make_customer_device()
        response = create_service(customer_id=customer["id"], device_id=device["id"])
        assert response.status_code == 201
        data = response.json()
        assert data["service_no"].startswith("GT-")
        assert data["customer_name"] == "Servis Müşterisi"
        assert data["device_label"] == "Sony Xperia"
        assert data["status"] == "intake"
        history = data["history"]
        assert history[0]["previous_status"] is None and history[0]["new_status"] == "intake"

    def test_service_numbers_unique(self):
        customer, device = make_customer_device()
        first = create_service(customer_id=customer["id"], device_id=device["id"]).json()
        second = create_service(customer_id=customer["id"], device_id=device["id"]).json()
        assert first["service_no"] != second["service_no"]

    def test_device_of_other_customer_rejected(self):
        customer, device = make_customer_device()
        other = client.post(
            "/api/customers", json={"name": "Başka Müşteri", "phone": "0555 999 88 77"}
        ).json()
        response = create_service(customer_id=other["id"], device_id=device["id"])
        assert response.status_code == 400

    def test_invalid_payload_rejected(self):
        customer, device = make_customer_device()
        assert (
            create_service(customer_id=customer["id"], device_id=device["id"], reported_issue="").status_code
            == 422
        )
        assert create_service(customer_id=999999, device_id=device["id"]).status_code == 404


class TestServiceListAndStatus:
    def test_list_and_search(self):
        customer, device = make_customer_device()
        created = create_service(customer_id=customer["id"], device_id=device["id"]).json()
        listing = client.get("/api/services").json()
        assert any(s["service_no"] == created["service_no"] for s in listing)
        by_no = client.get("/api/services", params={"q": created["service_no"]}).json()
        assert len(by_no) == 1
        by_customer = client.get("/api/services", params={"q": "Servis Müşterisi"}).json()
        assert any(s["service_no"] == created["service_no"] for s in by_customer)
        by_brand = client.get("/api/services", params={"q": "Sony"}).json()
        assert any(s["service_no"] == created["service_no"] for s in by_brand)
        by_phone = client.get("/api/services", params={"q": "0555 111"}).json()
        assert any(s["service_no"] == created["service_no"] for s in by_phone)

    def test_status_filter_and_date_range(self):
        customer, device = make_customer_device()
        create_service(customer_id=customer["id"], device_id=device["id"])
        intake = client.get("/api/services", params={"status": "intake"}).json()
        assert all(s["status"] == "intake" for s in intake)
        empty_past = client.get(
            "/api/services", params={"date_from": "2020-01-01", "date_to": "2020-01-02"}
        ).json()
        assert empty_past == []

    def test_status_transitions_and_history(self):
        customer, device = make_customer_device()
        service = create_service(customer_id=customer["id"], device_id=device["id"]).json()
        sid = service["id"]
        ok = client.post(
            f"/api/services/{sid}/status", json={"new_status": "diagnosis", "note": "Kontrol ediliyor"}
        )
        assert ok.status_code == 200
        assert ok.json()["status"] == "diagnosis"
        invalid = client.post(f"/api/services/{sid}/status", json={"new_status": "closed"})
        assert invalid.status_code == 400
        detail = client.get(f"/api/services/{sid}").json()
        assert [h["new_status"] for h in detail["history"]] == ["intake", "diagnosis"]
        assert detail["history"][1]["note"] == "Kontrol ediliyor"
        assert detail["history"][1]["previous_status"] == "intake"

    def test_delivered_then_close_only(self):
        customer, device = make_customer_device()
        sid = create_service(customer_id=customer["id"], device_id=device["id"]).json()["id"]
        for status in ["diagnosis", "repairing", "ready", "delivered"]:
            assert (
                client.post(f"/api/services/{sid}/status", json={"new_status": status}).status_code == 200
            )
        assert (
            client.post(f"/api/services/{sid}/status", json={"new_status": "repairing"}).status_code
            == 400
        )
        assert (
            client.post(f"/api/services/{sid}/status", json={"new_status": "closed"}).status_code == 200
        )
        assert (
            client.post(f"/api/services/{sid}/status", json={"new_status": "intake"}).status_code == 400
        )

    def test_cancelled_service_is_kept(self):
        customer, device = make_customer_device()
        sid = create_service(customer_id=customer["id"], device_id=device["id"]).json()["id"]
        assert (
            client.post(f"/api/services/{sid}/status", json={"new_status": "cancelled"}).status_code == 200
        )
        detail = client.get(f"/api/services/{sid}")
        assert detail.status_code == 200
        assert detail.json()["status"] == "cancelled"

    def test_unknown_service_404(self):
        assert client.get("/api/services/999999").status_code == 404
