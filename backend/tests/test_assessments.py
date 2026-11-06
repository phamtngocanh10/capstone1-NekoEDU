from decimal import Decimal
from io import BytesIO

import pytest
from openpyxl import Workbook, load_workbook
from sqlalchemy import select, text

from app.extensions import db
from app.models import AuditLog, StaffPosition, StaffProfile


@pytest.fixture
def assessment_scope(app, users, create_staff):
    outsider_user = create_staff("gv_result_out", StaffPosition.LECTURER, "GV-RES-OUT")
    with app.app_context():
        staff_ids = {
            profile.user_id: profile.id
            for profile in db.session.scalars(select(StaffProfile)).all()
        }
        dummy_level_id = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KINDY', N'Kindy', 4, 5, 0)"
            )
        ).scalar_one()
        level_id = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_1', N'Kid 1', 6, 7, 1)"
            )
        ).scalar_one()
        other_level_id = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_2', N'Kid 2', 7, 8, 2)"
            )
        ).scalar_one()
        course_id = db.session.execute(
            text(
                """INSERT INTO courses
                    (course_code, level_id, name, sessions_per_week, session_minutes,
                     monthly_fee, status)
                   OUTPUT INSERTED.id
                   VALUES ('C-RES', :level_id, N'Khóa kết quả', 2, 90, 1000000, 'ACTIVE')"""
            ),
            {"level_id": level_id},
        ).scalar_one()
        dummy_course_id = db.session.execute(
            text(
                """INSERT INTO courses
                    (course_code, level_id, name, sessions_per_week, session_minutes,
                     monthly_fee, status)
                   OUTPUT INSERTED.id
                   VALUES ('C-RES-D', :level_id, N'Khóa giả', 1, 60, 1000000, 'ACTIVE')"""
            ),
            {"level_id": dummy_level_id},
        ).scalar_one()
        dummy_room_id = db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
                "VALUES ('R-RES-D', N'Phòng giả', 1, 'AVAILABLE')"
            )
        ).scalar_one()
        room_id = db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
                "VALUES ('R-RES', N'Phòng kết quả', 20, 'AVAILABLE')"
            )
        ).scalar_one()
        db.session.execute(
            text(
                """INSERT INTO classes
                    (class_code, name, course_id, lecturer_id, default_room_id,
                     max_students, start_date, end_date, status)
                   VALUES ('CLS-RES-D', N'Lớp giả', :course_id, :lecturer_id,
                           :room_id, 1, '2026-01-01', '2026-12-31', 'ONGOING')"""
            ),
            {
                "course_id": dummy_course_id,
                "lecturer_id": staff_ids[users["lecturer"]],
                "room_id": dummy_room_id,
            },
        )
        class_id = db.session.execute(
            text(
                """INSERT INTO classes
                    (class_code, name, course_id, lecturer_id, assistant_id,
                     default_room_id, max_students, start_date, end_date, status)
                   OUTPUT INSERTED.id
                   VALUES ('CLS-RES', N'Lớp kết quả', :course_id, :lecturer_id,
                           :assistant_id, :room_id, 20, '2026-01-01', '2026-12-31',
                           'ONGOING')"""
            ),
            {
                "course_id": course_id,
                "lecturer_id": staff_ids[users["lecturer"]],
                "assistant_id": staff_ids[users["assistant"]],
                "room_id": room_id,
            },
        ).scalar_one()
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "OUTPUT INSERTED.id VALUES (N'Phụ huynh kết quả', '0901000001', 'GUARDIAN')"
            )
        ).scalar_one()
        db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   VALUES ('HR000', N'Học sinh giả', '2018-01-01', :guardian_id,
                           :level_id, '2026-01-01', 'ACTIVE')"""
            ),
            {"guardian_id": guardian_id, "level_id": level_id},
        )
        students = []
        for index, user_id in enumerate((users["student"], None), start=1):
            student_id = db.session.execute(
                text(
                    """INSERT INTO students
                        (student_code, full_name, date_of_birth, guardian_id, user_id,
                         current_level_id, enrolled_at, status)
                       OUTPUT INSERTED.id
                       VALUES (:code, :name, '2018-01-01', :guardian_id, :user_id,
                               :level_id, '2026-01-01', 'ACTIVE')"""
                ),
                {
                    "code": f"HR{index:03d}",
                    "name": f"Học sinh kết quả {index}",
                    "guardian_id": guardian_id,
                    "user_id": user_id,
                    "level_id": level_id,
                },
            ).scalar_one()
            db.session.execute(
                text(
                    """INSERT INTO class_enrollments
                        (class_id, student_id, enrolled_date, status)
                       VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"""
                ),
                {"class_id": class_id, "student_id": student_id},
            )
            students.append(student_id)
        db.session.commit()
    return {
        "class": class_id,
        "level": level_id,
        "other_level": other_level_id,
        "students": students,
        "outsider": outsider_user,
    }


def assessment_payload(scope, **overrides):
    payload = {
        "class_id": scope["class"],
        "level_id": scope["level"],
        "assessment_type": "MONTHLY",
        "title": "  Kiểm tra tháng 1  ",
        "test_date": "2026-01-31",
        "score_min": 0,
        "score_max": 10,
    }
    payload.update(overrides)
    return payload


def create_assessment(client, actor_id, auth_header, scope, **overrides):
    return client.post(
        "/api/v1/assessments",
        headers=auth_header(actor_id),
        json=assessment_payload(scope, **overrides),
    )


def test_f51_manager_creates_draft_assessment_with_audit(
    app, client, users, auth_header, assessment_scope
):
    response = create_assessment(
        client, users["manager"], auth_header, assessment_scope
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["class"]["id"] == assessment_scope["class"]
    assert body["level"]["id"] == assessment_scope["level"]
    assert body["title"] == "Kiểm tra tháng 1"
    assert body["assessment_type"] == "MONTHLY"
    assert body["status"] == "DRAFT"
    assert body["score_min"] == 0.0
    assert body["score_max"] == 10.0
    assert body["published_by"] is None
    with app.app_context():
        audit = db.session.scalars(
            select(AuditLog).where(
                AuditLog.entity_name == "assessments",
                AuditLog.entity_id == body["id"],
                AuditLog.action == "CREATE",
            )
        ).one()
    assert audit.actor_user_id == users["manager"]
    assert audit.new_data["status"] == "DRAFT"


def test_f51_assigned_teacher_can_create_and_outsider_cannot(
    client, users, auth_header, assessment_scope
):
    assert create_assessment(
        client, users["lecturer"], auth_header, assessment_scope
    ).status_code == 201
    assert create_assessment(
        client, assessment_scope["outsider"], auth_header, assessment_scope
    ).status_code == 403


@pytest.mark.parametrize("actor", ["assistant", "student"])
def test_f51_ta_and_parent_cannot_create(
    client, users, auth_header, assessment_scope, actor
):
    assert create_assessment(
        client, users[actor], auth_header, assessment_scope
    ).status_code == 403


def test_f51_requires_authentication_before_validation(client):
    assert client.post("/api/v1/assessments", json={}).status_code == 401


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"assessment_type": "WEEKLY"}, "assessment_type"),
        ({"title": "   "}, "title"),
        ({"score_min": -1}, "score_max"),
        ({"score_min": 10, "score_max": 10}, "score_max"),
        ({"score_min": 11, "score_max": 10}, "score_max"),
        ({"class_id": "1"}, "class_id"),
        ({"level_id": True}, "level_id"),
    ],
)
def test_f51_validates_create_payload(
    client, users, auth_header, assessment_scope, overrides, field
):
    response = create_assessment(
        client, users["manager"], auth_header, assessment_scope, **overrides
    )
    assert response.status_code == 422
    assert field in str(response.get_json()["errors"]["json"])


def test_f51_rejects_level_not_matching_class(
    client, users, auth_header, assessment_scope
):
    response = create_assessment(
        client,
        users["manager"],
        auth_header,
        assessment_scope,
        level_id=assessment_scope["other_level"],
    )
    assert response.status_code == 409


def test_f51_returns_not_found_for_missing_class(
    client, users, auth_header, assessment_scope
):
    response = create_assessment(
        client, users["manager"], auth_header, assessment_scope, class_id=999999
    )
    assert response.status_code == 404


def test_f51_manager_and_assigned_teacher_list_and_get_draft(
    client, users, auth_header, assessment_scope
):
    created = create_assessment(
        client, users["manager"], auth_header, assessment_scope
    ).get_json()
    for actor in (users["manager"], users["lecturer"]):
        listing = client.get("/api/v1/assessments", headers=auth_header(actor))
        assert listing.status_code == 200
        assert listing.get_json()["total"] == 1
        detail = client.get(
            f"/api/v1/assessments/{created['id']}", headers=auth_header(actor)
        )
        assert detail.status_code == 200


def test_f51_draft_is_hidden_from_parent_and_unassigned_teacher(
    client, users, auth_header, assessment_scope
):
    assessment_id = create_assessment(
        client, users["manager"], auth_header, assessment_scope
    ).get_json()["id"]
    assert client.get(
        f"/api/v1/assessments/{assessment_id}",
        headers=auth_header(users["student"]),
    ).status_code == 403
    assert client.get(
        f"/api/v1/assessments/{assessment_id}",
        headers=auth_header(assessment_scope["outsider"]),
    ).status_code == 403


def test_f51_updates_draft_and_audits_changes(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = create_assessment(
        client, users["lecturer"], auth_header, assessment_scope
    ).get_json()["id"]
    response = client.patch(
        f"/api/v1/assessments/{assessment_id}",
        headers=auth_header(users["lecturer"]),
        json={
            "assessment_type": "END_OF_LEVEL",
            "title": "  Tổng kết Kid 1  ",
            "test_date": "2026-02-01",
            "score_max": 100,
        },
    )
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["title"] == "Tổng kết Kid 1"
    assert body["assessment_type"] == "END_OF_LEVEL"
    assert body["score_max"] == 100.0
    with app.app_context():
        audit = db.session.scalars(
            select(AuditLog).where(
                AuditLog.entity_name == "assessments",
                AuditLog.entity_id == assessment_id,
                AuditLog.action == "UPDATE",
            )
        ).one()
    assert audit.old_data["title"] == "Kiểm tra tháng 1"
    assert audit.new_data["title"] == "Tổng kết Kid 1"


def test_f51_rejects_noop_update(client, users, auth_header, assessment_scope):
    assessment_id = create_assessment(
        client, users["manager"], auth_header, assessment_scope
    ).get_json()["id"]
    response = client.patch(
        f"/api/v1/assessments/{assessment_id}",
        headers=auth_header(users["manager"]),
        json={"title": "Kiểm tra tháng 1"},
    )
    assert response.status_code == 409


def test_f51_filters_assessments(client, users, auth_header, assessment_scope):
    create_assessment(client, users["manager"], auth_header, assessment_scope)
    create_assessment(
        client,
        users["manager"],
        auth_header,
        assessment_scope,
        assessment_type="END_OF_LEVEL",
        title="Tổng kết",
        test_date="2026-03-01",
    )
    response = client.get(
        "/api/v1/assessments?assessment_type=END_OF_LEVEL&from_date=2026-02-01",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json()["total"] == 1
    assert response.get_json()["items"][0]["title"] == "Tổng kết"


def result_payload(*items):
    return {"items": list(items)}


def result_item(student_id, score=8.5, comment=None):
    item = {"student_id": student_id, "score": score}
    if comment is not None:
        item["comment"] = comment
    return item


def _create_assessment_id(client, users, auth_header, scope):
    return create_assessment(
        client, users["manager"], auth_header, scope
    ).get_json()["id"]


def test_f52_manager_records_results_atomically_with_audit(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(
            result_item(assessment_scope["students"][0], 8.25, "  Tiến bộ tốt  "),
            result_item(assessment_scope["students"][1], 10),
        ),
    )
    assert response.status_code == 200
    body = response.get_json()
    recorded = {
        item["student"]["id"]: item["result"] for item in body["items"]
    }
    assert recorded[assessment_scope["students"][0]]["score"] == 8.25
    assert recorded[assessment_scope["students"][0]]["comment"] == "Tiến bộ tốt"
    assert recorded[assessment_scope["students"][1]]["score"] == 10.0
    with app.app_context():
        audits = db.session.scalars(
            select(AuditLog).where(AuditLog.entity_name == "assessment_results")
        ).all()
    assert len(audits) == 2
    assert {audit.new_data["student_id"] for audit in audits} == set(
        assessment_scope["students"]
    )


@pytest.mark.parametrize("actor", ["manager", "lecturer"])
def test_f52_manager_and_assigned_teacher_can_record(
    client, users, auth_header, assessment_scope, actor
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users[actor]),
        json=result_payload(result_item(assessment_scope["students"][0])),
    )
    assert response.status_code == 200


def test_f52_unassigned_teacher_ta_and_parent_cannot_record(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    payload = result_payload(result_item(assessment_scope["students"][0]))
    for actor_id in (
        assessment_scope["outsider"],
        users["assistant"],
        users["student"],
    ):
        assert client.put(
            f"/api/v1/assessments/{assessment_id}/results",
            headers=auth_header(actor_id),
            json=payload,
        ).status_code == 403


def test_f52_requires_auth_before_validation(client):
    assert client.put("/api/v1/assessments/1/results", json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "items"),
        ({"items": []}, "items"),
        (result_payload(result_item(1), result_item(1, 7)), "items"),
        (result_payload(result_item(1, "8.5")), "score"),
        (result_payload(result_item(1, True)), "score"),
        (result_payload(result_item(1, None)), "score"),
        (result_payload(result_item("1", 8)), "student_id"),
        (result_payload(result_item(1, 8, "x" * 501)), "comment"),
    ],
)
def test_f52_validates_result_payload(
    client, users, auth_header, assessment_scope, payload, field
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in str(response.get_json()["errors"]["json"])


@pytest.mark.parametrize("score", [-0.01, 10.01, 100])
def test_f52_rejects_score_outside_assessment_scale(
    client, users, auth_header, assessment_scope, score
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(assessment_scope["students"][0], score)),
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["student_ids"] == [
        assessment_scope["students"][0]
    ]


def test_f52_rejects_student_outside_effective_enrollment(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    student_id = assessment_scope["students"][1]
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE class_enrollments SET left_date = '2026-01-15', status = 'DROPPED' "
                "WHERE class_id = :class_id AND student_id = :student_id"
            ),
            {"class_id": assessment_scope["class"], "student_id": student_id},
        )
        db.session.commit()
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(student_id)),
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["student_ids"] == [student_id]


def test_f52_rejects_student_at_wrong_level_on_test_date(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    student_id = assessment_scope["students"][1]
    with app.app_context():
        db.session.execute(
            text("UPDATE students SET current_level_id = :level WHERE id = :student"),
            {"level": assessment_scope["other_level"], "student": student_id},
        )
        db.session.commit()
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(student_id)),
    )
    assert response.status_code == 409


def test_f52_existing_result_rejects_entire_batch_without_partial_write(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    first_student, second_student = assessment_scope["students"]
    assert client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(first_student)),
    ).status_code == 200
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(first_student, 9), result_item(second_student, 7)),
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(
            text(
                "SELECT COUNT(*) FROM assessment_results "
                "WHERE assessment_id = :assessment AND student_id = :student"
            ),
            {"assessment": assessment_id, "student": second_student},
        ).scalar_one() == 0


def test_f52_rejects_results_for_published_assessment(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    with app.app_context():
        db.session.execute(
            text(
                """UPDATE assessments SET status = 'PUBLISHED', published_by = :actor,
                          published_at = SYSDATETIMEOFFSET() WHERE id = :id"""
            ),
            {"actor": users["manager"], "id": assessment_id},
        )
        db.session.commit()
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(assessment_scope["students"][0])),
    )
    assert response.status_code == 409


def test_f52_returns_not_found_for_missing_assessment(
    client, users, auth_header, assessment_scope
):
    response = client.put(
        "/api/v1/assessments/999999/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(assessment_scope["students"][0])),
    )
    assert response.status_code == 404


def xlsx_file(rows, headers=("student_code", "score", "comment")):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return stream


def preview_import(client, actor_id, auth_header, assessment_id, rows, *, mode="CREATE_ONLY", headers=None):
    return client.post(
        f"/api/v1/assessments/{assessment_id}/imports/preview",
        headers=auth_header(actor_id),
        data={
            "mode": mode,
            "file": (
                xlsx_file(rows, headers=headers) if headers else xlsx_file(rows),
                "results.xlsx",
            ),
        },
        content_type="multipart/form-data",
    )


def test_f53_previews_valid_excel_without_writing_results(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = preview_import(
        client,
        users["manager"],
        auth_header,
        assessment_id,
        [
            ("HR001", 8.5, "Tốt"),
            ("HR002", 9, None),
        ],
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["valid"] is True
    assert body["preview_id"] is not None
    assert body["total_rows"] == 2
    assert body["create_count"] == 2
    assert body["update_count"] == 0
    assert body["errors"] == []
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM assessment_results")).scalar_one() == 0
        assert db.session.execute(text("SELECT COUNT(*) FROM assessment_import_previews")).scalar_one() == 1


@pytest.mark.parametrize("actor", ["manager", "lecturer"])
def test_f53_manager_and_assigned_teacher_can_preview(
    client, users, auth_header, assessment_scope, actor
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert preview_import(
        client, users[actor], auth_header, assessment_id, [("HR001", 8, None)]
    ).status_code == 200


def test_f53_denies_outsider_ta_and_parent(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    for actor in (assessment_scope["outsider"], users["assistant"], users["student"]):
        assert preview_import(
            client, actor, auth_header, assessment_id, [("HR001", 8, None)]
        ).status_code == 403


def test_f53_requires_exact_header(client, users, auth_header, assessment_scope):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = preview_import(
        client,
        users["manager"],
        auth_header,
        assessment_id,
        [("HR001", 8, None)],
        headers=("code", "score", "comment"),
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("rows", "field"),
    [
        ([("HR001", 8, None), ("HR001", 9, None)], "student_code"),
        ([("UNKNOWN", 8, None)], "student_code"),
        ([("HR001", "8", None)], "score"),
        ([("HR001", 11, None)], "score"),
        ([(None, 8, None)], "student_code"),
        ([("HR001", 8, 123)], "comment"),
    ],
)
def test_f53_reports_each_invalid_excel_row(
    client, users, auth_header, assessment_scope, rows, field
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = preview_import(
        client, users["manager"], auth_header, assessment_id, rows
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["valid"] is False
    assert body["preview_id"] is None
    assert any(error["field"] == field for error in body["errors"])


def test_f53_create_only_rejects_existing_but_upsert_previews_update(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(assessment_scope["students"][0], 7)),
    ).status_code == 200
    create_only = preview_import(
        client, users["manager"], auth_header, assessment_id, [("HR001", 9, None)]
    ).get_json()
    assert create_only["valid"] is False
    upsert = preview_import(
        client,
        users["manager"],
        auth_header,
        assessment_id,
        [("HR001", 9, None)],
        mode="UPSERT",
    ).get_json()
    assert upsert["valid"] is True
    assert upsert["update_count"] == 1


def test_f53_rejects_missing_non_xlsx_and_invalid_mode(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    url = f"/api/v1/assessments/{assessment_id}/imports/preview"
    assert client.post(url, headers=auth_header(users["manager"]), data={}).status_code == 422
    assert client.post(
        url,
        headers=auth_header(users["manager"]),
        data={"file": (BytesIO(b"not excel"), "results.csv")},
        content_type="multipart/form-data",
    ).status_code == 422
    assert client.post(
        url,
        headers=auth_header(users["manager"]),
        data={"mode": "PARTIAL", "file": (xlsx_file([("HR001", 8, None)]), "r.xlsx")},
        content_type="multipart/form-data",
    ).status_code == 422


def _valid_preview_id(client, users, auth_header, assessment_scope, rows=None, mode="CREATE_ONLY"):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = preview_import(
        client,
        users["manager"],
        auth_header,
        assessment_id,
        rows or [("HR001", 8.5, "Tốt"), ("HR002", 9, None)],
        mode=mode,
    )
    assert response.status_code == 200
    assert response.get_json()["valid"] is True
    return assessment_id, response.get_json()["preview_id"]


def test_f54_confirm_imports_all_rows_atomically_and_audits(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, preview_id = _valid_preview_id(
        client, users, auth_header, assessment_scope
    )
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=auth_header(users["manager"]),
        json={"preview_id": preview_id},
    )
    assert response.status_code == 200, response.get_json()
    assert response.get_json() == {
        "preview_id": preview_id,
        "assessment_id": assessment_id,
        "created": 2,
        "updated": 0,
        "total": 2,
    }
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM assessment_results")).scalar_one() == 2
        assert db.session.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE entity_name = 'assessment_results'")
        ).scalar_one() == 2


def test_f54_cannot_confirm_same_preview_twice(
    client, users, auth_header, assessment_scope
):
    assessment_id, preview_id = _valid_preview_id(
        client, users, auth_header, assessment_scope, rows=[("HR001", 8, None)]
    )
    url = f"/api/v1/assessments/{assessment_id}/imports/confirm"
    payload = {"preview_id": preview_id}
    assert client.post(url, headers=auth_header(users["manager"]), json=payload).status_code == 200
    assert client.post(url, headers=auth_header(users["manager"]), json=payload).status_code == 409


def test_f54_preview_owner_only_can_confirm(
    client, users, auth_header, assessment_scope
):
    assessment_id, preview_id = _valid_preview_id(
        client, users, auth_header, assessment_scope, rows=[("HR001", 8, None)]
    )
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=auth_header(users["lecturer"]),
        json={"preview_id": preview_id},
    )
    assert response.status_code == 403


def test_f54_expired_preview_does_not_write_any_row(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, preview_id = _valid_preview_id(
        client, users, auth_header, assessment_scope
    )
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE assessment_import_previews "
                "SET created_at = DATEADD(minute, -60, SYSDATETIMEOFFSET()), "
                "expires_at = DATEADD(minute, -30, SYSDATETIMEOFFSET()) WHERE id = :id"
            ),
            {"id": preview_id},
        )
        db.session.commit()
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=auth_header(users["manager"]),
        json={"preview_id": preview_id},
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM assessment_results")).scalar_one() == 0


def test_f54_stale_create_only_preview_is_atomic(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, preview_id = _valid_preview_id(
        client, users, auth_header, assessment_scope
    )
    with app.app_context():
        db.session.execute(
            text(
                """INSERT INTO assessment_results
                    (assessment_id, student_id, score, recorded_by)
                   VALUES (:assessment, :student, 7, :actor)"""
            ),
            {
                "assessment": assessment_id,
                "student": assessment_scope["students"][0],
                "actor": users["manager"],
            },
        )
        db.session.commit()
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=auth_header(users["manager"]),
        json={"preview_id": preview_id},
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM assessment_results")).scalar_one() == 1


def test_f54_upsert_updates_with_history_and_creates_missing(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(assessment_scope["students"][0], 7, "Cũ")),
    ).status_code == 200
    preview = preview_import(
        client,
        users["manager"],
        auth_header,
        assessment_id,
        [("HR001", 9, "Mới"), ("HR002", 8, None)],
        mode="UPSERT",
    ).get_json()
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=auth_header(users["manager"]),
        json={"preview_id": preview["preview_id"]},
    )
    assert response.status_code == 200
    assert response.get_json()["created"] == 1
    assert response.get_json()["updated"] == 1
    with app.app_context():
        history = db.session.execute(
            text("SELECT old_score, new_score, old_comment, new_comment, reason FROM assessment_result_histories")
        ).mappings().one()
    assert history["old_score"] == Decimal("7.00")
    assert history["new_score"] == Decimal("9.00")
    assert history["old_comment"] == "Cũ"
    assert history["new_comment"] == "Mới"
    assert "Import Excel UPSERT" in history["reason"]


def _create_result(client, users, auth_header, scope, *, score=7, comment="Ban đầu"):
    assessment_id = _create_assessment_id(client, users, auth_header, scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
        json=result_payload(result_item(scope["students"][0], score, comment)),
    )
    assert response.status_code == 200
    item = next(
        item for item in response.get_json()["items"]
        if item["student"]["id"] == scope["students"][0]
    )
    return assessment_id, item["result"]


def test_f55_manager_updates_result_with_history_and_audit(
    app, client, users, auth_header, assessment_scope
):
    _, original = _create_result(client, users, auth_header, assessment_scope)
    response = client.patch(
        f"/api/v1/results/{original['id']}",
        headers=auth_header(users["manager"]),
        json={"score": 9.25, "comment": "  Đã đối soát  ", "reason": "  Chấm lại bài  "},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["score"] == 9.25
    assert body["comment"] == "Đã đối soát"
    assert body["recorded_by"] == original["recorded_by"]
    assert body["recorded_at"] == original["recorded_at"]
    with app.app_context():
        history = db.session.execute(
            text(
                """SELECT old_score, new_score, old_comment, new_comment,
                          changed_by, reason FROM assessment_result_histories
                   WHERE result_id = :id"""
            ),
            {"id": original["id"]},
        ).mappings().one()
        audit = db.session.scalars(
            select(AuditLog).where(
                AuditLog.entity_name == "assessment_results",
                AuditLog.entity_id == original["id"],
                AuditLog.action == "UPDATE",
            )
        ).one()
    assert history["old_score"] == Decimal("7.00")
    assert history["new_score"] == Decimal("9.25")
    assert history["reason"] == "Chấm lại bài"
    assert audit.old_data == {"score": "7.00", "comment": "Ban đầu"}
    assert audit.new_data["reason"] == "Chấm lại bài"


@pytest.mark.parametrize("actor", ["manager", "lecturer"])
def test_f55_manager_and_assigned_teacher_can_update(
    client, users, auth_header, assessment_scope, actor
):
    _, result = _create_result(client, users, auth_header, assessment_scope)
    response = client.patch(
        f"/api/v1/results/{result['id']}",
        headers=auth_header(users[actor]),
        json={"score": 8, "reason": "Điều chỉnh"},
    )
    assert response.status_code == 200


def test_f55_denies_outsider_ta_and_parent(
    client, users, auth_header, assessment_scope
):
    _, result = _create_result(client, users, auth_header, assessment_scope)
    for actor in (assessment_scope["outsider"], users["assistant"], users["student"]):
        assert client.patch(
            f"/api/v1/results/{result['id']}",
            headers=auth_header(actor),
            json={"score": 8, "reason": "Không có quyền"},
        ).status_code == 403


def test_f55_requires_auth_before_validation(client):
    assert client.patch("/api/v1/results/1", json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"score": 8}, "reason"),
        ({"score": 8, "reason": "   "}, "reason"),
        ({"reason": "Không có thay đổi"}, "score"),
        ({"score": "8", "reason": "Sai kiểu"}, "score"),
        ({"score": True, "reason": "Sai kiểu"}, "score"),
        ({"comment": "x" * 501, "reason": "Quá dài"}, "comment"),
        ({"score": 8, "reason": "x" * 501}, "reason"),
    ],
)
def test_f55_validates_update_payload(
    client, users, auth_header, assessment_scope, payload, field
):
    _, result = _create_result(client, users, auth_header, assessment_scope)
    response = client.patch(
        f"/api/v1/results/{result['id']}",
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in str(response.get_json()["errors"]["json"])


@pytest.mark.parametrize("score", [-1, 10.01])
def test_f55_rejects_score_outside_scale(
    client, users, auth_header, assessment_scope, score
):
    _, result = _create_result(client, users, auth_header, assessment_scope)
    response = client.patch(
        f"/api/v1/results/{result['id']}",
        headers=auth_header(users["manager"]),
        json={"score": score, "reason": "Ngoài thang"},
    )
    assert response.status_code == 409


def test_f55_rejects_noop_without_history(
    app, client, users, auth_header, assessment_scope
):
    _, result = _create_result(client, users, auth_header, assessment_scope)
    response = client.patch(
        f"/api/v1/results/{result['id']}",
        headers=auth_header(users["manager"]),
        json={"score": 7, "comment": "Ban đầu", "reason": "Không đổi"},
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM assessment_result_histories")
        ).scalar_one() == 0


def test_f55_can_correct_published_result(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, result = _create_result(client, users, auth_header, assessment_scope)
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE assessments SET status = 'PUBLISHED', published_by = :actor, "
                "published_at = SYSDATETIMEOFFSET() WHERE id = :id"
            ),
            {"actor": users["manager"], "id": assessment_id},
        )
        db.session.commit()
    response = client.patch(
        f"/api/v1/results/{result['id']}",
        headers=auth_header(users["manager"]),
        json={"score": 8.5, "reason": "Đính chính sau công bố"},
    )
    assert response.status_code == 200


def test_f55_returns_not_found(client, users, auth_header):
    response = client.patch(
        "/api/v1/results/999999",
        headers=auth_header(users["manager"]),
        json={"score": 8, "reason": "Không tồn tại"},
    )
    assert response.status_code == 404


def test_f56_manager_publishes_and_unpublishes_with_audit(
    app, client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    published = client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    )
    assert published.status_code == 200
    assert published.get_json()["status"] == "PUBLISHED"
    assert published.get_json()["published_by"] == users["manager"]
    assert published.get_json()["published_at"] is not None
    unpublished = client.post(
        f"/api/v1/assessments/{assessment_id}/unpublish",
        headers=auth_header(users["manager"]),
    )
    assert unpublished.status_code == 200
    assert unpublished.get_json()["status"] == "DRAFT"
    assert unpublished.get_json()["published_by"] is None
    assert unpublished.get_json()["published_at"] is None
    with app.app_context():
        audits = db.session.scalars(
            select(AuditLog).where(
                AuditLog.entity_name == "assessments",
                AuditLog.entity_id == assessment_id,
            ).order_by(AuditLog.id)
        ).all()
    assert [audit.action for audit in audits][-2:] == ["APPROVE", "UPDATE"]
    assert audits[-2].new_data == {"status": "PUBLISHED"}
    assert audits[-1].new_data == {"status": "DRAFT"}


@pytest.mark.parametrize("actor", ["manager", "lecturer"])
def test_f56_manager_and_assigned_teacher_can_publish_and_unpublish(
    client, users, auth_header, assessment_scope, actor
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users[actor]),
    ).status_code == 200
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/unpublish",
        headers=auth_header(users[actor]),
    ).status_code == 200


def test_f56_denies_outsider_ta_and_parent(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    for actor in (assessment_scope["outsider"], users["assistant"], users["student"]):
        assert client.post(
            f"/api/v1/assessments/{assessment_id}/publish",
            headers=auth_header(actor),
        ).status_code == 403


def test_f56_requires_authentication(client):
    assert client.post("/api/v1/assessments/1/publish").status_code == 401
    assert client.post("/api/v1/assessments/1/unpublish").status_code == 401


def test_f56_rejects_repeated_state_transition(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/unpublish",
        headers=auth_header(users["manager"]),
    ).status_code == 409
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 409


def test_f56_parent_sees_related_published_assessment_then_loses_access_after_unpublish(
    client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    detail_url = f"/api/v1/assessments/{assessment_id}"
    assert client.get(
        detail_url, headers=auth_header(users["student"])
    ).status_code == 403
    assert client.post(
        f"{detail_url}/publish", headers=auth_header(users["manager"])
    ).status_code == 200
    assert client.get(
        detail_url, headers=auth_header(users["student"])
    ).status_code == 200
    listing = client.get(
        "/api/v1/assessments", headers=auth_header(users["student"])
    )
    assert listing.status_code == 200
    assert listing.get_json()["total"] == 1
    assert client.post(
        f"{detail_url}/unpublish", headers=auth_header(users["manager"])
    ).status_code == 200
    assert client.get(
        detail_url, headers=auth_header(users["student"])
    ).status_code == 403


def test_f56_cannot_edit_assessment_metadata_after_publish(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.patch(
        f"/api/v1/assessments/{assessment_id}",
        headers=auth_header(users["manager"]),
        json={"title": "Không được sửa"},
    )
    assert response.status_code == 409


def test_f56_can_publish_assessment_with_missing_results(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200


def test_f56_returns_not_found(client, users, auth_header):
    assert client.post(
        "/api/v1/assessments/999999/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def test_f57_draft_roster_returns_null_for_missing_result(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.get(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert len(response.get_json()["items"]) == 2
    assert all(item["result"] is None for item in response.get_json()["items"])
    assert "score" not in response.get_json()["items"][0]


def test_f57_mixed_roster_keeps_missing_result_null_not_zero(
    client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    response = client.get(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["lecturer"]),
    )
    assert response.status_code == 200
    by_student = {
        item["student"]["id"]: item["result"] for item in response.get_json()["items"]
    }
    assert by_student[assessment_scope["students"][0]]["score"] == 7.0
    assert by_student[assessment_scope["students"][1]] is None


def test_f57_parent_sees_own_null_result_after_publication(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.get(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["student"]),
    )
    assert response.status_code == 200
    items = response.get_json()["items"]
    assert [item["student"]["id"] for item in items] == [
        assessment_scope["students"][0]
    ]
    assert items[0]["result"] is None


def test_f58_result_keeps_assessment_class_and_level_after_student_level_transfer(
    client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    student_id = assessment_scope["students"][0]
    transfer = client.post(
        f"/api/v1/students/{student_id}/level-transfers",
        headers=auth_header(users["manager"]),
        json={
            "new_level_id": assessment_scope["other_level"],
            "effective_date": "2026-02-15",
            "reason": "Hoàn thành cấp độ",
        },
    )
    assert transfer.status_code == 201
    history = client.get(
        f"/api/v1/students/{student_id}/learning-history",
        headers=auth_header(users["manager"]),
    )
    assert history.status_code == 200
    body = history.get_json()
    assert body["current_level"]["id"] == assessment_scope["other_level"]
    assert len(body["assessment_results"]) == 1
    result = body["assessment_results"][0]
    assert result["assessment"]["id"] == assessment_id
    assert result["class"]["id"] == assessment_scope["class"]
    assert result["level"]["id"] == assessment_scope["level"]
    assert result["score"] == 7.0


def test_f58_result_snapshot_is_not_rewritten_when_current_student_data_changes(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    student_id = assessment_scope["students"][0]
    with app.app_context():
        db.session.execute(
            text("UPDATE students SET current_level_id = :level WHERE id = :student"),
            {"level": assessment_scope["other_level"], "student": student_id},
        )
        db.session.commit()
    history = client.get(
        f"/api/v1/students/{student_id}/learning-history",
        headers=auth_header(users["manager"]),
    ).get_json()
    result = history["assessment_results"][0]
    assert result["assessment"]["id"] == assessment_id
    assert result["level"]["id"] == assessment_scope["level"]
    assert result["class"]["id"] == assessment_scope["class"]


def test_f59_student_results_returns_only_published_assessments(
    client, users, auth_header, assessment_scope
):
    published_id, _ = _create_result(client, users, auth_header, assessment_scope)
    draft_id = create_assessment(
        client,
        users["manager"],
        auth_header,
        assessment_scope,
        title="Bản nháp khác",
        test_date="2026-02-10",
    ).get_json()["id"]
    assert client.post(
        f"/api/v1/assessments/{published_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.get(
        f"/api/v1/students/{assessment_scope['students'][0]}/results",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["total"] == 1
    assert body["items"][0]["assessment"]["id"] == published_id
    assert body["items"][0]["assessment"]["id"] != draft_id
    assert body["items"][0]["result"]["score"] == 7.0


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant", "student"])
def test_f59_authorized_roles_view_published_student_results(
    client, users, auth_header, assessment_scope, actor
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.get(
        f"/api/v1/students/{assessment_scope['students'][0]}/results",
        headers=auth_header(users[actor]),
    )
    assert response.status_code == 200
    assert response.get_json()["total"] == 1


def test_f59_published_assessment_without_score_returns_null_result(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.get(
        f"/api/v1/students/{assessment_scope['students'][0]}/results",
        headers=auth_header(users["student"]),
    )
    assert response.status_code == 200
    assert response.get_json()["total"] == 1
    assert response.get_json()["items"][0]["result"] is None


def test_f59_unpublish_removes_assessment_from_student_results(
    client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(client, users, auth_header, assessment_scope)
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/unpublish",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    response = client.get(
        f"/api/v1/students/{assessment_scope['students'][0]}/results",
        headers=auth_header(users["student"]),
    )
    assert response.status_code == 200
    assert response.get_json()["items"] == []


def test_f59_denies_unassigned_teacher_and_unlinked_parent(
    client, users, auth_header, assessment_scope, create_user
):
    from app.models import RoleCode

    unlinked_parent = create_user("parent_result_other", RoleCode.STUDENT_PARENT, email=None)
    student_id = assessment_scope["students"][0]
    url = f"/api/v1/students/{student_id}/results"
    assert client.get(
        url, headers=auth_header(assessment_scope["outsider"])
    ).status_code == 403
    assert client.get(url, headers=auth_header(unlinked_parent)).status_code == 403


def test_f59_requires_authentication(client, assessment_scope):
    assert client.get(
        f"/api/v1/students/{assessment_scope['students'][0]}/results"
    ).status_code == 401


def test_f59_returns_not_found_for_missing_student(client, users, auth_header):
    assert client.get(
        "/api/v1/students/999999/results",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def test_f60_ta_is_forbidden_from_every_grading_mutation_before_validation(
    app, client, users, auth_header, assessment_scope
):
    assessment_id, result = _create_result(client, users, auth_header, assessment_scope)
    headers = auth_header(users["assistant"])
    assert client.post(
        "/api/v1/assessments", headers=headers, json={}
    ).status_code == 403
    assert client.patch(
        f"/api/v1/assessments/{assessment_id}", headers=headers, json={}
    ).status_code == 403
    assert client.put(
        f"/api/v1/assessments/{assessment_id}/results", headers=headers, json={}
    ).status_code == 403
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/imports/preview", headers=headers
    ).status_code == 403
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/imports/confirm",
        headers=headers,
        json={},
    ).status_code == 403
    assert client.patch(
        f"/api/v1/results/{result['id']}", headers=headers, json={}
    ).status_code == 403
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/publish", headers=headers
    ).status_code == 403
    assert client.post(
        f"/api/v1/assessments/{assessment_id}/unpublish", headers=headers
    ).status_code == 403
    with app.app_context():
        stored = db.session.execute(
            text("SELECT score, comment FROM assessment_results WHERE id = :id"),
            {"id": result["id"]},
        ).mappings().one()
        assessment_status = db.session.execute(
            text("SELECT status FROM assessments WHERE id = :id"),
            {"id": assessment_id},
        ).scalar_one()
    assert stored["score"] == Decimal("7.00")
    assert stored["comment"] == "Ban đầu"
    assert assessment_status == "DRAFT"


def test_f60_ta_cannot_bypass_role_with_valid_payload(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.put(
        f"/api/v1/assessments/{assessment_id}/results",
        headers=auth_header(users["assistant"]),
        json=result_payload(result_item(assessment_scope["students"][0], 10)),
    )
    assert response.status_code == 403


def test_f61_exports_assessment_excel_with_scores_nulls_and_safe_text(
    client, users, auth_header, assessment_scope
):
    assessment_id, _ = _create_result(
        client,
        users,
        auth_header,
        assessment_scope,
        score=8.5,
        comment="=HYPERLINK(\"https://example.com\")",
    )
    response = client.get(
        f"/api/v1/assessments/{assessment_id}/export",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert f"assessment-{assessment_id}-results.xlsx" in response.headers["Content-Disposition"]
    workbook = load_workbook(BytesIO(response.data), data_only=False)
    sheet = workbook.active
    assert sheet["A7"].value == "Mã học sinh"
    assert sheet["A8"].value == "HR001"
    assert sheet["C8"].value == 8.5
    assert sheet["D8"].value.startswith("'=")
    assert sheet["A9"].value == "HR002"
    assert sheet["C9"].value is None
    workbook.close()


@pytest.mark.parametrize("actor", ["manager", "lecturer"])
def test_f61_manager_and_assigned_teacher_can_export_assessment(
    client, users, auth_header, assessment_scope, actor
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    response = client.get(
        f"/api/v1/assessments/{assessment_id}/export",
        headers=auth_header(users[actor]),
    )
    assert response.status_code == 200


def test_f61_exports_all_assessments_of_class(
    client, users, auth_header, assessment_scope
):
    first_id, _ = _create_result(client, users, auth_header, assessment_scope)
    second_id = create_assessment(
        client,
        users["manager"],
        auth_header,
        assessment_scope,
        title="Tổng kết",
        assessment_type="END_OF_LEVEL",
        test_date="2026-03-01",
    ).get_json()["id"]
    response = client.get(
        f"/api/v1/classes/{assessment_scope['class']}/results/export",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.data), data_only=True)
    sheet = workbook.active
    values = list(sheet.values)
    titles = [row[0] for row in values[3:]]
    assert "Kiểm tra tháng 1" in titles
    assert "Tổng kết" in titles
    assert first_id != second_id
    workbook.close()


def test_f61_denies_outsider_ta_and_parent(
    client, users, auth_header, assessment_scope
):
    assessment_id = _create_assessment_id(client, users, auth_header, assessment_scope)
    for actor in (assessment_scope["outsider"], users["assistant"], users["student"]):
        assert client.get(
            f"/api/v1/assessments/{assessment_id}/export",
            headers=auth_header(actor),
        ).status_code == 403
        assert client.get(
            f"/api/v1/classes/{assessment_scope['class']}/results/export",
            headers=auth_header(actor),
        ).status_code == 403


def test_f61_requires_authentication(client):
    assert client.get("/api/v1/assessments/1/export").status_code == 401
    assert client.get("/api/v1/classes/1/results/export").status_code == 401


def test_f61_returns_not_found_for_missing_scope(client, users, auth_header):
    assert client.get(
        "/api/v1/assessments/999999/export",
        headers=auth_header(users["manager"]),
    ).status_code == 404
    assert client.get(
        "/api/v1/classes/999999/results/export",
        headers=auth_header(users["manager"]),
    ).status_code == 404
