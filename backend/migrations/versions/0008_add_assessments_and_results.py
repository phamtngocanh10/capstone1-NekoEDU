"""Add assessments, learning results, histories and import previews.

Revision ID: 0008
Revises: 0007
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE assessments (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            class_id BIGINT NOT NULL,
            level_id BIGINT NOT NULL,
            assessment_type NVARCHAR(20) NOT NULL,
            title NVARCHAR(150) NOT NULL,
            test_date DATE NOT NULL,
            score_min DECIMAL(8,2) NOT NULL,
            score_max DECIMAL(8,2) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'DRAFT',
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            published_by BIGINT,
            published_at DATETIMEOFFSET(6),
            CONSTRAINT fk_assessments_class FOREIGN KEY (class_id) REFERENCES classes(id),
            CONSTRAINT fk_assessments_level FOREIGN KEY (level_id) REFERENCES levels(id),
            CONSTRAINT fk_assessments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT fk_assessments_published_by FOREIGN KEY (published_by) REFERENCES users(id),
            CONSTRAINT ck_assessments_type CHECK (assessment_type IN ('MONTHLY', 'END_OF_LEVEL')),
            CONSTRAINT ck_assessments_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
            CONSTRAINT ck_assessments_score_range CHECK (score_min >= 0 AND score_max > score_min),
            CONSTRAINT ck_assessments_publication CHECK (
                (status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL) OR
                (status = 'PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL)
            )
        );
        CREATE INDEX ix_assessments_class ON assessments(class_id);
        CREATE INDEX ix_assessments_level ON assessments(level_id);
        CREATE INDEX ix_assessments_test_date ON assessments(test_date);

        CREATE TABLE assessment_results (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            assessment_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            score DECIMAL(8,2) NOT NULL,
            comment NVARCHAR(500),
            recorded_by BIGINT NOT NULL,
            recorded_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_assessment_results_assessment_student UNIQUE (assessment_id, student_id),
            CONSTRAINT fk_assessment_results_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
            CONSTRAINT fk_assessment_results_student FOREIGN KEY (student_id) REFERENCES students(id),
            CONSTRAINT fk_assessment_results_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id)
        );
        CREATE INDEX ix_assessment_results_student ON assessment_results(student_id);

        CREATE TABLE assessment_result_histories (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            result_id BIGINT NOT NULL,
            old_score DECIMAL(8,2) NOT NULL,
            new_score DECIMAL(8,2) NOT NULL,
            old_comment NVARCHAR(500),
            new_comment NVARCHAR(500),
            changed_by BIGINT NOT NULL,
            changed_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            reason NVARCHAR(500) NOT NULL,
            CONSTRAINT fk_assessment_result_histories_result FOREIGN KEY (result_id) REFERENCES assessment_results(id),
            CONSTRAINT fk_assessment_result_histories_changed_by FOREIGN KEY (changed_by) REFERENCES users(id),
            CONSTRAINT ck_assessment_result_histories_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
        );
        CREATE INDEX ix_assessment_result_histories_result ON assessment_result_histories(result_id);

        CREATE TABLE assessment_import_previews (
            id UNIQUEIDENTIFIER PRIMARY KEY,
            assessment_id BIGINT NOT NULL,
            requested_by BIGINT NOT NULL,
            import_mode NVARCHAR(20) NOT NULL,
            file_hash CHAR(64) NOT NULL,
            rows_json NVARCHAR(MAX) NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            expires_at DATETIMEOFFSET(6) NOT NULL,
            confirmed_at DATETIMEOFFSET(6),
            CONSTRAINT fk_assessment_import_previews_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
            CONSTRAINT fk_assessment_import_previews_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
            CONSTRAINT ck_assessment_import_previews_mode CHECK (import_mode IN ('CREATE_ONLY', 'UPSERT')),
            CONSTRAINT ck_assessment_import_previews_rows_json CHECK (ISJSON(rows_json) = 1),
            CONSTRAINT ck_assessment_import_previews_expiry CHECK (expires_at > created_at)
        );
        CREATE INDEX ix_assessment_import_previews_assessment ON assessment_import_previews(assessment_id);
        """
    )


def downgrade():
    op.execute(
        """
        DROP TABLE IF EXISTS assessment_import_previews;
        DROP TABLE IF EXISTS assessment_result_histories;
        DROP TABLE IF EXISTS assessment_results;
        DROP TABLE IF EXISTS assessments;
        """
    )
