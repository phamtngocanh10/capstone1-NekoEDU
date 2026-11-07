import json
from datetime import date, timedelta

import pytest
from sqlalchemy import text

from app.extensions import db
from app.models import UserStatus

ADMISSION_URL = "/api/v1/admission-leads"


@pytest.fixture
def admission_scope(app, users):
    with app.app_context():
        level_1 = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 1)"
            )
        ).scalar_one()
        level_2 = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_2', 'Kid 2', 7, 8, 2)"
            )
        ).scalar_one()
        lead_ids = []
        for values in (
            {
                "code": "LD-001",
                "child": "Nguyễn Minh An",
                "guardian": "Nguyễn Văn Bình",
                "phone": "0901111111",
                "source": "FACEBOOK",
                "level": level_1,
                "score": None,
                "status": "NEW",
                "consultant": users["manager"],
                "created_at": "2026-01-01T08:00:00+07:00",
            },
            {
                "code": "LD-002",
                "child": "Trần Gia Hân",
                "guardian": "Trần Thị Hoa",
                "phone": "0902222222",
                "source": "REFERRAL",
                "level": level_2,
                "score": 8.5,
                "status": "TESTED",
                "consultant": users["manager"],
                "created_at": "2026-01-03T08:00:00+07:00",
            },
            {
                "code": "LD-003",
                "child": "Lê Quốc Bảo",
                "guardian": "Lê Văn Nam",
                "phone": "0903333333",
                "source": "WALK_IN",
                "level": None,
                "score": None,
                "status": "LOST",
                "consultant": None,
                "created_at": "2026-01-02T08:00:00+07:00",
            },
        ):
            lead_ids.append(
                db.session.execute(
                    text(
                        """INSERT INTO admission_leads
                            (lead_code, child_full_name, child_dob, guardian_name,
                             guardian_phone, source, interested_level_id, placement_score,
                             status, consultant_user_id, note, created_at)
                           OUTPUT INSERTED.id
                           VALUES
                            (:code, :child, '2018-01-01', :guardian, :phone, :source,
                             :level, :score, :status, :consultant, NULL, :created_at)"""
                    ),
                    values,
                ).scalar_one()
            )
        db.session.commit()
    return {"levels": (level_1, level_2), "leads": tuple(lead_ids)}


def get_leads(client, headers, **query):
    response = client.get(ADMISSION_URL, headers=headers, query_string=query)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def lead_codes(body):
    return [item["lead_code"] for item in body["items"]]


def test_f21_manager_lists_leads_with_related_data(
    client, users, auth_header, admission_scope
):
    body = get_leads(client, auth_header(users["manager"]))

    assert lead_codes(body) == ["LD-002", "LD-003", "LD-001"]
    assert body["pagination"] == {
        "page": 1,
        "page_size": 20,
        "total": 3,
        "total_pages": 1,
    }
    assert body["items"][0]["interested_level"]["id"] == admission_scope["levels"][1]
    assert body["items"][0]["placement_score"] == 8.5
    assert body["items"][0]["consultant"]["id"] == users["manager"]
    assert body["items"][1]["interested_level"] is None
    assert body["items"][1]["consultant"] is None


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f21_only_manager_can_list_admission_leads(
    client, users, auth_header, admission_scope, actor
):
    assert client.get(ADMISSION_URL, headers=auth_header(users[actor])).status_code == 403


def test_f21_requires_auth_before_query_validation(client):
    assert client.get(f"{ADMISSION_URL}?page=bad").status_code == 401


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("ld-002", ["LD-002"]),
        ("minh an", ["LD-001"]),
        ("thị hoa", ["LD-002"]),
        ("0903333333", ["LD-003"]),
    ],
)
def test_f21_searches_code_child_guardian_and_phone(
    client, users, auth_header, admission_scope, query, expected
):
    body = get_leads(client, auth_header(users["manager"]), q=query)
    assert lead_codes(body) == expected


def test_f21_treats_search_wildcards_literally(client, users, auth_header, admission_scope):
    headers = auth_header(users["manager"])
    assert get_leads(client, headers, q="%")["items"] == []
    assert get_leads(client, headers, q="_")["items"] == []


def test_f21_filters_and_paginates(client, users, auth_header, admission_scope):
    headers = auth_header(users["manager"])
    assert lead_codes(get_leads(client, headers, source="REFERRAL")) == ["LD-002"]
    assert lead_codes(get_leads(client, headers, status="NEW")) == ["LD-001"]
    assert lead_codes(
        get_leads(client, headers, interested_level_id=admission_scope["levels"][0])
    ) == ["LD-001"]
    assert lead_codes(get_leads(client, headers, consultant_user_id=users["manager"])) == [
        "LD-002",
        "LD-001",
    ]
    page = get_leads(client, headers, page=2, page_size=2)
    assert lead_codes(page) == ["LD-001"]
    assert page["pagination"] == {
        "page": 2,
        "page_size": 2,
        "total": 3,
        "total_pages": 2,
    }


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ({"page": 0}, "page"),
        ({"page_size": 101}, "page_size"),
        ({"q": "x" * 101}, "q"),
        ({"source": "TIKTOK"}, "source"),
        ({"status": "INVALID"}, "status"),
        ({"interested_level_id": 0}, "interested_level_id"),
        ({"consultant_user_id": "abc"}, "consultant_user_id"),
    ],
)
def test_f21_validates_list_filters(
    client, users, auth_header, admission_scope, query, field
):
    response = client.get(
        ADMISSION_URL, headers=auth_header(users["manager"]), query_string=query
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["query"]


def create_payload(scope, **overrides):
    payload = {
        "lead_code": "LD-NEW-01",
        "child_full_name": "Phạm Minh Khang",
        "child_dob": "2018-05-10",
        "guardian_name": "Phạm Văn Hùng",
        "guardian_phone": "0904444444",
        "source": "WEBSITE",
        "interested_level_id": scope["levels"][1],
        "note": "Ưu tiên học cuối tuần",
    }
    payload.update(overrides)
    return payload


def test_f22_manager_creates_new_lead_and_audit(
    app, client, users, auth_header, admission_scope
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users["manager"]),
        json=create_payload(
            admission_scope,
            child_full_name="  Phạm Minh Khang  ",
            guardian_name="  Phạm Văn Hùng  ",
            consultant_user_id=users["lecturer"],
        ),
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["lead_code"] == "LD-NEW-01"
    assert body["child_full_name"] == "Phạm Minh Khang"
    assert body["guardian_name"] == "Phạm Văn Hùng"
    assert body["status"] == "NEW"
    assert body["placement_score"] is None
    assert body["student_id"] is None
    assert body["converted_at"] is None
    assert body["consultant"]["id"] == users["lecturer"]
    with app.app_context():
        audit = db.session.execute(
            text(
                "SELECT action, new_data FROM audit_logs "
                "WHERE entity_name = 'admission_leads' AND entity_id = :id"
            ),
            {"id": body["id"]},
        ).mappings().one()
    assert audit["action"] == "CREATE"
    assert json.loads(audit["new_data"])["status"] == "NEW"


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f22_only_manager_can_create_lead(
    client, users, auth_header, admission_scope, actor
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users[actor]),
        json=create_payload(admission_scope),
    )
    assert response.status_code == 403


def test_f22_requires_auth_before_payload_validation(client):
    assert client.post(ADMISSION_URL, json={}).status_code == 401


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"lead_code": "!"}, "lead_code"),
        ({"child_full_name": "   "}, "child_full_name"),
        ({"child_dob": "not-a-date"}, "child_dob"),
        ({"guardian_name": "   "}, "guardian_name"),
        ({"guardian_phone": "123"}, "guardian_phone"),
        ({"source": "TIKTOK"}, "source"),
        ({"interested_level_id": "1"}, "interested_level_id"),
        ({"consultant_user_id": "1"}, "consultant_user_id"),
        ({"note": "x" * 501}, "note"),
        ({"status": "TESTED"}, "status"),
        ({"placement_score": 8}, "placement_score"),
    ],
)
def test_f22_validates_create_payload(
    client, users, auth_header, admission_scope, overrides, field
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users["manager"]),
        json=create_payload(admission_scope, **overrides),
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


@pytest.mark.parametrize("child_dob", [date.today(), date.today() + timedelta(days=1)])
def test_f22_rejects_non_past_child_birth_date(
    client, users, auth_header, admission_scope, child_dob
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users["manager"]),
        json=create_payload(admission_scope, child_dob=child_dob.isoformat()),
    )
    assert response.status_code == 400
    assert "quá khứ" in response.get_json()["message"]


def test_f22_rejects_duplicate_code_case_insensitively(
    client, users, auth_header, admission_scope
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users["manager"]),
        json=create_payload(admission_scope, lead_code="ld-001"),
    )
    assert response.status_code == 409


def test_f22_rejects_missing_level_or_consultant(
    client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    missing_level = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, interested_level_id=999999),
    )
    missing_consultant = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, consultant_user_id=999999),
    )
    assert missing_level.status_code == 404
    assert missing_consultant.status_code == 404


def test_f22_rejects_student_or_inactive_consultant(
    client, users, auth_header, admission_scope, create_user
):
    inactive_staff = create_user("inactive_manager", status=UserStatus.INACTIVE)
    headers = auth_header(users["manager"])
    student_consultant = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, consultant_user_id=users["student"]),
    )
    inactive_consultant = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, consultant_user_id=inactive_staff),
    )
    assert student_consultant.status_code == 409
    assert inactive_consultant.status_code == 409


def test_f22_rejects_consultant_without_active_staff_profile(
    app, client, users, auth_header, admission_scope, create_user
):
    no_profile = create_user("manager_no_profile")
    with app.app_context():
        db.session.execute(
            text("UPDATE staff_profiles SET status = 'INACTIVE' WHERE user_id = :user_id"),
            {"user_id": users["lecturer"]},
        )
        db.session.commit()
    headers = auth_header(users["manager"])
    missing_profile = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, consultant_user_id=no_profile),
    )
    inactive_profile = client.post(
        ADMISSION_URL,
        headers=headers,
        json=create_payload(admission_scope, consultant_user_id=users["lecturer"]),
    )
    assert missing_profile.status_code == 409
    assert inactive_profile.status_code == 409


def test_f22_allows_same_guardian_phone_for_separate_leads(
    client, users, auth_header, admission_scope
):
    response = client.post(
        ADMISSION_URL,
        headers=auth_header(users["manager"]),
        json=create_payload(admission_scope, guardian_phone="0901111111"),
    )
    assert response.status_code == 201


def lead_url(lead_id):
    return f"{ADMISSION_URL}/{lead_id}"


def test_f23_manager_updates_lead_and_writes_changed_fields_to_audit(
    app, client, users, auth_header, admission_scope
):
    lead_id = admission_scope["leads"][0]
    response = client.patch(
        lead_url(lead_id),
        headers=auth_header(users["manager"]),
        json={
            "child_full_name": "  Nguyễn Minh Anh  ",
            "status": "CONTACTED",
            "consultant_user_id": users["lecturer"],
            "note": "  Đã gọi lần đầu  ",
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["child_full_name"] == "Nguyễn Minh Anh"
    assert body["status"] == "CONTACTED"
    assert body["consultant"]["id"] == users["lecturer"]
    assert body["note"] == "Đã gọi lần đầu"
    with app.app_context():
        audit = db.session.execute(
            text(
                "SELECT old_data, new_data FROM audit_logs "
                "WHERE entity_name = 'admission_leads' AND entity_id = :id"
            ),
            {"id": lead_id},
        ).mappings().one()
    assert json.loads(audit["old_data"])["status"] == "NEW"
    assert json.loads(audit["new_data"])["status"] == "CONTACTED"


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f23_only_manager_can_update_lead(
    client, users, auth_header, admission_scope, actor
):
    response = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=auth_header(users[actor]),
        json={"status": "CONTACTED"},
    )
    assert response.status_code == 403


def test_f23_requires_auth_before_payload_validation(client, admission_scope):
    assert client.patch(lead_url(admission_scope["leads"][0]), json={}).status_code == 401


def test_f23_contacted_lead_can_be_tested_with_numeric_score(
    client, users, auth_header, admission_scope
):
    lead_id = admission_scope["leads"][0]
    headers = auth_header(users["manager"])
    assert client.patch(
        lead_url(lead_id), headers=headers, json={"status": "CONTACTED"}
    ).status_code == 200
    tested = client.patch(
        lead_url(lead_id),
        headers=headers,
        json={"status": "TESTED", "placement_score": 9.5},
    )
    assert tested.status_code == 200
    assert tested.get_json()["status"] == "TESTED"
    assert tested.get_json()["placement_score"] == 9.5


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "_schema"),
        ({"placement_score": "8.5"}, "placement_score"),
        ({"placement_score": True}, "placement_score"),
        ({"placement_score": -0.1}, "placement_score"),
        ({"placement_score": 10.1}, "placement_score"),
        ({"placement_score": 8.55}, "placement_score"),
        ({"status": "ENROLLED"}, "status"),
        ({"guardian_phone": "123"}, "guardian_phone"),
        ({"lead_code": "!"}, "lead_code"),
    ],
)
def test_f23_validates_update_payload(
    client, users, auth_header, admission_scope, payload, field
):
    response = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_f23_enforces_status_transition_order(client, users, auth_header, admission_scope):
    response = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=auth_header(users["manager"]),
        json={"status": "TESTED", "placement_score": 8.0},
    )
    assert response.status_code == 409
    assert "NEW sang TESTED" in response.get_json()["message"]


def test_f23_tested_requires_score_and_score_requires_compatible_status(
    client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    lead_id = admission_scope["leads"][0]
    client.patch(lead_url(lead_id), headers=headers, json={"status": "CONTACTED"})
    no_score = client.patch(
        lead_url(lead_id), headers=headers, json={"status": "TESTED"}
    )
    score_while_contacted = client.patch(
        lead_url(lead_id), headers=headers, json={"placement_score": 8.0}
    )
    assert no_score.status_code == 400
    assert score_while_contacted.status_code == 400


def test_f23_can_leave_tested_only_when_score_is_cleared_for_contacted(
    client, users, auth_header, admission_scope
):
    lead_id = admission_scope["leads"][1]
    headers = auth_header(users["manager"])
    rejected = client.patch(
        lead_url(lead_id), headers=headers, json={"status": "CONTACTED"}
    )
    accepted = client.patch(
        lead_url(lead_id),
        headers=headers,
        json={"status": "CONTACTED", "placement_score": None},
    )
    assert rejected.status_code == 400
    assert accepted.status_code == 200
    assert accepted.get_json()["placement_score"] is None


def test_f23_lost_lead_can_be_reopened(client, users, auth_header, admission_scope):
    response = client.patch(
        lead_url(admission_scope["leads"][2]),
        headers=auth_header(users["manager"]),
        json={"status": "CONTACTED"},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "CONTACTED"


def test_f23_rejects_duplicate_code_and_non_past_dob(
    client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    duplicate = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=headers,
        json={"lead_code": "ld-002"},
    )
    invalid_dob = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=headers,
        json={"child_dob": date.today().isoformat()},
    )
    assert duplicate.status_code == 409
    assert invalid_dob.status_code == 400


def test_f23_rejects_missing_resources(client, users, auth_header, admission_scope):
    headers = auth_header(users["manager"])
    missing_lead = client.patch(lead_url(999999), headers=headers, json={"note": "x"})
    missing_level = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=headers,
        json={"interested_level_id": 999999},
    )
    missing_consultant = client.patch(
        lead_url(admission_scope["leads"][0]),
        headers=headers,
        json={"consultant_user_id": 999999},
    )
    assert missing_lead.status_code == 404
    assert missing_level.status_code == 404
    assert missing_consultant.status_code == 404


def test_f23_enrolled_lead_is_immutable(app, client, users, auth_header, admission_scope):
    lead_id = admission_scope["leads"][0]
    with app.app_context():
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (N'Phụ huynh', '0909999999', 'GUARDIAN')"
            )
        ).scalar_one()
        student_id = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES ('HS-F23', N'Học sinh', '2018-01-01', :guardian_id,
                           :level_id, '2026-01-01', 'ACTIVE')"""
            ),
            {"guardian_id": guardian_id, "level_id": admission_scope["levels"][0]},
        ).scalar_one()
        db.session.execute(
            text(
                "UPDATE admission_leads SET status = 'ENROLLED', student_id = :student_id, "
                "converted_at = '2026-01-01' WHERE id = :lead_id"
            ),
            {"student_id": student_id, "lead_id": lead_id},
        )
        db.session.commit()
    response = client.patch(
        lead_url(lead_id),
        headers=auth_header(users["manager"]),
        json={"note": "Không được sửa"},
    )
    assert response.status_code == 409
    assert "đã ghi danh" in response.get_json()["message"]


def convert_url(lead_id):
    return f"{lead_url(lead_id)}/convert"


def conversion_payload(**overrides):
    payload = {
        "student_code": "HS-F24",
        "english_name": "Hana",
        "enrolled_at": date.today().isoformat(),
        "guardian_relationship": "MOTHER",
        "guardian_email": "parent.f24@example.com",
        "guardian_address": "Đà Nẵng",
        "note": "Chuyển đổi từ lead",
    }
    payload.update(overrides)
    return payload


def test_f24_converts_tested_lead_by_creating_guardian_and_student_atomically(
    app, client, users, auth_header, admission_scope
):
    lead_id = admission_scope["leads"][1]
    response = client.post(
        convert_url(lead_id),
        headers=auth_header(users["manager"]),
        json=conversion_payload(),
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["lead"]["status"] == "ENROLLED"
    assert body["lead"]["student_id"] == body["student"]["id"]
    assert body["lead"]["converted_at"] == date.today().isoformat()
    assert body["student"]["student_code"] == "HS-F24"
    assert body["student"]["full_name"] == "Trần Gia Hân"
    assert body["student"]["date_of_birth"] == "2018-01-01"
    assert body["student"]["level"]["id"] == admission_scope["levels"][1]
    assert body["student"]["guardian"]["phone"] == "0902222222"
    with app.app_context():
        counts = db.session.execute(
            text(
                """SELECT
                    (SELECT COUNT(*) FROM guardians WHERE phone = '0902222222') AS guardians,
                    (SELECT COUNT(*) FROM students WHERE student_code = 'HS-F24') AS students,
                    (SELECT COUNT(*) FROM audit_logs WHERE entity_name = 'guardians') AS guardian_audits,
                    (SELECT COUNT(*) FROM audit_logs WHERE entity_name = 'students') AS student_audits,
                    (SELECT COUNT(*) FROM audit_logs WHERE entity_name = 'admission_leads'
                        AND entity_id = :lead_id) AS lead_audits"""
            ),
            {"lead_id": lead_id},
        ).mappings().one()
    assert dict(counts) == {
        "guardians": 1,
        "students": 1,
        "guardian_audits": 1,
        "student_audits": 1,
        "lead_audits": 1,
    }


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f24_only_manager_can_convert_lead(
    client, users, auth_header, admission_scope, actor
):
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users[actor]),
        json=conversion_payload(),
    )
    assert response.status_code == 403


def test_f24_requires_auth_before_payload_validation(client, admission_scope):
    assert client.post(convert_url(admission_scope["leads"][1]), json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "student_code"),
        ({"student_code": "HS01"}, "enrolled_at"),
        (
            {
                "student_code": "HS01",
                "enrolled_at": "2026-01-01",
                "guardian_relationship": "MOTHER",
                "guardian_id": 1,
            },
            "guardian_id",
        ),
        (
            {"student_code": "HS01", "enrolled_at": "2026-01-01"},
            "guardian_id",
        ),
        (
            {"existing_student_id": 1, "student_code": "HS01"},
            "student_code",
        ),
        (
            {"existing_student_id": "1"},
            "existing_student_id",
        ),
        (
            {
                "student_code": "!",
                "enrolled_at": "2026-01-01",
                "guardian_relationship": "MOTHER",
            },
            "student_code",
        ),
        (
            {
                "student_code": "HS01",
                "enrolled_at": "not-a-date",
                "guardian_relationship": "MOTHER",
            },
            "enrolled_at",
        ),
    ],
)
def test_f24_validates_conversion_modes(
    client, users, auth_header, admission_scope, payload, field
):
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_f24_requires_tested_lead_with_score(client, users, auth_header, admission_scope):
    response = client.post(
        convert_url(admission_scope["leads"][0]),
        headers=auth_header(users["manager"]),
        json=conversion_payload(),
    )
    assert response.status_code == 409
    assert "TESTED" in response.get_json()["message"]


def test_f24_requires_child_dob_and_interested_level(
    app, client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    lead_id = admission_scope["leads"][1]
    with app.app_context():
        db.session.execute(
            text("UPDATE admission_leads SET child_dob = NULL WHERE id = :id"), {"id": lead_id}
        )
        db.session.commit()
    missing_dob = client.post(convert_url(lead_id), headers=headers, json=conversion_payload())
    assert missing_dob.status_code == 409
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE admission_leads SET child_dob = '2018-01-01', "
                "interested_level_id = NULL WHERE id = :id"
            ),
            {"id": lead_id},
        )
        db.session.commit()
    missing_level = client.post(convert_url(lead_id), headers=headers, json=conversion_payload())
    assert missing_level.status_code == 409


@pytest.mark.parametrize(
    "enrolled_at",
    ["2017-12-31", (date.today() + timedelta(days=1)).isoformat()],
)
def test_f24_validates_enrollment_date(
    client, users, auth_header, admission_scope, enrolled_at
):
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json=conversion_payload(enrolled_at=enrolled_at),
    )
    assert response.status_code == 400


def test_f24_rejects_duplicate_student_code_without_partial_guardian(
    app, client, users, auth_header, admission_scope
):
    with app.app_context():
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (N'Guardian cũ', '0908888888', 'GUARDIAN')"
            )
        ).scalar_one()
        db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   VALUES ('HS-F24', N'Học sinh cũ', '2018-01-01', :guardian_id,
                           :level_id, '2026-01-01', 'ACTIVE')"""
            ),
            {"guardian_id": guardian_id, "level_id": admission_scope["levels"][1]},
        )
        db.session.commit()
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json=conversion_payload(),
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM guardians WHERE phone = '0902222222'")
        ).scalar_one() == 0


def test_f24_existing_guardian_requires_explicit_matching_id(
    app, client, users, auth_header, admission_scope
):
    with app.app_context():
        db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "VALUES (N'Trần Thị Hoa', '0902222222', 'MOTHER')"
            )
        )
        db.session.commit()
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json=conversion_payload(),
    )
    assert response.status_code == 409
    assert "guardian_id" in response.get_json()["message"]


def test_f24_converts_with_confirmed_existing_guardian(
    app, client, users, auth_header, admission_scope
):
    with app.app_context():
        db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "VALUES (N'Dummy', '0907777777', 'GUARDIAN')"
            )
        )
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (N'Trần Thị Hoa', '0902222222', 'MOTHER')"
            )
        ).scalar_one()
        db.session.commit()
    payload = {
        "student_code": "HS-F24",
        "enrolled_at": date.today().isoformat(),
        "guardian_id": guardian_id,
    }
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 201
    assert response.get_json()["student"]["guardian"]["id"] == guardian_id


def test_f24_rejects_mismatched_existing_guardian(
    app, client, users, auth_header, admission_scope
):
    with app.app_context():
        db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "VALUES (N'Dummy', '0907777777', 'GUARDIAN')"
            )
        )
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (N'Người khác', '0906666666', 'GUARDIAN')"
            )
        ).scalar_one()
        db.session.commit()
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json={
            "student_code": "HS-F24",
            "enrolled_at": date.today().isoformat(),
            "guardian_id": guardian_id,
        },
    )
    assert response.status_code == 409
    assert "không khớp lead" in response.get_json()["message"]


def _insert_matching_student_for_f24(scope):
    db.session.execute(
        text(
            "INSERT INTO guardians (full_name, phone, relationship) "
            "VALUES (N'Dummy', '0907777777', 'GUARDIAN')"
        )
    )
    guardian_id = db.session.execute(
        text(
            "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
            "VALUES (N'Trần Thị Hoa', '0902222222', 'MOTHER')"
        )
    ).scalar_one()
    db.session.execute(
        text(
            """INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id,
                 current_level_id, enrolled_at, status)
               VALUES ('HS-DUMMY', N'Dummy', '2018-01-01', :guardian_id,
                       :level_id, '2026-01-01', 'ACTIVE')"""
        ),
        {"guardian_id": guardian_id, "level_id": scope["levels"][1]},
    )
    student_id = db.session.execute(
        text(
            """INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id,
                 current_level_id, enrolled_at, status)
               OUTPUT INSERTED.id
               VALUES ('HS-MATCH', N'Trần Gia Hân', '2018-01-01', :guardian_id,
                       :level_id, '2026-01-01', 'ACTIVE')"""
        ),
        {"guardian_id": guardian_id, "level_id": scope["levels"][1]},
    ).scalar_one()
    db.session.commit()
    return student_id


def test_f24_can_link_verified_existing_student(
    app, client, users, auth_header, admission_scope
):
    with app.app_context():
        student_id = _insert_matching_student_for_f24(admission_scope)
    response = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=auth_header(users["manager"]),
        json={"existing_student_id": student_id},
    )
    assert response.status_code == 201
    assert response.get_json()["student"]["id"] == student_id
    assert response.get_json()["lead"]["student_id"] == student_id


def test_f24_rejects_mismatched_or_missing_existing_student(
    app, client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    missing = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=headers,
        json={"existing_student_id": 999999},
    )
    assert missing.status_code == 404
    with app.app_context():
        student_id = _insert_matching_student_for_f24(admission_scope)
        db.session.execute(
            text("UPDATE students SET full_name = N'Không khớp' WHERE id = :id"),
            {"id": student_id},
        )
        db.session.commit()
    mismatch = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=headers,
        json={"existing_student_id": student_id},
    )
    assert mismatch.status_code == 409


def test_f24_cannot_convert_same_lead_twice(
    client, users, auth_header, admission_scope
):
    headers = auth_header(users["manager"])
    first = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=headers,
        json=conversion_payload(),
    )
    second = client.post(
        convert_url(admission_scope["leads"][1]),
        headers=headers,
        json={"existing_student_id": first.get_json()["student"]["id"]},
    )
    assert first.status_code == 201
    assert second.status_code == 409


def test_f24_returns_not_found_for_missing_lead(
    client, users, auth_header, admission_scope
):
    response = client.post(
        convert_url(999999),
        headers=auth_header(users["manager"]),
        json=conversion_payload(),
    )
    assert response.status_code == 404
