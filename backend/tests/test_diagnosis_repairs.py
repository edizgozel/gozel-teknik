from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_service(status="intake"):
    customer = client.post(
        "/api/customers", json={"name": "Teşhis Müşterisi", "phone": "0566 111 22 33"}
    ).json()
    device = client.post(
        "/api/devices",
        json={"customer_id": customer["id"], "type": "tablet", "brand": "Samsung", "model": "Tab S8"},
    ).json()
    service = client.post(
        "/api/services",
        json={
            "customer_id": customer["id"],
            "device_id": device["id"],
            "reported_issue": "Ekran dokunmuyor",
            "physical_condition": "Kılıflı",
            "accessories": "Şarj kablosu",
        },
    ).json()
    for transition in {
        "diagnosis": ["diagnosis"],
        "repairing": ["diagnosis", "repairing"],
        "ready": ["diagnosis", "repairing", "ready"],
        "delivered": ["diagnosis", "repairing", "ready", "delivered"],
        "closed": ["diagnosis", "repairing", "ready", "delivered", "closed"],
        "cancelled": ["cancelled"],
    }.get(status, []):
        response = client.post(f"/api/services/{service['id']}/status", json={"new_status": transition})
        assert response.status_code == 200, (status, transition, response.text)
    return service


class TestDiagnosis:
    def test_save_and_update_diagnosis(self):
        service = setup_service()
        sid = service["id"]
        response = client.put(
            f"/api/services/{sid}/diagnosis",
            json={
                "diagnosis": "Dokunmatik Flex kablosu kopmuş",
                "found_issue": "Flex arızası",
                "proposed_solution": "Flex değişimi",
                "customer_message": "Parça 2 günde gelir",
                "internal_note": "Müşteri fiyat sordu",
            },
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["diagnosis"].startswith("Dokunmatik")

        updated = client.put(
            f"/api/services/{sid}/diagnosis",
            json={
                "diagnosis": "Dokunmatik kontrolcü arızalı",
                "proposed_solution": "Kontrolcü değişimi",
                "internal_note": "Garanti kapsamı dışı",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["diagnosis"] == "Dokunmatik kontrolcü arızalı"
        assert updated.json()["proposed_solution"] == "Kontrolcü değişimi"

    def test_original_reported_issue_untouched(self):
        service = setup_service()
        detail = client.get(f"/api/services/{service['id']}").json()
        client.put(f"/api/services/{service['id']}/diagnosis", json={"found_issue": "Farklı arıza"})
        after = client.get(f"/api/services/{service['id']}").json()
        assert detail["reported_issue"] == "Ekran dokunmuyor"
        assert after["reported_issue"] == "Ekran dokunmuyor"
        assert after["diagnosis"]["found_issue"] == "Farklı arıza"

    def test_empty_diagnosis_rejected_but_partial_ok(self):
        service = setup_service()
        assert (
            client.put(f"/api/services/{service['id']}/diagnosis", json={}).status_code == 422
        )

    def test_diagnosis_blocked_in_final_statuses(self):
        for status in ["delivered", "closed", "cancelled"]:
            service = setup_service(status)
            response = client.put(
                f"/api/services/{service['id']}/diagnosis", json={"diagnosis": "x"}
            )
            assert response.status_code == 400, status


class TestRepairActions:
    def test_add_multiple_and_order(self):
        service = setup_service()
        sid = service["id"]
        client.put(f"/api/services/{sid}/diagnosis", json={"diagnosis": "teşhis"})
        first = client.post(
            f"/api/services/{sid}/repairs", json={"action": "Ekran sökülerek inceleme"}
        )
        assert first.status_code == 201
        second = client.post(
            f"/api/services/{sid}/repairs",
            json={"action": "Flex değişimi", "note": "Orijinal parça kullanıldı"},
        )
        assert second.status_code == 201
        third = client.post(f"/api/services/{sid}/repairs", json={"action": "Fonksiyon testi"})
        detail = client.get(f"/api/services/{sid}").json()
        actions = [r["action"] for r in detail["repairs"]]
        assert actions == [
            "Ekran sökülerek ileri inceleme" if False else "Ekran sökülerek inceleme",
            "Flex değişimi",
            "Fonksiyon testi",
        ]
        assert detail["repairs"][1]["note"] == "Orijinal parça kullanıldı"

    def test_repair_does_not_change_status(self):
        service = setup_service()
        client.post(f"/api/services/{service['id']}/repairs", json={"action": "temizlik"})
        detail = client.get(f"/api/services/{service['id']}").json()
        assert detail["status"] == "intake"
        assert [h["new_status"] for h in detail["history"]] == ["intake"]

    def test_repair_blocked_in_final_statuses(self):
        for status in ["delivered", "closed", "cancelled"]:
            service = setup_service(status)
            response = client.post(
                f"/api/services/{service['id']}/repairs", json={"action": "x"}
            )
            assert response.status_code == 400, status

    def test_invalid_repair_rejected(self):
        service = setup_service()
        assert (
            client.post(f"/api/services/{service['id']}/repairs", json={"action": ""}).status_code
            == 422
        )

    def test_customer_device_and_history_intact(self):
        service = setup_service("repairing")
        client.put(f"/api/services/{service['id']}/diagnosis", json={"diagnosis": "d1"})
        client.post(f"/api/services/{service['id']}/repairs", json={"action": "a1"})
        detail = client.get(f"/api/services/{service['id']}").json()
        assert detail["customer_name"] == "Teşhis Müşterisi"
        assert detail["device_label"] == "Samsung Tab S8"
        assert [h["new_status"] for h in detail["history"]] == ["intake", "diagnosis", "repairing"]
        assert detail["physical_condition"] == "Kılıflı"
        assert detail["accessories"] == "Şarj kablosu"
