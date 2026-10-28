from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def create_part(**overrides):
    payload = {
        "name": "Ekran LCD 14\"",
        "category": "ekran",
        "compatible_brand": "Generic",
        "min_quantity": 2,
        "unit_cost": 450.0,
        "initial_quantity": 0,
    }
    payload.update(overrides)
    return client.post("/api/parts", json=payload)


def setup_service():
    customer = client.post(
        "/api/customers", json={"name": "Stok Müşterisi", "phone": "0588 111 22 33"}
    ).json()
    device = client.post(
        "/api/devices",
        json={"customer_id": customer["id"], "type": "dizustu", "brand": "Dell", "model": "Inspiron"},
    ).json()
    service = client.post(
        "/api/services",
        json={"customer_id": customer["id"], "device_id": device["id"], "reported_issue": "Ekran kırık"},
    ).json()
    return service


class TestParts:
    def test_create_list_update(self):
        response = create_part(initial_quantity=10)
        assert response.status_code == 201
        data = response.json()
        assert data["part_code"].startswith("P-")
        assert data["quantity"] == 10
        assert data["stock_level"] == "ok"
        listing = client.get("/api/parts").json()
        assert any(p["part_code"] == data["part_code"] for p in listing)
        updated = client.put(
            f"/api/parts/{data['id']}",
            json={
                "name": "Ekran LCD 14 FHD",
                "category": "ekran",
                "min_quantity": 3,
                "unit": "adet",
                "is_active": True,
            },
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Ekran LCD 14 FHD"
        assert updated.json()["min_quantity"] == 3

    def test_part_code_unique_backend_generated(self):
        first = create_part(name="Parça A").json()
        second = create_part(name="Parça B").json()
        assert first["part_code"] != second["part_code"]

    def test_invalid_part_rejected(self):
        assert create_part(name="").status_code == 422
        assert create_part(category="ufo").status_code == 422
        assert create_part(initial_quantity=-1).status_code == 422

    def test_search_and_filters(self):
        create_part(name="Klavye Türkçe Dell", category="klavye", initial_quantity=1, min_quantity=2)
        by_code = client.get("/api/parts", params={"q": "P-"}).json()
        assert len(by_code) >= 1
        by_name = client.get("/api/parts", params={"q": "Klavye"}).json()
        assert any("Klavye" in p["name"] for p in by_name)
        by_cat = client.get("/api/parts", params={"category": "klavye"}).json()
        assert all(p["category"] == "klavye" for p in by_cat)
        low = client.get("/api/parts", params={"stock": "low"}).json()
        assert all(0 < p["quantity"] <= p["min_quantity"] for p in low)

    def test_stock_movements_and_history(self):
        part = create_part(initial_quantity=5).json()
        pid = part["id"]
        client.post(f"/api/parts/{pid}/movements", json={"movement_type": "purchase", "quantity": 10, "note": "Tedarik"})
        response = client.post(f"/api/parts/{pid}/movements", json={"movement_type": "decrease", "quantity": 3})
        assert response.status_code == 200
        assert response.json()["quantity"] == 12
        movements = client.get(f"/api/parts/{pid}/movements").json()
        types = [m["movement_type"] for m in movements]
        assert types[0] == "decrease"
        assert movements[0]["stock_before"] == 15 and movements[0]["stock_after"] == 12
        initial = [m for m in movements if m["movement_type"] == "initial"][0]
        assert initial["stock_before"] == 0 and initial["stock_after"] == 5

    def test_negative_stock_blocked(self):
        part = create_part(initial_quantity=2).json()
        response = client.post(
            f"/api/parts/{part['id']}/movements", json={"movement_type": "decrease", "quantity": 5}
        )
        assert response.status_code == 400
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 2

    def test_zero_and_invalid_movements(self):
        part = create_part(initial_quantity=1).json()
        assert (
            client.post(f"/api/parts/{part['id']}/movements", json={"movement_type": "increase", "quantity": 0}).status_code
            == 422
        )
        assert (
            client.post(f"/api/parts/{part['id']}/movements", json={"movement_type": "increase", "quantity": -3}).status_code
            == 422
        )

    def test_passive_part_filter_and_movement_block(self):
        part = create_part(initial_quantity=4).json()
        client.put(
            f"/api/parts/{part['id']}",
            json={"name": part["name"], "category": part["category"], "is_active": False},
        )
        passive = client.get("/api/parts", params={"status": "passive"}).json()
        assert any(p["id"] == part["id"] for p in passive)
        assert (
            client.post(f"/api/parts/{part['id']}/movements", json={"movement_type": "increase", "quantity": 1}).status_code
            == 400
        )


class TestServicePartUsage:
    def test_usage_deducts_stock_and_links_movement(self):
        part = create_part(name="Batarya", category="batarya", initial_quantity=10).json()
        service = setup_service()
        response = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 3}
        )
        assert response.status_code == 201, response.text
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 7
        usage = [u for u in response.json()["parts"] if u["part_id"] == part["id"]][0]
        movements = client.get(f"/api/parts/{part['id']}/movements").json()
        service_movement = [m for m in movements if m["service_id"] == service["id"]][0]
        assert service_movement["id"] == usage["movement_id"]
        assert service_movement["movement_type"] == "service_use"
        assert service_movement["stock_before"] == 10 and service_movement["stock_after"] == 7

    def test_insufficient_stock_rejected_no_partial_state(self):
        part = create_part(name="Fan", category="fan_sogutma", initial_quantity=2).json()
        service = setup_service()
        response = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 5}
        )
        assert response.status_code == 400
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 2
        movements = client.get(f"/api/parts/{part['id']}/movements").json()
        assert all(m["movement_type"] != "service_use" for m in movements)

    def test_duplicate_usage_blocked_immediately(self):
        part = create_part(name="Vida", category="vida_seti", initial_quantity=50).json()
        service = setup_service()
        first = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 1}
        )
        assert first.status_code == 201
        second = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 1}
        )
        assert second.status_code == 409
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 49

    def test_usage_cancel_creates_reversal_keeps_history(self):
        part = create_part(name="Sarj girisi", category="sarj_girisi", initial_quantity=6).json()
        service = setup_service()
        used = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 2}
        ).json()
        usage = used["parts"][0]
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 4
        cancelled = client.delete(f"/api/services/{service['id']}/parts/{usage['id']}")
        assert cancelled.status_code == 200, cancelled.text
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 6
        movements = client.get(f"/api/parts/{part['id']}/movements").json()
        types = [m["movement_type"] for m in movements]
        assert "service_use" in types and "usage_reversal" in types
        reversal = [m for m in movements if m["movement_type"] == "usage_reversal"][0]
        assert reversal["original_movement_id"] == usage["movement_id"]
        detail = client.get(f"/api/services/{service['id']}").json()
        assert detail["parts"][0]["reversed"] is True

    def test_usage_blocked_in_final_statuses(self):
        part = create_part(name="Anakart", category="anakart", initial_quantity=3).json()
        service = setup_service()
        for status in ["diagnosis", "repairing", "ready", "delivered"]:
            client.post(f"/api/services/{service['id']}/status", json={"new_status": status})
        response = client.post(
            f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 1}
        )
        assert response.status_code == 400
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 3

    def test_unknown_part_or_service(self):
        service = setup_service()
        assert (
            client.post(f"/api/services/{service['id']}/parts", json={"part_id": 999999, "quantity": 1}).status_code
            == 404
        )
        assert client.get("/api/parts/999999").status_code == 404
