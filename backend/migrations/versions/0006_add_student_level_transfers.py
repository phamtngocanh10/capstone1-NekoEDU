"""Add immutable student level transfer history.

Revision ID: 0006
Revises: 0005
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE student_level_transfers (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            student_id BIGINT NOT NULL,
            old_level_id BIGINT NOT NULL,
            new_level_id BIGINT NOT NULL,
            effective_date DATE NOT NULL,
            reason NVARCHAR(500) NOT NULL,
            transferred_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_student_level_transfers_student_date
                UNIQUE (student_id, effective_date),
            CONSTRAINT fk_student_level_transfers_student_id
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
            CONSTRAINT fk_student_level_transfers_old_level_id
                FOREIGN KEY (old_level_id) REFERENCES levels(id) ON DELETE NO ACTION,
            CONSTRAINT fk_student_level_transfers_new_level_id
                FOREIGN KEY (new_level_id) REFERENCES levels(id) ON DELETE NO ACTION,
            CONSTRAINT fk_student_level_transfers_transferred_by
                FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT ck_student_level_transfers_different_levels
                CHECK (old_level_id <> new_level_id),
            CONSTRAINT ck_student_level_transfers_reason
                CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
        );
        CREATE INDEX ix_student_level_transfers_student_id
            ON student_level_transfers(student_id);
        CREATE INDEX ix_student_level_transfers_transferred_by
            ON student_level_transfers(transferred_by);
        """
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS student_level_transfers")
