from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "GOZEL TEKNİK"
    assert data["database"] == "connected"


def test_unknown_api_route_returns_404():
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404


def test_spa_fallback_serves_index_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
