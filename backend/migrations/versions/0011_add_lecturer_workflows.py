"""Persist Lecturer documents, comments, skill grades and assistant review flows.

Revision ID: 0011
Revises: 0010

The existing scalar assessment/result contract stays unchanged. The optional
workflow and skill tables support the FE's four-score draft independently; an
API integration can publish its computed aggregate through the legacy service.
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE UNIQUE INDEX uq_classes_id_course_id ON classes(id, course_id);
        CREATE UNIQUE INDEX uq_assessments_id_class_id ON assessments(id, class_id);

        CREATE TABLE stored_files (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            filename NVARCHAR(255) NOT NULL,
            mime_type NVARCHAR(100) NOT NULL,
            byte_size BIGINT NOT NULL,
            content VARBINARY(MAX) NOT NULL,
            sha256 CHAR(64),
            uploaded_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_stored_files_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id),
            CONSTRAINT ck_stored_files_filename CHECK (LEN(LTRIM(RTRIM(filename))) > 0),
            CONSTRAINT ck_stored_files_mime_type CHECK (LEN(LTRIM(RTRIM(mime_type))) > 0),
            CONSTRAINT ck_stored_files_size CHECK (
                byte_size BETWEEN 1 AND 20971520 AND DATALENGTH(content) = byte_size
            ),
            CONSTRAINT ck_stored_files_sha256 CHECK (
                sha256 IS NULL OR (LEN(sha256) = 64 AND
                    sha256 COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-fA-F]%')
            )
        );
        CREATE INDEX ix_stored_files_uploaded_by ON stored_files(uploaded_by);

        CREATE TABLE assessment_grading_periods (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            course_id BIGINT NOT NULL,
            term_name NVARCHAR(150) NOT NULL,
            opens_at DATETIMEOFFSET(6) NOT NULL,
            closes_at DATETIMEOFFSET(6) NOT NULL,
            release_mode NVARCHAR(20) NOT NULL DEFAULT N'ON_CONFIRMATION',
            publishes_at DATETIMEOFFSET(6),
            remind_before_deadline BIT NOT NULL DEFAULT 1,
            auto_lock BIT NOT NULL DEFAULT 1,
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_assessment_periods_scope UNIQUE (id, course_id),
            CONSTRAINT uq_assessment_periods_term UNIQUE (course_id, term_name, opens_at),
            CONSTRAINT fk_assessment_periods_course FOREIGN KEY (course_id) REFERENCES courses(id),
            CONSTRAINT fk_assessment_periods_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_assessment_periods_term CHECK (LEN(LTRIM(RTRIM(term_name))) > 0),
            CONSTRAINT ck_assessment_periods_window CHECK (closes_at > opens_at),
            CONSTRAINT ck_assessment_periods_release CHECK (
                (release_mode = 'ON_CONFIRMATION' AND publishes_at IS NULL) OR
                (release_mode = 'SCHEDULED' AND publishes_at IS NOT NULL AND publishes_at >= opens_at)
            )
        );

        CREATE TABLE assessment_workflows (
            assessment_id BIGINT PRIMARY KEY,
            class_id BIGINT NOT NULL,
            course_id BIGINT NOT NULL,
            period_id BIGINT,
            test_code NVARCHAR(40),
            display_label NVARCHAR(150),
            review_state NVARCHAR(20) NOT NULL DEFAULT N'DRAFT',
            confirmed_by BIGINT,
            confirmed_at DATETIMEOFFSET(6),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            version ROWVERSION NOT NULL,
            CONSTRAINT uq_assessment_workflows_scope UNIQUE (assessment_id, class_id),
            CONSTRAINT fk_assessment_workflows_assessment FOREIGN KEY (assessment_id, class_id)
                REFERENCES assessments(id, class_id),
            CONSTRAINT fk_assessment_workflows_course FOREIGN KEY (class_id, course_id)
                REFERENCES classes(id, course_id),
            CONSTRAINT fk_assessment_workflows_period FOREIGN KEY (period_id, course_id)
                REFERENCES assessment_grading_periods(id, course_id),
            CONSTRAINT fk_assessment_workflows_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id),
            CONSTRAINT ck_assessment_workflows_review CHECK (
                (review_state IN ('DRAFT', 'PENDING') AND confirmed_by IS NULL AND confirmed_at IS NULL) OR
                (review_state = 'CONFIRMED' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
            ),
            CONSTRAINT ck_assessment_workflows_code CHECK (test_code IS NULL OR LEN(LTRIM(RTRIM(test_code))) > 0),
            CONSTRAINT ck_assessment_workflows_label CHECK (display_label IS NULL OR LEN(LTRIM(RTRIM(display_label))) > 0)
        );
        CREATE INDEX ix_assessment_workflows_period ON assessment_workflows(period_id, course_id);
        CREATE INDEX ix_assessment_workflows_class ON assessment_workflows(class_id, course_id);

        CREATE TABLE assessment_skill_results (
            assessment_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            listening_score DECIMAL(3,1),
            reading_score DECIMAL(3,1),
            speaking_score DECIMAL(3,1),
            writing_score DECIMAL(3,1),
            note NVARCHAR(500),
            recorded_by BIGINT NOT NULL,
            recorded_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            version ROWVERSION NOT NULL,
            CONSTRAINT pk_assessment_skill_results PRIMARY KEY (assessment_id, student_id),
            CONSTRAINT fk_assessment_skills_assessment FOREIGN KEY (assessment_id, class_id)
                REFERENCES assessments(id, class_id),
            CONSTRAINT fk_assessment_skills_enrollment FOREIGN KEY (class_id, student_id)
                REFERENCES class_enrollments(class_id, student_id),
            CONSTRAINT fk_assessment_skills_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id),
            CONSTRAINT ck_assessment_skills_listening CHECK (listening_score BETWEEN 0 AND 9 AND listening_score * 2 = FLOOR(listening_score * 2)),
            CONSTRAINT ck_assessment_skills_reading CHECK (reading_score BETWEEN 0 AND 9 AND reading_score * 2 = FLOOR(reading_score * 2)),
            CONSTRAINT ck_assessment_skills_speaking CHECK (speaking_score BETWEEN 0 AND 9 AND speaking_score * 2 = FLOOR(speaking_score * 2)),
            CONSTRAINT ck_assessment_skills_writing CHECK (writing_score BETWEEN 0 AND 9 AND writing_score * 2 = FLOOR(writing_score * 2))
        );
        CREATE INDEX ix_assessment_skill_results_student ON assessment_skill_results(student_id);
        CREATE INDEX ix_assessment_skill_results_enrollment ON assessment_skill_results(class_id, student_id);

        CREATE TABLE class_assistant_assignments (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            class_id BIGINT NOT NULL,
            assistant_id BIGINT NOT NULL,
            can_attend BIT NOT NULL DEFAULT 1,
            can_view_roster BIT NOT NULL DEFAULT 1,
            can_upload_documents BIT NOT NULL DEFAULT 0,
            assigned_by BIGINT NOT NULL,
            assigned_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            revoked_by BIGINT,
            revoked_at DATETIMEOFFSET(6),
            CONSTRAINT uq_assistant_assignments_class_staff UNIQUE (class_id, assistant_id),
            CONSTRAINT uq_assistant_assignments_scope UNIQUE (id, class_id),
            CONSTRAINT fk_assistant_assignments_class FOREIGN KEY (class_id) REFERENCES classes(id),
            CONSTRAINT fk_assistant_assignments_staff FOREIGN KEY (assistant_id) REFERENCES staff_profiles(id),
            CONSTRAINT fk_assistant_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
            CONSTRAINT fk_assistant_assignments_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id),
            CONSTRAINT ck_assistant_assignments_revocation CHECK (
                (revoked_by IS NULL AND revoked_at IS NULL) OR
                (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revoked_at >= assigned_at)
            )
        );
        CREATE INDEX ix_assistant_assignments_staff ON class_assistant_assignments(assistant_id);

        CREATE TABLE assistant_grading_requests (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            assignment_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            assessment_id BIGINT NOT NULL,
            requested_by BIGINT NOT NULL,
            requested_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            request_note NVARCHAR(500),
            status NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
            reviewed_by BIGINT,
            reviewed_at DATETIMEOFFSET(6),
            review_note NVARCHAR(500),
            CONSTRAINT uq_assistant_requests_scope UNIQUE (id, assignment_id, class_id, assessment_id),
            CONSTRAINT fk_assistant_requests_assignment FOREIGN KEY (assignment_id, class_id)
                REFERENCES class_assistant_assignments(id, class_id),
            CONSTRAINT fk_assistant_requests_assessment FOREIGN KEY (assessment_id, class_id)
                REFERENCES assessment_workflows(assessment_id, class_id),
            CONSTRAINT fk_assistant_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
            CONSTRAINT fk_assistant_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),
            CONSTRAINT ck_assistant_requests_review CHECK (
                (status IN ('PENDING', 'CANCELLED') AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
                (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_at >= requested_at)
            )
        );
        CREATE UNIQUE INDEX uq_assistant_requests_pending ON assistant_grading_requests(assignment_id, assessment_id) WHERE status = N'PENDING';
        CREATE INDEX ix_assistant_requests_assessment ON assistant_grading_requests(assessment_id, class_id);

        CREATE TABLE assistant_grading_grants (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            assignment_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            assessment_id BIGINT NOT NULL,
            request_id BIGINT,
            opens_at DATETIMEOFFSET(6) NOT NULL,
            closes_at DATETIMEOFFSET(6) NOT NULL,
            granted_by BIGINT NOT NULL,
            granted_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            revoked_by BIGINT,
            revoked_at DATETIMEOFFSET(6),
            CONSTRAINT uq_assistant_grants_scope UNIQUE (id, assignment_id, class_id, assessment_id),
            CONSTRAINT fk_assistant_grants_assignment FOREIGN KEY (assignment_id, class_id)
                REFERENCES class_assistant_assignments(id, class_id),
            CONSTRAINT fk_assistant_grants_assessment FOREIGN KEY (assessment_id, class_id)
                REFERENCES assessment_workflows(assessment_id, class_id),
            CONSTRAINT fk_assistant_grants_request FOREIGN KEY (request_id, assignment_id, class_id, assessment_id)
                REFERENCES assistant_grading_requests(id, assignment_id, class_id, assessment_id),
            CONSTRAINT fk_assistant_grants_granted_by FOREIGN KEY (granted_by) REFERENCES users(id),
            CONSTRAINT fk_assistant_grants_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id),
            CONSTRAINT ck_assistant_grants_window CHECK (closes_at > opens_at),
            CONSTRAINT ck_assistant_grants_revocation CHECK (
                (revoked_by IS NULL AND revoked_at IS NULL) OR
                (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revoked_at >= granted_at)
            )
        );
        CREATE UNIQUE INDEX uq_assistant_grants_active ON assistant_grading_grants(assignment_id, assessment_id) WHERE revoked_at IS NULL;
        CREATE UNIQUE INDEX uq_assistant_grants_request ON assistant_grading_grants(request_id) WHERE request_id IS NOT NULL;
        CREATE INDEX ix_assistant_grants_assessment ON assistant_grading_grants(assessment_id, class_id);

        CREATE TABLE assistant_grade_submissions (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            grant_id BIGINT NOT NULL,
            assignment_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            assessment_id BIGINT NOT NULL,
            submitted_by BIGINT NOT NULL,
            submitted_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            status NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
            reviewed_by BIGINT,
            reviewed_at DATETIMEOFFSET(6),
            return_reason NVARCHAR(500),
            CONSTRAINT uq_assistant_submissions_scope UNIQUE (id, class_id, assessment_id),
            CONSTRAINT fk_assistant_submissions_grant FOREIGN KEY (grant_id, assignment_id, class_id, assessment_id)
                REFERENCES assistant_grading_grants(id, assignment_id, class_id, assessment_id),
            CONSTRAINT fk_assistant_submissions_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id),
            CONSTRAINT fk_assistant_submissions_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),
            CONSTRAINT ck_assistant_submissions_review CHECK (
                (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND return_reason IS NULL) OR
                (status = 'APPROVED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_at >= submitted_at AND return_reason IS NULL) OR
                (status = 'RETURNED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_at >= submitted_at AND return_reason IS NOT NULL AND LEN(LTRIM(RTRIM(return_reason))) > 0)
            )
        );
        CREATE UNIQUE INDEX uq_assistant_submissions_pending ON assistant_grade_submissions(grant_id) WHERE status = N'PENDING';
        CREATE INDEX ix_assistant_submissions_assessment ON assistant_grade_submissions(assessment_id, class_id);

        CREATE TABLE assistant_grade_submission_rows (
            submission_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            assessment_id BIGINT NOT NULL,
            listening_score DECIMAL(3,1) NOT NULL,
            reading_score DECIMAL(3,1) NOT NULL,
            speaking_score DECIMAL(3,1) NOT NULL,
            writing_score DECIMAL(3,1) NOT NULL,
            note NVARCHAR(500),
            CONSTRAINT pk_assistant_submission_rows PRIMARY KEY (submission_id, student_id),
            CONSTRAINT fk_assistant_submission_rows_submission FOREIGN KEY (submission_id, class_id, assessment_id)
                REFERENCES assistant_grade_submissions(id, class_id, assessment_id),
            CONSTRAINT fk_assistant_submission_rows_enrollment FOREIGN KEY (class_id, student_id)
                REFERENCES class_enrollments(class_id, student_id),
            CONSTRAINT ck_assistant_submission_rows_listening CHECK (listening_score BETWEEN 0 AND 9 AND listening_score * 2 = FLOOR(listening_score * 2)),
            CONSTRAINT ck_assistant_submission_rows_reading CHECK (reading_score BETWEEN 0 AND 9 AND reading_score * 2 = FLOOR(reading_score * 2)),
            CONSTRAINT ck_assistant_submission_rows_speaking CHECK (speaking_score BETWEEN 0 AND 9 AND speaking_score * 2 = FLOOR(speaking_score * 2)),
            CONSTRAINT ck_assistant_submission_rows_writing CHECK (writing_score BETWEEN 0 AND 9 AND writing_score * 2 = FLOOR(writing_score * 2))
        );
        CREATE INDEX ix_assistant_submission_rows_enrollment ON assistant_grade_submission_rows(class_id, student_id);

        CREATE TABLE teaching_documents (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            file_id BIGINT NOT NULL,
            display_name NVARCHAR(255) NOT NULL,
            file_extension VARCHAR(5) NOT NULL,
            uploaded_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            deleted_by BIGINT,
            deleted_at DATETIMEOFFSET(6),
            CONSTRAINT uq_teaching_documents_file UNIQUE (file_id),
            CONSTRAINT fk_teaching_documents_file FOREIGN KEY (file_id) REFERENCES stored_files(id),
            CONSTRAINT fk_teaching_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id),
            CONSTRAINT fk_teaching_documents_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
            CONSTRAINT ck_teaching_documents_name CHECK (LEN(LTRIM(RTRIM(display_name))) > 0),
            CONSTRAINT ck_teaching_documents_extension CHECK (file_extension IN ('pdf', 'docx', 'pptx', 'mp3')),
            CONSTRAINT ck_teaching_documents_deletion CHECK (
                (deleted_by IS NULL AND deleted_at IS NULL) OR
                (deleted_by IS NOT NULL AND deleted_at IS NOT NULL AND deleted_at >= created_at)
            )
        );
        CREATE INDEX ix_teaching_documents_uploaded_by ON teaching_documents(uploaded_by, deleted_at);

        CREATE TABLE teaching_document_classes (
            document_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            shared_by BIGINT NOT NULL,
            shared_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT pk_teaching_document_classes PRIMARY KEY (document_id, class_id),
            CONSTRAINT fk_teaching_document_classes_document FOREIGN KEY (document_id) REFERENCES teaching_documents(id),
            CONSTRAINT fk_teaching_document_classes_class FOREIGN KEY (class_id) REFERENCES classes(id),
            CONSTRAINT fk_teaching_document_classes_shared_by FOREIGN KEY (shared_by) REFERENCES users(id)
        );
        CREATE INDEX ix_teaching_document_classes_class ON teaching_document_classes(class_id);

        CREATE TABLE teaching_document_events (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            document_id BIGINT NOT NULL,
            actor_user_id BIGINT NOT NULL,
            class_id BIGINT,
            action NVARCHAR(20) NOT NULL,
            detail NVARCHAR(500),
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_teaching_document_events_document FOREIGN KEY (document_id) REFERENCES teaching_documents(id),
            CONSTRAINT fk_teaching_document_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
            CONSTRAINT fk_teaching_document_events_class FOREIGN KEY (class_id) REFERENCES classes(id),
            CONSTRAINT ck_teaching_document_events_action CHECK (action IN ('UPLOAD', 'DOWNLOAD', 'RENAME', 'SHARE', 'UNSHARE', 'DELETE'))
        );
        CREATE INDEX ix_teaching_document_events_document ON teaching_document_events(document_id, created_at);

        CREATE TABLE student_comments (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            class_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            author_user_id BIGINT NOT NULL,
            content NVARCHAR(2000) NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_student_comments_enrollment FOREIGN KEY (class_id, student_id)
                REFERENCES class_enrollments(class_id, student_id),
            CONSTRAINT fk_student_comments_author FOREIGN KEY (author_user_id) REFERENCES users(id),
            CONSTRAINT ck_student_comments_content CHECK (LEN(LTRIM(RTRIM(content))) > 0)
        );
        CREATE INDEX ix_student_comments_class_student ON student_comments(class_id, student_id, created_at);
        CREATE INDEX ix_student_comments_student ON student_comments(student_id);
        """
    )
    _create_window_triggers()


def _create_window_triggers():
    # Cross-row date bounds cannot be expressed in a SQL Server CHECK. Keep
    # guards on both sides so editing a period cannot invalidate active grants.
    op.execute(
        """
        CREATE TRIGGER trg_assistant_grants_window ON assistant_grading_grants
        AFTER INSERT, UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS (
                SELECT 1 FROM inserted g
                JOIN assessment_workflows w ON w.assessment_id = g.assessment_id
                LEFT JOIN assessment_grading_periods p ON p.id = w.period_id
                WHERE g.revoked_at IS NULL AND (p.id IS NULL OR
                    g.opens_at < p.opens_at OR g.closes_at > p.closes_at)
            )
                THROW 51011, 'Assistant grant must fit its assessment grading period.', 1;
            IF EXISTS (
                SELECT 1 FROM inserted g
                JOIN assistant_grading_requests r ON r.id = g.request_id
                WHERE r.status <> 'APPROVED'
            )
                THROW 51012, 'Assistant grant request must be approved.', 1;
            IF EXISTS (
                SELECT 1 FROM inserted g
                JOIN assistant_grade_submissions s ON s.grant_id = g.id
                WHERE s.submitted_at < g.opens_at OR s.submitted_at > g.closes_at OR
                    (g.revoked_at IS NOT NULL AND s.submitted_at >= g.revoked_at)
            )
                THROW 51016, 'Grant update would invalidate a stored submission.', 1;
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_assessment_periods_grants ON assessment_grading_periods
        AFTER UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS (
                SELECT 1 FROM inserted p
                JOIN assessment_workflows w ON w.period_id = p.id
                JOIN assistant_grading_grants g ON g.assessment_id = w.assessment_id
                WHERE g.revoked_at IS NULL AND
                    (g.opens_at < p.opens_at OR g.closes_at > p.closes_at)
            )
                THROW 51013, 'Grading period would invalidate an active assistant grant.', 1;
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_assessment_workflows_grants ON assessment_workflows
        AFTER UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS (
                SELECT 1 FROM inserted w
                JOIN assistant_grading_grants g ON g.assessment_id = w.assessment_id
                LEFT JOIN assessment_grading_periods p ON p.id = w.period_id
                WHERE g.revoked_at IS NULL AND (p.id IS NULL OR
                    g.opens_at < p.opens_at OR g.closes_at > p.closes_at)
            )
                THROW 51014, 'Assessment period would invalidate an active assistant grant.', 1;
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_assistant_submissions_window ON assistant_grade_submissions
        AFTER INSERT, UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS (
                SELECT 1 FROM inserted s
                JOIN assistant_grading_grants g ON g.id = s.grant_id
                JOIN class_assistant_assignments ca ON ca.id = s.assignment_id
                JOIN staff_profiles sp ON sp.id = ca.assistant_id
                WHERE s.submitted_by <> sp.user_id OR
                    s.submitted_at < ca.assigned_at OR
                    s.submitted_at < g.opens_at OR s.submitted_at > g.closes_at OR
                    (g.revoked_at IS NOT NULL AND s.submitted_at >= g.revoked_at) OR
                    (ca.revoked_at IS NOT NULL AND s.submitted_at >= ca.revoked_at)
            )
                THROW 51015, 'Submission must belong to the assistant and an effective grant.', 1;
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_assistant_assignments_submissions ON class_assistant_assignments
        AFTER UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS (
                SELECT 1 FROM inserted ca
                JOIN assistant_grade_submissions s ON s.assignment_id = ca.id
                JOIN staff_profiles sp ON sp.id = ca.assistant_id
                WHERE s.submitted_by <> sp.user_id OR s.submitted_at < ca.assigned_at OR
                    (ca.revoked_at IS NOT NULL AND s.submitted_at >= ca.revoked_at)
            )
                THROW 51017, 'Assignment update would invalidate a stored submission.', 1;
        END;
        """
    )


def downgrade():
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_assistant_assignments_submissions;
        DROP TRIGGER IF EXISTS trg_assistant_submissions_window;
        DROP TRIGGER IF EXISTS trg_assessment_workflows_grants;
        DROP TRIGGER IF EXISTS trg_assessment_periods_grants;
        DROP TRIGGER IF EXISTS trg_assistant_grants_window;
        DROP TABLE student_comments;
        DROP TABLE teaching_document_events;
        DROP TABLE teaching_document_classes;
        DROP TABLE teaching_documents;
        DROP TABLE assistant_grade_submission_rows;
        DROP TABLE assistant_grade_submissions;
        DROP TABLE assistant_grading_grants;
        DROP TABLE assistant_grading_requests;
        DROP TABLE class_assistant_assignments;
        DROP TABLE assessment_skill_results;
        DROP TABLE assessment_workflows;
        DROP TABLE assessment_grading_periods;
        DROP TABLE stored_files;
        DROP INDEX uq_assessments_id_class_id ON assessments;
        DROP INDEX uq_classes_id_course_id ON classes;
        """
    )
