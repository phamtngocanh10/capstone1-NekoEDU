"""SQL Server integrity checks for the additive Lecturer schema (0011)."""

from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.extensions import db
from app.models import StaffProfile


def _insert(table, values, *, identity=True):
    """OUTPUT INTO also works on tables that have enabled SQL Server triggers."""
    columns = ", ".join(f"[{name}]" for name in values)
    parameters = ", ".join(f":{name}" for name in values)
    output = "OUTPUT INSERTED.id INTO @ids" if identity else ""
    sql = f"INSERT INTO [{table}] ({columns}) {output} VALUES ({parameters});"
    if identity:
        sql = f"""SET NOCOUNT ON;
            BEGIN TRY
                DECLARE @ids TABLE (id BIGINT);
                {sql}
                SET NOCOUNT OFF;
                SELECT id FROM @ids;
            END TRY
            BEGIN CATCH
                SET NOCOUNT OFF;
                THROW;
            END CATCH;"""
    result = db.session.execute(text(sql), values)
    return result.scalar_one() if identity else None


@pytest.fixture
def lecturer_schema_data(app, users):
    with app.app_context():
        staff = {
            row.user_id: row.id for row in db.session.scalars(select(StaffProfile))
        }
        level = _insert("levels", {
            "code": "KID_1", "name": "Kid 1", "min_age": 6,
            "max_age": 8, "sort_order": 1,
        })
        room = _insert("rooms", {"code": "R-LS", "name": "Lecturer room", "capacity": 20})
        guardian = _insert("guardians", {
            "full_name": "Lecturer guardian", "phone": "0901000021", "relationship": "GUARDIAN",
        })
        courses, classes, students, assessments, periods, assignments = [], [], [], [], [], []
        for index in (1, 2):
            course = _insert("courses", {
                "course_code": f"C-LS{index}", "level_id": level,
                "name": f"Lecturer course {index}", "sessions_per_week": 2,
                "session_minutes": 90, "monthly_fee": 1000000,
            })
            cls = _insert("classes", {
                "class_code": f"CL-LS{index}", "name": f"Lecturer class {index}",
                "course_id": course, "lecturer_id": staff[users["lecturer"]],
                "assistant_id": staff[users["assistant"]], "default_room_id": room,
                "max_students": 20, "start_date": "2026-09-01", "end_date": "2026-12-31",
                "status": "ONGOING",
            })
            student = _insert("students", {
                "student_code": f"HL{index:03d}", "full_name": f"Lecturer student {index}",
                "date_of_birth": "2018-01-01", "guardian_id": guardian,
                "current_level_id": level, "enrolled_at": "2026-09-01",
            })
            _insert("class_enrollments", {
                "class_id": cls, "student_id": student, "enrolled_date": "2026-09-01",
            })
            assessment = _insert("assessments", {
                "class_id": cls, "level_id": level, "assessment_type": "MONTHLY",
                "title": "Legacy monthly assessment", "test_date": "2026-09-14",
                "score_min": 0, "score_max": 10, "created_by": users["manager"],
            })
            period = _insert("assessment_grading_periods", {
                "course_id": course, "term_name": "Midterm September 2026",
                "opens_at": "2026-09-10T00:00:00+00:00", "closes_at": "2026-09-16T23:59:00+00:00",
                "created_by": users["manager"],
            })
            _insert("assessment_workflows", {
                "assessment_id": assessment, "class_id": cls, "course_id": course,
                "period_id": period, "test_code": "MIDTERM", "display_label": "Kiểm tra giữa kỳ",
            }, identity=False)
            assignment = _insert("class_assistant_assignments", {
                "class_id": cls, "assistant_id": staff[users["assistant"]],
                "assigned_by": users["lecturer"], "assigned_at": "2026-09-01T00:00:00+00:00",
            })
            courses.append(course)
            classes.append(cls)
            students.append(student)
            assessments.append(assessment)
            periods.append(period)
            assignments.append(assignment)
        narrow_period = _insert("assessment_grading_periods", {
            "course_id": courses[0], "term_name": "Narrow period",
            "opens_at": "2026-09-12T00:00:00+00:00", "closes_at": "2026-09-14T00:00:00+00:00",
            "created_by": users["manager"],
        })
        db.session.commit()
    return {
        "users": users, "staff": staff, "courses": courses, "classes": classes,
        "students": students, "assessments": assessments, "periods": periods,
        "assignments": assignments, "narrow_period": narrow_period,
    }


def _skill_row(scope, **changes):
    values = {
        "assessment_id": scope["assessments"][0], "class_id": scope["classes"][0],
        "student_id": scope["students"][0], "listening_score": 7.5,
        "reading_score": 0, "speaking_score": 9, "writing_score": None,
        "note": "Incomplete draft", "recorded_by": scope["users"]["lecturer"],
        **changes,
    }
    _insert("assessment_skill_results", values, identity=False)


def _grant(scope, **changes):
    return _insert("assistant_grading_grants", {
        "assignment_id": scope["assignments"][0], "class_id": scope["classes"][0],
        "assessment_id": scope["assessments"][0],
        "opens_at": "2026-09-11T00:00:00+00:00", "closes_at": "2026-09-15T23:59:00+00:00",
        "granted_by": scope["users"]["lecturer"], "granted_at": "2026-09-10T00:00:00+00:00",
        **changes,
    })


def _submission(scope, grant, **changes):
    return _insert("assistant_grade_submissions", {
        "grant_id": grant, "assignment_id": scope["assignments"][0],
        "class_id": scope["classes"][0], "assessment_id": scope["assessments"][0],
        "submitted_by": scope["users"]["assistant"], "submitted_at": "2026-09-13T12:00:00+00:00",
        **changes,
    })


def test_stored_file_round_trips_actual_bytes(app, users):
    with app.app_context():
        content = b"%PDF-1.7\n\x00\xffdemo"
        file_id = _insert("stored_files", {
            "filename": "demo.pdf", "mime_type": "application/pdf",
            "byte_size": len(content), "content": content, "uploaded_by": users["lecturer"],
        })
        db.session.commit()
        row = db.session.execute(text("SELECT content, byte_size FROM stored_files WHERE id = :id"), {"id": file_id}).one()
        assert bytes(row.content) == content
        assert row.byte_size == len(content)


@pytest.mark.parametrize("case", ["empty", "wrong_length", "zero_length", "over_limit"])
def test_stored_file_rejects_empty_mismatched_or_oversize_bytes(app, users, case):
    content = b"x" * (20971521 if case == "over_limit" else 3)
    byte_size = len(content)
    if case == "empty":
        content, byte_size = b"", 0
    elif case == "wrong_length":
        byte_size += 1
    elif case == "zero_length":
        byte_size = 0
    with app.app_context():
        with pytest.raises(IntegrityError, match="ck_stored_files_size"):
            _insert("stored_files", {
                "filename": "demo.pdf", "mime_type": "application/pdf",
                "byte_size": byte_size, "content": content, "uploaded_by": users["lecturer"],
            })
        db.session.rollback()


def test_skill_draft_keeps_null_cells_and_leaves_legacy_scalar_contract(app, lecturer_schema_data):
    data = lecturer_schema_data
    with app.app_context():
        _skill_row(data)
        _insert("assessment_results", {
            "assessment_id": data["assessments"][0], "student_id": data["students"][0],
            "score": 10, "recorded_by": data["users"]["lecturer"],
        })
        db.session.commit()
        row = db.session.execute(text("SELECT listening_score, writing_score FROM assessment_skill_results")).one()
        assert row.listening_score == Decimal("7.5")
        assert row.writing_score is None
        assert db.session.execute(text("SELECT score FROM assessment_results")).scalar_one() == Decimal("10")


@pytest.mark.parametrize("column", ["listening_score", "reading_score", "speaking_score", "writing_score"])
@pytest.mark.parametrize("value", [-0.5, 9.5, 7.2])
def test_each_skill_rejects_out_of_range_or_non_half_step(app, lecturer_schema_data, column, value):
    with app.app_context():
        with pytest.raises(IntegrityError, match="ck_assessment_skills_"):
            _skill_row(lecturer_schema_data, **{column: value})
        db.session.rollback()


@pytest.mark.parametrize("mismatch", ["assessment_class", "student_enrollment"])
def test_skill_grade_cannot_mix_assessment_class_or_student_roster(app, lecturer_schema_data, mismatch):
    data = lecturer_schema_data
    changes = {"class_id": data["classes"][1]} if mismatch == "assessment_class" else {"student_id": data["students"][1]}
    with app.app_context():
        with pytest.raises(IntegrityError, match="fk_assessment_skills_"):
            _skill_row(data, **changes)
        db.session.rollback()


def test_student_comment_requires_enrollment_in_its_class(app, lecturer_schema_data):
    data = lecturer_schema_data
    values = {
        "class_id": data["classes"][0], "student_id": data["students"][0],
        "author_user_id": data["users"]["lecturer"], "content": "A" * 2000,
    }
    with app.app_context():
        _insert("student_comments", values)
        db.session.commit()
        with pytest.raises(IntegrityError, match="fk_student_comments_enrollment"):
            _insert("student_comments", {**values, "student_id": data["students"][1]})
        db.session.rollback()
        assert db.session.execute(text("SELECT COUNT(*) FROM student_comments")).scalar_one() == 1


@pytest.mark.parametrize("bound,value", [
    ("opens_at", "2026-09-09T00:00:00+00:00"),
    ("closes_at", "2026-09-17T00:00:00+00:00"),
])
def test_grant_insert_and_update_must_fit_manager_period(app, lecturer_schema_data, bound, value):
    data = lecturer_schema_data
    with app.app_context():
        with pytest.raises(DBAPIError, match="Assistant grant must fit"):
            _grant(data, **{bound: value})
        db.session.rollback()
        grant = _grant(data)
        db.session.commit()
        with pytest.raises(DBAPIError, match="Assistant grant must fit"):
            db.session.execute(text(f"UPDATE assistant_grading_grants SET {bound} = :value WHERE id = :id"), {"value": value, "id": grant})
        db.session.rollback()


@pytest.mark.parametrize("bound,value", [
    ("opens_at", "2026-09-12T00:00:00+00:00"),
    ("closes_at", "2026-09-14T00:00:00+00:00"),
])
def test_editing_parent_period_cannot_strand_active_grant(app, lecturer_schema_data, bound, value):
    data = lecturer_schema_data
    with app.app_context():
        _grant(data)
        db.session.commit()
        with pytest.raises(DBAPIError, match="Grading period would invalidate"):
            db.session.execute(text(f"UPDATE assessment_grading_periods SET {bound} = :value WHERE id = :id"), {"value": value, "id": data["periods"][0]})
        db.session.rollback()


@pytest.mark.parametrize("new_period", ["narrow_period", None])
def test_editing_assessment_workflow_period_cannot_strand_grant(app, lecturer_schema_data, new_period):
    data = lecturer_schema_data
    with app.app_context():
        _grant(data)
        db.session.commit()
        with pytest.raises(DBAPIError, match="Assessment period would invalidate"):
            db.session.execute(text("UPDATE assessment_workflows SET period_id = :period WHERE assessment_id = :id"), {
                "period": data[new_period] if new_period else None, "id": data["assessments"][0],
            })
        db.session.rollback()


def test_workflow_cannot_use_another_courses_period(app, lecturer_schema_data):
    data = lecturer_schema_data
    with app.app_context():
        with pytest.raises(IntegrityError, match="fk_assessment_workflows_period"):
            db.session.execute(text("UPDATE assessment_workflows SET period_id = :period WHERE assessment_id = :id"), {
                "period": data["periods"][1], "id": data["assessments"][0],
            })
        db.session.rollback()


def test_grant_cannot_mix_assignment_and_assessment_classes(app, lecturer_schema_data):
    data = lecturer_schema_data
    with app.app_context():
        with pytest.raises(IntegrityError, match="fk_assistant_grants_assignment"):
            _grant(data, assignment_id=data["assignments"][1])
        db.session.rollback()


def test_grant_linked_to_request_requires_approval(app, lecturer_schema_data):
    data = lecturer_schema_data
    with app.app_context():
        request = _insert("assistant_grading_requests", {
            "assignment_id": data["assignments"][0], "class_id": data["classes"][0],
            "assessment_id": data["assessments"][0], "requested_by": data["users"]["assistant"],
            "requested_at": "2026-09-10T00:00:00+00:00",
        })
        db.session.commit()
        with pytest.raises(DBAPIError, match="request must be approved"):
            _grant(data, request_id=request)
        db.session.rollback()
        db.session.execute(text("""UPDATE assistant_grading_requests SET status = 'APPROVED',
            reviewed_by = :actor, reviewed_at = '2026-09-10T01:00:00+00:00' WHERE id = :id"""),
            {"actor": data["users"]["lecturer"], "id": request})
        _grant(data, request_id=request)
        db.session.commit()


@pytest.mark.parametrize("change", ["owner", "before_window", "after_window"])
def test_submission_insert_and_update_require_assistant_and_valid_timestamp(app, lecturer_schema_data, change):
    data = lecturer_schema_data
    changes = {
        "owner": {"submitted_by": data["users"]["manager"]},
        "before_window": {"submitted_at": "2026-09-10T12:00:00+00:00"},
        "after_window": {"submitted_at": "2026-09-16T12:00:00+00:00"},
    }[change]
    with app.app_context():
        grant = _grant(data)
        db.session.commit()
        with pytest.raises(DBAPIError, match="Submission must belong"):
            _submission(data, grant, **changes)
        db.session.rollback()
        submission = _submission(data, grant)
        db.session.commit()
        column, value = next(iter(changes.items()))
        with pytest.raises(DBAPIError, match="Submission must belong"):
            db.session.execute(text(f"UPDATE assistant_grade_submissions SET {column} = :value WHERE id = :id"), {"value": value, "id": submission})
        db.session.rollback()


@pytest.mark.parametrize("owner", ["grant", "assignment"])
def test_submissions_after_revocation_are_rejected(app, lecturer_schema_data, owner):
    data = lecturer_schema_data
    with app.app_context():
        grant = _grant(data)
        table = "assistant_grading_grants" if owner == "grant" else "class_assistant_assignments"
        row_id = grant if owner == "grant" else data["assignments"][0]
        db.session.execute(text(f"UPDATE {table} SET revoked_by = :actor, revoked_at = '2026-09-12T00:00:00+00:00' WHERE id = :id"), {"actor": data["users"]["lecturer"], "id": row_id})
        db.session.commit()
        with pytest.raises(DBAPIError, match="Submission must belong"):
            _submission(data, grant)
        db.session.rollback()


@pytest.mark.parametrize("change", ["opens_at", "closes_at", "revocation"])
def test_grant_parent_update_preserves_previously_valid_submissions(app, lecturer_schema_data, change):
    data = lecturer_schema_data
    with app.app_context():
        grant = _grant(data)
        _submission(data, grant)
        db.session.commit()
        if change == "revocation":
            clause = "revoked_by = :actor, revoked_at = '2026-09-13T11:59:00+00:00'"
        else:
            clause = f"{change} = :value"
        value = "2026-09-13T13:00:00+00:00" if change == "opens_at" else "2026-09-13T11:59:00+00:00"
        with pytest.raises(DBAPIError, match="Grant update would invalidate"):
            db.session.execute(text(f"UPDATE assistant_grading_grants SET {clause} WHERE id = :id"), {"actor": data["users"]["lecturer"], "value": value, "id": grant})
        db.session.rollback()


@pytest.mark.parametrize("change", ["owner", "assigned_at", "revocation"])
def test_assignment_parent_update_preserves_submission_owner_and_effective_date(app, lecturer_schema_data, change):
    data = lecturer_schema_data
    with app.app_context():
        grant = _grant(data)
        _submission(data, grant)
        db.session.commit()
        clauses = {
            "owner": "assistant_id = :other_staff",
            "assigned_at": "assigned_at = '2026-09-14T00:00:00+00:00'",
            "revocation": "revoked_by = :actor, revoked_at = '2026-09-13T11:59:00+00:00'",
        }
        with pytest.raises(DBAPIError, match="Assignment update would invalidate"):
            db.session.execute(text(f"UPDATE class_assistant_assignments SET {clauses[change]} WHERE id = :id"), {
                "other_staff": data["staff"][data["users"]["lecturer"]],
                "actor": data["users"]["lecturer"], "id": data["assignments"][0],
            })
        db.session.rollback()


def test_historical_submission_can_be_reviewed_after_grant_expiry_and_later_revocation(app, lecturer_schema_data):
    data = lecturer_schema_data
    with app.app_context():
        grant = _grant(data)
        submission = _submission(data, grant)
        for table, row_id in (("assistant_grading_grants", grant), ("class_assistant_assignments", data["assignments"][0])):
            db.session.execute(text(f"UPDATE {table} SET revoked_by = :actor, revoked_at = '2026-09-14T00:00:00+00:00' WHERE id = :id"), {"actor": data["users"]["lecturer"], "id": row_id})
        db.session.execute(text("""UPDATE assistant_grade_submissions SET status = 'APPROVED',
            reviewed_by = :actor, reviewed_at = '2026-11-08T00:00:00+00:00' WHERE id = :id"""),
            {"actor": data["users"]["lecturer"], "id": submission})
        db.session.commit()
        assert db.session.execute(text("SELECT status FROM assistant_grade_submissions WHERE id = :id"), {"id": submission}).scalar_one() == "APPROVED"


@pytest.mark.parametrize("mismatch", ["student", "assessment"])
def test_submission_rows_cannot_mix_student_roster_or_assessment_scope(app, lecturer_schema_data, mismatch):
    data = lecturer_schema_data
    with app.app_context():
        grant = _grant(data)
        submission = _submission(data, grant)
        db.session.commit()
        row = {
            "submission_id": submission, "class_id": data["classes"][0],
            "assessment_id": data["assessments"][0], "student_id": data["students"][0],
            "listening_score": 7.5, "reading_score": 8, "speaking_score": 6, "writing_score": 6.5,
        }
        _insert("assistant_grade_submission_rows", row, identity=False)
        db.session.commit()
        with pytest.raises(IntegrityError, match="fk_assistant_submission_rows_"):
            if mismatch == "assessment":
                db.session.execute(text("""UPDATE assistant_grade_submission_rows SET assessment_id = :assessment
                    WHERE submission_id = :submission AND student_id = :student"""), {
                    "assessment": data["assessments"][1], "submission": submission,
                    "student": data["students"][0],
                })
            else:
                _insert("assistant_grade_submission_rows", {**row, "student_id": data["students"][1]}, identity=False)
        db.session.rollback()
