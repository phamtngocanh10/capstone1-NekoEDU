from datetime import date

import pytest
from sqlalchemy import select

from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode, StaffProfile, User

STAFF_URL = "/api/v1/staff"


def staff_id_for_user(app, user_id):
    with app.app_context():
        return db.session.scalar(
            select(StaffProfile.id).where(StaffProfile.user_id == user_id)
        )


def valid_payload(user_id, **overrides):
    payload = {
        "user_id": user_id,
        "staff_code": "GV09",
        "position": "LECTURER",
        "specialization": "IELTS",
        "hire_date": "2026-01-15",
        "status": "ACTIVE",
    }
    payload.update(overrides)
    return payload


def test_manager_creates_staff_profile_with_audit(
    app, client, users, auth_header, create_user
):
    user_id = create_user("gv09", RoleCode.LECTURER)

    res = client.post(
        STAFF_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(user_id, specialization="  IELTS  "),
    )

    assert res.status_code == 201
    body = res.get_json()
    assert body["user_id"] == user_id
    assert body["staff_code"] == "GV09"
    assert body["position"] == "LECTURER"
    assert body["specialization"] == "IELTS"
    assert body["rate_per_session"] == 0
    with app.app_context():
        profile = db.session.scalar(
            select(StaffProfile).where(StaffProfile.user_id == user_id)
        )
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "staff_profiles",
                AuditLog.entity_id == profile.id,
            )
        )
        assert audit.action == AuditAction.CREATE
        assert audit.actor_user_id == users["manager"]
        assert audit.new_data["staff_code"] == "GV09"


def test_create_staff_requires_matching_staff_account(client, users, auth_header, create_user):
    headers = auth_header(users["manager"])
    student_id = create_user("hs099", RoleCode.STUDENT_PARENT, email=None)
    lecturer_id = create_user("gv09", RoleCode.LECTURER)

    student = client.post(STAFF_URL, headers=headers, json=valid_payload(student_id))
    mismatch = client.post(
        STAFF_URL,
        headers=headers,
        json=valid_payload(lecturer_id, position="TEACHING_ASSISTANT", staff_code="TG09"),
    )

    assert student.status_code == 409
    assert mismatch.status_code == 409
    assert "Position" in mismatch.get_json()["message"]


def test_create_staff_requires_email(client, users, auth_header, create_user):
    user_id = create_user("gv09", RoleCode.LECTURER, email=None)

    res = client.post(
        STAFF_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(user_id),
    )

    assert res.status_code == 409
    assert "email" in res.get_json()["message"]


def test_create_staff_rejects_existing_profile_and_duplicate_code(
    client, users, auth_header, create_user
):
    headers = auth_header(users["manager"])
    new_user = create_user("gv09", RoleCode.LECTURER)

    existing_profile = client.post(
        STAFF_URL, headers=headers, json=valid_payload(users["lecturer"], staff_code="GV10")
    )
    duplicate_code = client.post(
        STAFF_URL, headers=headers, json=valid_payload(new_user, staff_code="gv01")
    )

    assert existing_profile.status_code == 409
    assert duplicate_code.status_code == 409
    assert duplicate_code.get_json()["message"] == "Mã nhân sự đã tồn tại"


def test_create_staff_validates_payload(client, users, auth_header, create_user):
    user_id = create_user("gv09", RoleCode.LECTURER)
    headers = auth_header(users["manager"])
    cases = [
        (valid_payload(user_id, staff_code="x"), "staff_code"),
        (valid_payload(user_id, staff_code="bad code"), "staff_code"),
        (valid_payload(user_id, position="STUDENT"), "position"),
        (valid_payload(user_id, specialization="x" * 201), "specialization"),
        (valid_payload(user_id, hire_date="not-date"), "hire_date"),
        (valid_payload(user_id, status="LOCKED"), "status"),
    ]

    for payload, field in cases:
        res = client.post(STAFF_URL, headers=headers, json=payload)
        assert res.status_code == 422, (field, res.get_json())
        assert field in res.get_json()["errors"]["json"]


def test_create_staff_rejects_future_hire_date(client, users, auth_header, create_user):
    user_id = create_user("gv09", RoleCode.LECTURER)
    res = client.post(
        STAFF_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(user_id, hire_date="2999-01-01"),
    )

    assert res.status_code == 400
    assert "tương lai" in res.get_json()["message"]


def test_create_staff_unknown_user_and_permissions(client, users, auth_header):
    assert client.post(STAFF_URL, json={}).status_code == 401
    assert client.post(
        STAFF_URL, headers=auth_header(users["lecturer"]), json={}
    ).status_code == 403
    assert client.post(
        STAFF_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(999999),
    ).status_code == 404


def test_manager_gets_staff_detail_with_rate(app, client, users, auth_header):
    staff_id = staff_id_for_user(app, users["lecturer"])

    res = client.get(
        f"{STAFF_URL}/{staff_id}", headers=auth_header(users["manager"])
    )

    assert res.status_code == 200
    assert res.get_json()["rate_per_session"] == 250000
    assert res.get_json()["email"] == "gv01@neko.edu.vn"


def test_staff_detail_is_manager_only_and_handles_unknown(client, users, auth_header):
    assert client.get(f"{STAFF_URL}/999999").status_code == 401
    assert client.get(
        f"{STAFF_URL}/999999", headers=auth_header(users["lecturer"])
    ).status_code == 403
    assert client.get(
        f"{STAFF_URL}/999999", headers=auth_header(users["manager"])
    ).status_code == 404


def test_manager_updates_staff_profile_and_writes_audit(
    app, client, users, auth_header
):
    staff_id = staff_id_for_user(app, users["lecturer"])

    res = client.patch(
        f"{STAFF_URL}/{staff_id}",
        headers=auth_header(users["manager"]),
        json={
            "staff_code": "GV99",
            "specialization": "  Cambridge  ",
            "hire_date": "2026-02-01",
            "status": "INACTIVE",
        },
    )

    assert res.status_code == 200
    assert res.get_json()["staff_code"] == "GV99"
    assert res.get_json()["specialization"] == "Cambridge"
    assert res.get_json()["hire_date"] == "2026-02-01"
    assert res.get_json()["status"] == "INACTIVE"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "staff_profiles",
                AuditLog.entity_id == staff_id,
                AuditLog.action == AuditAction.UPDATE,
            )
        )
        assert audit.old_data["staff_code"] == "GV01"
        assert audit.new_data["staff_code"] == "GV99"


def test_position_change_synchronizes_role_and_invalidates_token(
    app, client, users, auth_header, create_user
):
    user_id = create_user("gv09", RoleCode.LECTURER)
    headers = auth_header(users["manager"])
    created = client.post(STAFF_URL, headers=headers, json=valid_payload(user_id))
    staff_id = created.get_json()["id"]
    old_token = auth_header(user_id)

    res = client.patch(
        f"{STAFF_URL}/{staff_id}",
        headers=headers,
        json={"position": "TEACHING_ASSISTANT"},
    )

    assert res.status_code == 200
    assert res.get_json()["position"] == "TEACHING_ASSISTANT"
    with app.app_context():
        user = db.session.get(User, user_id)
        assert user.role.code == "TEACHING_ASSISTANT"
        assert user.auth_version == 1
    assert client.get("/api/v1/auth/me", headers=old_token).status_code == 401


def test_manager_cannot_change_own_position(app, client, users, auth_header):
    staff_id = staff_id_for_user(app, users["manager"])
    res = client.patch(
        f"{STAFF_URL}/{staff_id}",
        headers=auth_header(users["manager"]),
        json={"position": "LECTURER"},
    )

    assert res.status_code == 403
    assert "chính mình" in res.get_json()["message"]


def test_update_staff_rejects_duplicate_empty_unknown_and_disallowed_fields(
    app, client, users, auth_header
):
    staff_id = staff_id_for_user(app, users["lecturer"])
    headers = auth_header(users["manager"])
    assert client.patch(
        f"{STAFF_URL}/{staff_id}", headers=headers, json={"staff_code": "mg01"}
    ).status_code == 409
    assert client.patch(f"{STAFF_URL}/{staff_id}", headers=headers, json={}).status_code == 422
    assert client.patch(
        f"{STAFF_URL}/{staff_id}", headers=headers, json={"rate_per_session": 999999}
    ).status_code == 422
    assert client.patch(
        f"{STAFF_URL}/{staff_id}", headers=headers, json={"hire_date": "2999-01-01"}
    ).status_code == 400
    assert client.patch(
        f"{STAFF_URL}/999999", headers=headers, json={"status": "INACTIVE"}
    ).status_code == 404
