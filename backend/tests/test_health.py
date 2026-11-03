def test_health_ok(client):
    res = client.get("/api/v1/health")

    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "ok"
    assert body["environment"] == "testing"


def test_openapi_spec_documents_auth(client):
    spec = client.get("/openapi.json").get_json()

    assert spec["components"]["securitySchemes"]["bearerAuth"]["scheme"] == "bearer"
    # Mặc định mọi API cần Bearer token, riêng login và health là public
    assert spec["security"] == [{"bearerAuth": []}]
    assert spec["paths"]["/api/v1/auth/login"]["post"]["security"] == []
    assert spec["paths"]["/api/v1/health"]["get"]["security"] == []
    assert "security" not in spec["paths"]["/api/v1/auth/me"]["get"]
    assert {"401", "403"} <= set(spec["paths"]["/api/v1/users"]["get"]["responses"])
