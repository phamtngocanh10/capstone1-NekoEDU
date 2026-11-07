"""Invalidate previously issued tokens after security-sensitive changes.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE users ADD auth_version INT NOT NULL "
        "CONSTRAINT df_users_auth_version DEFAULT 0"
    )


def downgrade():
    op.execute("ALTER TABLE users DROP CONSTRAINT df_users_auth_version")
    op.execute("ALTER TABLE users DROP COLUMN auth_version")
