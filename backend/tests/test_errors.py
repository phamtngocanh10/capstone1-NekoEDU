def test_unknown_route_returns_json_404(client):
    res = client.get("/api/v1/khong-ton-tai")

    assert res.status_code == 404
    assert res.get_json() == {"code": 404, "status": "Not Found", "message": "Không tìm thấy tài nguyên"}


def test_wrong_method_returns_json_405(client):
    res = client.delete("/api/v1/health")

    assert res.status_code == 405
    assert res.get_json()["message"] == "Phương thức không được hỗ trợ"
