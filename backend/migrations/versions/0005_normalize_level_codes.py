"""Normalize and constrain the fixed eight level codes.

Revision ID: 0005
Revises: 0004
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        UPDATE levels SET code = 'KID_1' WHERE code = 'KID 1';
        UPDATE levels SET code = 'KID_2' WHERE code = 'KID 2';
        UPDATE levels SET code = 'KID_3' WHERE code = 'KID 3';
        UPDATE levels SET code = 'KID_4' WHERE code = 'KID 4';
        UPDATE levels SET code = 'TEEN_1' WHERE code = 'TEEN 1';
        UPDATE levels SET code = 'TEEN_2' WHERE code = 'TEEN 2';
        UPDATE levels SET code = 'TEEN_3' WHERE code = 'TEEN 3';
        ALTER TABLE levels ADD CONSTRAINT ck_levels_code CHECK (
            code IN ('KINDY', 'KID_1', 'KID_2', 'KID_3', 'KID_4',
                     'TEEN_1', 'TEEN_2', 'TEEN_3')
        );
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE levels DROP CONSTRAINT ck_levels_code;
        UPDATE levels SET code = 'KID 1' WHERE code = 'KID_1';
        UPDATE levels SET code = 'KID 2' WHERE code = 'KID_2';
        UPDATE levels SET code = 'KID 3' WHERE code = 'KID_3';
        UPDATE levels SET code = 'KID 4' WHERE code = 'KID_4';
        UPDATE levels SET code = 'TEEN 1' WHERE code = 'TEEN_1';
        UPDATE levels SET code = 'TEEN 2' WHERE code = 'TEEN_2';
        UPDATE levels SET code = 'TEEN 3' WHERE code = 'TEEN_3';
        """
    )
