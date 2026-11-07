"""Normalize attendance statuses, history and tuition recalculation outbox.

Revision ID: 0007
Revises: 0006
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE attendances DROP CONSTRAINT ck_attendances_status;

        UPDATE attendances
        SET note = CASE
                WHEN note IS NULL THEN N'Dữ liệu cũ: học viên đến muộn (LATE).'
                ELSE N'Dữ liệu cũ: học viên đến muộn (LATE). ' + note
            END,
            status = 'PRESENT'
        WHERE status = 'LATE';
        UPDATE attendances SET status = 'UNEXCUSED_ABSENCE' WHERE status = 'ABSENT';
        UPDATE attendances SET status = 'EXCUSED_ABSENCE' WHERE status = 'EXCUSED';

        ALTER TABLE attendances ADD CONSTRAINT ck_attendances_status CHECK (
            status IN ('PRESENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE')
        );

        CREATE TABLE attendance_histories (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            attendance_id BIGINT NOT NULL,
            old_status NVARCHAR(20) NOT NULL,
            new_status NVARCHAR(20) NOT NULL,
            old_note NVARCHAR(255),
            new_note NVARCHAR(255),
            changed_by BIGINT NOT NULL,
            changed_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            reason NVARCHAR(500) NOT NULL,
            CONSTRAINT fk_attendance_histories_attendance_id
                FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE NO ACTION,
            CONSTRAINT fk_attendance_histories_changed_by
                FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT ck_attendance_histories_old_status CHECK (
                old_status IN ('PRESENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE')
            ),
            CONSTRAINT ck_attendance_histories_new_status CHECK (
                new_status IN ('PRESENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE')
            ),
            CONSTRAINT ck_attendance_histories_reason
                CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
        );
        CREATE INDEX ix_attendance_histories_attendance_id
            ON attendance_histories(attendance_id);
        CREATE INDEX ix_attendance_histories_changed_by
            ON attendance_histories(changed_by);

        CREATE TABLE tuition_recalculation_requests (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            attendance_history_id BIGINT NOT NULL,
            attendance_id BIGINT NOT NULL,
            session_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            requested_by BIGINT NOT NULL,
            requested_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            status NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
            processed_at DATETIMEOFFSET(6),
            error_message NVARCHAR(500),
            CONSTRAINT uq_tuition_recalculation_requests_history
                UNIQUE (attendance_history_id),
            CONSTRAINT fk_tuition_recalculation_requests_history
                FOREIGN KEY (attendance_history_id) REFERENCES attendance_histories(id)
                ON DELETE NO ACTION,
            CONSTRAINT fk_tuition_recalculation_requests_attendance
                FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE NO ACTION,
            CONSTRAINT fk_tuition_recalculation_requests_session
                FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE NO ACTION,
            CONSTRAINT fk_tuition_recalculation_requests_student
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
            CONSTRAINT fk_tuition_recalculation_requests_requested_by
                FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT ck_tuition_recalculation_requests_status
                CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
            CONSTRAINT ck_tuition_recalculation_requests_processed
                CHECK (
                    (status = 'PENDING' AND processed_at IS NULL) OR
                    (status IN ('PROCESSED', 'FAILED') AND processed_at IS NOT NULL)
                )
        );
        CREATE INDEX ix_tuition_recalculation_requests_status
            ON tuition_recalculation_requests(status, requested_at);
        CREATE INDEX ix_tuition_recalculation_requests_student
            ON tuition_recalculation_requests(student_id);
        """
    )


def downgrade():
    op.execute(
        """
        DROP TABLE IF EXISTS tuition_recalculation_requests;
        DROP TABLE IF EXISTS attendance_histories;
        ALTER TABLE attendances DROP CONSTRAINT ck_attendances_status;
        UPDATE attendances SET status = 'ABSENT' WHERE status = 'UNEXCUSED_ABSENCE';
        UPDATE attendances SET status = 'EXCUSED' WHERE status = 'EXCUSED_ABSENCE';
        ALTER TABLE attendances ADD CONSTRAINT ck_attendances_status CHECK (
            status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')
        );
        """
    )
