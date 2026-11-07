"""Add persistent JWT revocation for logout.

Revision ID: 0002
Revises: 0001
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE revoked_tokens (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            jti NVARCHAR(36) NOT NULL,
            user_id BIGINT NOT NULL,
            expires_at DATETIMEOFFSET(6) NOT NULL,
            revoked_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_revoked_tokens_jti UNIQUE (jti),
            CONSTRAINT fk_revoked_tokens_user_id FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX ix_revoked_tokens_user_id ON revoked_tokens(user_id);
        CREATE INDEX ix_revoked_tokens_expires_at ON revoked_tokens(expires_at);

        ALTER TABLE audit_logs DROP CONSTRAINT ck_audit_logs_action;
        ALTER TABLE audit_logs ADD CONSTRAINT ck_audit_logs_action
            CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE'));
        """
    )


def downgrade():
    op.execute(
        """
        DROP TABLE IF EXISTS revoked_tokens;
        ALTER TABLE audit_logs DROP CONSTRAINT ck_audit_logs_action;
        ALTER TABLE audit_logs ADD CONSTRAINT ck_audit_logs_action
            CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE'));
        """
    )
