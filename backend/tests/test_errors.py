from app.common.errors import ForbiddenError


def test_unknown_route_returns_json_404(client):
    res = client.get("/api/v1/khong-ton-tai")

    assert res.status_code == 404
    assert res.get_json()["code"] == 404


def test_app_error_returns_json(app):
    @app.get("/boom")
    def boom():
        raise ForbiddenError("Không đủ quyền")

    res = app.test_client().get("/boom")

    assert res.status_code == 403
    assert res.get_json() == {"code": 403, "status": "Forbidden", "message": "Không đủ quyền"}
