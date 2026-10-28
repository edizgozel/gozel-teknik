from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def create_customer(**overrides):
    payload = {"name": "Ahmet Yılmaz", "phone": "0532 111 22 33"}
    payload.update(overrides)
    return client.post("/api/customers", json=payload)


def create_device(**overrides):
    payload = {
        "type": "telefon",
        "brand": "Samsung",
        "model": "Galaxy S21",
        "serial_no": None,
    }
    payload.update(overrides)
    return client.post("/api/devices", json=payload)


class TestCustomers:
    def test_create_and_get_customer(self):
        response = create_customer()
        assert response.status_code == 201
        data = response.json()
        assert data["customer_no"].startswith("M-")
        assert data["is_active"] is True
        detail = client.get(f"/api/customers/{data['id']}")
        assert detail.status_code == 200
        assert detail.json()["name"] == "Ahmet Yılmaz"

    def test_customer_number_generated_by_backend_and_unique(self):
        first = create_customer(name="Müşteri Bir", phone="05320000001").json()
        second = create_customer(name="Müşteri İki", phone="05320000002").json()
        assert first["customer_no"] != second["customer_no"]

    def test_list_and_search_customers(self):
        create_customer(name="Zeynep Kaya", phone="0533 987 65 43")
        listing = client.get("/api/customers").json()
        assert any(c["name"] == "Zeynep Kaya" for c in listing)
        by_name = client.get("/api/customers", params={"q": "Zeynep"}).json()
        assert len(by_name) >= 1 and all("Zeynep" in c["name"] for c in by_name)
        by_phone = client.get("/api/customers", params={"q": "987"}).json()
        assert any("Zeynep" in c["name"] for c in by_phone)

    def test_update_customer_and_set_passive(self):
        created = create_customer(name="Pasif Olacak", phone="0530 000 00 01").json()
        response = client.put(
            f"/api/customers/{created['id']}",
            json={"name": "Pasif Olacak", "phone": "0530 000 00 01", "is_active": False},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False
        passive = client.get(
            "/api/customers", params={"status": "passive"}
        ).json()
        assert any(c["id"] == created["id"] for c in passive)

    def test_invalid_customer_data_rejected(self):
        assert create_customer(name="", phone="0532").status_code == 422
        assert create_customer(name="X", phone="123").status_code == 422
        bad_email = create_customer(email="not-an-email")
        assert bad_email.status_code == 422

    def test_missing_customer_returns_404(self):
        assert client.get("/api/customers/999999").status_code == 404


class TestDevices:
    def test_create_and_get_device(self):
        customer = create_customer(name="Cihaz Sahibi", phone="0544 111 22 33").json()
        response = create_device(customer_id=customer["id"], serial_no="SN-TEST-1")
        assert response.status_code == 201
        data = response.json()
        assert data["device_no"].startswith("C-")
        assert data["customer_name"] == "Cihaz Sahibi"

    def test_multiple_devices_per_customer(self):
        customer = create_customer(name="Çok Cihazlı", phone="0544 222 33 44").json()
        create_device(customer_id=customer["id"], brand="Lenovo", model="IdeaPad")
        create_device(customer_id=customer["id"], brand="Apple", model="iPhone 13")
        devices = client.get(
            "/api/devices", params={"customer_id": customer["id"]}
        ).json()
        assert len(devices) == 2

    def test_device_search_and_filters(self):
        customer = create_customer(name="Aranan Kişi", phone="0544 333 55 66").json()
        create_device(
            customer_id=customer["id"],
            type="dizustu",
            brand="Asus",
            model="ZenBook",
            serial_no="SN-ASUS-9",
        )
        by_brand = client.get("/api/devices", params={"q": "Asus"}).json()
        assert any(d["brand"] == "Asus" for d in by_brand)
        by_serial = client.get("/api/devices", params={"q": "SN-ASUS"}).json()
        assert len(by_serial) >= 1
        by_customer_name = client.get("/api/devices", params={"q": "Aranan"}).json()
        assert any(d["brand"] == "Asus" for d in by_customer_name)
        by_type = client.get("/api/devices", params={"type": "dizustu"}).json()
        assert all(d["type"] == "dizustu" for d in by_type)

    def test_duplicate_active_serial_rejected(self):
        customer = create_customer(name="Seri Test", phone="0544 444 55 66").json()
        first = create_device(customer_id=customer["id"], serial_no="SN-DUP-1")
        assert first.status_code == 201
        duplicate = create_device(customer_id=customer["id"], serial_no="SN-DUP-1")
        assert duplicate.status_code == 409

    def test_invalid_device_and_customer_relation(self):
        assert create_device(type="ufo", brand="X", model="Y").status_code == 422
        assert create_device(customer_id=999999).status_code == 404

    def test_update_device_set_passive(self):
        customer = create_customer(name="Güncellenecek", phone="0544 555 66 77").json()
        device = create_device(customer_id=customer["id"], serial_no="SN-UPD-1").json()
        response = client.put(
            f"/api/devices/{device['id']}",
            json={
                "customer_id": customer["id"],
                "type": "telefon",
                "brand": "Xiaomi",
                "model": "Redmi Note",
                "serial_no": "SN-UPD-1",
                "is_active": False,
            },
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False
