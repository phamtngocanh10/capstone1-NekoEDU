"""Add many-to-many links between student/parent accounts and students.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE student_user_links (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            user_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            relationship NVARCHAR(20) NOT NULL,
            can_view BIT NOT NULL CONSTRAINT df_student_user_links_can_view DEFAULT 1,
            created_by BIGINT,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_student_user_links_user_student UNIQUE (user_id, student_id),
            CONSTRAINT fk_student_user_links_user_id FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_student_user_links_student_id FOREIGN KEY (student_id)
                REFERENCES students(id) ON DELETE CASCADE,
            CONSTRAINT fk_student_user_links_created_by FOREIGN KEY (created_by)
                REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT ck_student_user_links_relationship
                CHECK (relationship IN ('SELF', 'FATHER', 'MOTHER', 'GUARDIAN'))
        );
        CREATE INDEX ix_student_user_links_user_id ON student_user_links(user_id);
        CREATE INDEX ix_student_user_links_student_id ON student_user_links(student_id);

        INSERT INTO student_user_links (user_id, student_id, relationship, can_view)
        SELECT user_id, id, 'SELF', 1
        FROM students
        WHERE user_id IS NOT NULL;
        """
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS student_user_links")
