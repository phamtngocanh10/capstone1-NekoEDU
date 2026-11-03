def test_health_ok(client):
    res = client.get("/api/v1/health")

    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "ok"
    assert body["environment"] == "testing"


def test_openapi_spec_lists_health_endpoint(client):
    res = client.get("/openapi.json")

    assert res.status_code == 200
    assert "/api/v1/health" in res.get_json()["paths"]
