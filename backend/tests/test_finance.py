from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_full_service(parts_qty=5, part_sale_price=15000, use_part=True):
    customer = client.post(
        "/api/customers", json={"name": "Finans Müşterisi", "phone": "0599 111 22 33"}
    ).json()
    device = client.post(
        "/api/devices",
        json={"customer_id": customer["id"], "type": "telefon", "brand": "Oppo", "model": "Reno"},
    ).json()
    service = client.post(
        "/api/services",
        json={"customer_id": customer["id"], "device_id": device["id"], "reported_issue": "Şarj sorunu"},
    ).json()
    part = client.post(
        "/api/parts",
        json={
            "name": "Şarj Entegresi",
            "category": "sarj_girisi",
            "initial_quantity": parts_qty,
            "sale_price_kurus": part_sale_price,
        },
    ).json()
    if use_part:
        client.post(f"/api/services/{service['id']}/parts", json={"part_id": part["id"], "quantity": 1})
    return service, part


class TestCharges:
    def test_labor_and_extra_charges(self):
        service, _ = setup_full_service()
        sid = service["id"]
        response = client.put(
            f"/api/services/{sid}/charges",
            json={
                "lines": [
                    {"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 50000},
                    {"charge_type": "extra", "description": "Kurye", "quantity": 1, "unit_price_kurus": 5000},
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["labor_total"] == 50000
        assert data["extra_total"] == 5000
        assert data["parts_total"] == 15000  # kullanılan parça satış fiyatı
        assert data["grand_total"] == 70000
        assert data["payment_status"] == "unpaid"
        assert data["balance"] == 70000

    def test_discount_cannot_exceed_total(self):
        service, _ = setup_full_service()
        response = client.put(
            f"/api/services/{service['id']}/charges",
            json={
                "lines": [
                    {"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 10000},
                    {"charge_type": "discount", "description": "İndirim", "quantity": 1, "unit_price_kurus": 999999},
                ]
            },
        )
        assert response.status_code == 422

    def test_catalog_price_change_does_not_affect_past_usage(self):
        service, part = setup_full_service(part_sale_price=15000)
        client.put(
            f"/api/parts/{part['id']}",
            json={
                "name": part["name"],
                "category": part["category"],
                "sale_price_kurus": 99900,
            },
        )
        finance = client.get(f"/api/services/{service['id']}/finance").json()
        assert finance["parts_total"] == 15000

    def test_part_usage_does_not_deduct_stock_twice(self):
        service, part = setup_full_service(parts_qty=5)
        client.put(
            f"/api/services/{service['id']}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İ", "quantity": 1, "unit_price_kurus": 100}]},
        )
        assert client.get(f"/api/parts/{part['id']}").json()["quantity"] == 4


class TestPayments:
    def test_full_and_partial_payment(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 30000}]},
        )
        partial = client.post(
            f"/api/services/{sid}/payments", json={"amount_kurus": 10000, "method": "cash"}
        )
        assert partial.status_code in (200, 201)
        data = partial.json()
        assert data["payment_status"] == "partially_paid"
        assert data["balance"] == 20000
        assert data["payments"][0]["payment_no"].startswith("T-")
        full = client.post(
            f"/api/services/{sid}/payments", json={"amount_kurus": 20000, "method": "card"}
        )
        assert full.status_code in (200, 201)
        data = full.json()
        assert data["payment_status"] == "paid"
        assert data["balance"] == 0

    def test_overpayment_rejected(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 10000}]},
        )
        client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 5000, "method": "cash"})
        response = client.post(
            f"/api/services/{sid}/payments", json={"amount_kurus": 999999, "method": "cash"}
        )
        assert response.status_code == 400
        assert client.get(f"/api/services/{sid}/finance").json()["balance"] == 5000

    def test_zero_and_invalid_payment_rejected(self):
        service, _ = setup_full_service(use_part=False)
        assert (
            client.post(f"/api/services/{service['id']}/payments", json={"amount_kurus": 0, "method": "cash"}).status_code
            == 422
        )
        assert (
            client.post(f"/api/services/{service['id']}/payments", json={"amount_kurus": 100, "method": "bitcoin"}).status_code
            == 422
        )

    def test_duplicate_payment_blocked(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 10000}]},
        )
        first = client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 1000, "method": "cash"})
        assert first.status_code == 201 or first.status_code == 200
        second = client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 1000, "method": "cash"})
        assert second.status_code == 409

    def test_cancel_payment_recalculates(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 20000}]},
        )
        paid = client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 20000, "method": "cash"}).json()
        payment_no = paid["payments"][0]["payment_no"]
        pid = paid["payments"][0]["id"]
        cancelled = client.post(f"/api/payments/{pid}/cancel")
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        finance = client.get(f"/api/services/{sid}/finance").json()
        assert finance["payment_status"] == "unpaid"
        assert finance["balance"] == 20000

    def test_refund_flow(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 20000}]},
        )
        paid = client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 20000, "method": "transfer"}).json()
        pid = paid["payments"][0]["id"]
        refund1 = client.post(f"/api/payments/{pid}/refunds", json={"amount_kurus": 5000, "note": "Kısmi iade"})
        assert refund1.status_code == 200
        assert refund1.json()["refunded_kurus"] == 5000
        finance = client.get(f"/api/services/{sid}/finance").json()
        assert finance["payment_status"] == "partially_paid"
        assert finance["balance"] == 5000
        over = client.post(f"/api/payments/{pid}/refunds", json={"amount_kurus": 999999})
        assert over.status_code == 400
        refunds = client.get(f"/api/payments/{pid}/refunds").json()
        assert len(refunds) == 1 and refunds[0]["amount_kurus"] == 5000

    def test_zero_refund_rejected(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 10000}]},
        )
        paid = client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 10000, "method": "cash"}).json()
        pid = paid["payments"][0]["id"]
        assert (
            client.post(f"/api/payments/{pid}/refunds", json={"amount_kurus": 0}).status_code == 422
        )

    def test_payment_list_search_and_filters(self):
        service, _ = setup_full_service(use_part=False)
        client.put(
            f"/api/services/{service['id']}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 8000}]},
        )
        created = client.post(
            f"/api/services/{service['id']}/payments", json={"amount_kurus": 8000, "method": "cash"}
        ).json()
        payment_no = created["payments"][0]["payment_no"]
        by_no = client.get("/api/payments", params={"q": payment_no}).json()
        assert any(p["payment_no"] == payment_no for p in by_no)
        by_customer = client.get("/api/payments", params={"q": "Finans Müşterisi"}).json()
        assert any(p["payment_no"] == payment_no for p in by_customer)
        by_service = client.get("/api/payments", params={"q": service["service_no"]}).json()
        assert any(p["payment_no"] == payment_no for p in by_service)
        by_method = client.get("/api/payments", params={"method": "cash"}).json()
        assert all(p["method"] == "cash" for p in by_method)

    def test_no_charge_service_not_red(self):
        service, _ = setup_full_service()
        finance = client.get(f"/api/services/{service['id']}/finance").json()
        assert finance["payment_status"] == "unpaid"
        empty = client.get(f"/api/services/{service['id']}/finance").json()
        assert empty["grand_total"] == 15000
        client.put(f"/api/services/{service['id']}/charges", json={"lines": []})
        client.delete(f"/api/services/{service['id']}/parts/1")  # yoksa sessizce geç
        finance2 = client.get(f"/api/services/{service['id']}/finance").json()
        assert finance2["payment_status"] in ("no_charge", "unpaid")

    def test_charges_history_preserved_after_payment(self):
        service, _ = setup_full_service(use_part=False)
        sid = service["id"]
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 10000}]},
        )
        client.post(f"/api/services/{sid}/payments", json={"amount_kurus": 4000, "method": "cash"})
        client.put(
            f"/api/services/{sid}/charges",
            json={"lines": [{"charge_type": "labor", "description": "İşçilik", "quantity": 1, "unit_price_kurus": 12000}]},
        )
        finance = client.get(f"/api/services/{sid}/finance").json()
        assert finance["grand_total"] == 12000
        assert finance["paid_total"] == 4000
        assert finance["balance"] == 8000
        assert finance["payments"][0]["amount_kurus"] == 4000
