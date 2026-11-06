"""Add eight-session tuition cycles, adjustments and versioned policy.

Revision ID: 0009
Revises: 0008
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE tuition_business_policies (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            version INT NOT NULL,
            base_amount NUMERIC(12,0) NOT NULL,
            sessions_per_cycle SMALLINT NOT NULL,
            unit_amount NUMERIC(12,0) NOT NULL,
            absence_threshold SMALLINT NOT NULL,
            eligible_absence_statuses NVARCHAR(200),
            cancellation_after_issue_mode NVARCHAR(30),
            effective_from DATE NOT NULL,
            effective_to DATE,
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_tuition_business_policies_version UNIQUE (version),
            CONSTRAINT fk_tuition_business_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_tuition_business_policies_amounts CHECK (base_amount >= 0 AND unit_amount >= 0),
            CONSTRAINT ck_tuition_business_policies_sessions CHECK (sessions_per_cycle = 8),
            CONSTRAINT ck_tuition_business_policies_threshold CHECK (absence_threshold BETWEEN 0 AND sessions_per_cycle),
            CONSTRAINT ck_tuition_business_policies_absence_json CHECK (
                eligible_absence_statuses IS NULL OR ISJSON(eligible_absence_statuses) = 1
            ),
            CONSTRAINT ck_tuition_business_policies_cancel_mode CHECK (
                cancellation_after_issue_mode IS NULL OR
                cancellation_after_issue_mode IN ('RECALCULATE_UNPAID', 'CREDIT_NEXT_CYCLE')
            ),
            CONSTRAINT ck_tuition_business_policies_dates CHECK (
                effective_to IS NULL OR effective_to >= effective_from
            )
        );

        CREATE TABLE tuition_cycles (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            enrollment_id BIGINT NOT NULL,
            cycle_number INT NOT NULL,
            start_session_id BIGINT NOT NULL,
            end_session_id BIGINT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'DRAFT',
            policy_id BIGINT,
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            calculated_at DATETIMEOFFSET(6),
            issued_at DATETIMEOFFSET(6),
            base_amount NUMERIC(12,0),
            policy_discount_amount NUMERIC(12,0),
            absence_credit_amount NUMERIC(12,0),
            cancellation_credit_amount NUMERIC(12,0),
            manual_adjustment_amount NUMERIC(12,0),
            final_amount NUMERIC(12,0),
            CONSTRAINT uq_tuition_cycles_enrollment_number UNIQUE (enrollment_id, cycle_number),
            CONSTRAINT fk_tuition_cycles_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
            CONSTRAINT fk_tuition_cycles_start_session FOREIGN KEY (start_session_id) REFERENCES class_sessions(id),
            CONSTRAINT fk_tuition_cycles_end_session FOREIGN KEY (end_session_id) REFERENCES class_sessions(id),
            CONSTRAINT fk_tuition_cycles_policy FOREIGN KEY (policy_id) REFERENCES tuition_business_policies(id),
            CONSTRAINT fk_tuition_cycles_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_tuition_cycles_number CHECK (cycle_number > 0),
            CONSTRAINT ck_tuition_cycles_dates CHECK (end_date >= start_date),
            CONSTRAINT ck_tuition_cycles_status CHECK (status IN ('DRAFT', 'CALCULATED', 'ISSUED', 'CLOSED')),
            CONSTRAINT ck_tuition_cycles_amounts CHECK (
                (base_amount IS NULL AND final_amount IS NULL) OR
                (base_amount >= 0 AND policy_discount_amount >= 0 AND
                 absence_credit_amount >= 0 AND cancellation_credit_amount >= 0 AND
                 final_amount >= 0)
            )
        );
        CREATE INDEX ix_tuition_cycles_enrollment ON tuition_cycles(enrollment_id);

        CREATE TABLE tuition_cycle_sessions (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            cycle_id BIGINT NOT NULL,
            enrollment_id BIGINT NOT NULL,
            session_id BIGINT NOT NULL,
            sequence_no SMALLINT NOT NULL,
            CONSTRAINT uq_tuition_cycle_sessions_cycle_sequence UNIQUE (cycle_id, sequence_no),
            CONSTRAINT uq_tuition_cycle_sessions_cycle_session UNIQUE (cycle_id, session_id),
            CONSTRAINT fk_tuition_cycle_sessions_cycle FOREIGN KEY (cycle_id) REFERENCES tuition_cycles(id) ON DELETE CASCADE,
            CONSTRAINT fk_tuition_cycle_sessions_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
            CONSTRAINT fk_tuition_cycle_sessions_session FOREIGN KEY (session_id) REFERENCES class_sessions(id),
            CONSTRAINT ck_tuition_cycle_sessions_sequence CHECK (sequence_no BETWEEN 1 AND 8)
        );
        CREATE UNIQUE INDEX uq_tuition_cycle_sessions_enrollment_session
            ON tuition_cycle_sessions(enrollment_id, session_id);

        CREATE TABLE sibling_relationships (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            student_id BIGINT NOT NULL,
            sibling_student_id BIGINT NOT NULL,
            valid_from DATE NOT NULL,
            valid_to DATE,
            status NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
            reason NVARCHAR(500) NOT NULL,
            approved_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_sibling_relationships_student FOREIGN KEY (student_id) REFERENCES students(id),
            CONSTRAINT fk_sibling_relationships_sibling FOREIGN KEY (sibling_student_id) REFERENCES students(id),
            CONSTRAINT fk_sibling_relationships_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
            CONSTRAINT ck_sibling_relationships_distinct CHECK (student_id <> sibling_student_id),
            CONSTRAINT ck_sibling_relationships_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
            CONSTRAINT ck_sibling_relationships_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
            CONSTRAINT ck_sibling_relationships_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
        );
        CREATE INDEX ix_sibling_relationships_student ON sibling_relationships(student_id);

        CREATE TABLE tuition_adjustments (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            cycle_id BIGINT NOT NULL,
            source_cycle_id BIGINT,
            session_id BIGINT,
            adjustment_type NVARCHAR(30) NOT NULL,
            amount NUMERIC(12,0) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
            reason NVARCHAR(500) NOT NULL,
            approved_by BIGINT,
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            reversed_adjustment_id BIGINT,
            CONSTRAINT fk_tuition_adjustments_cycle FOREIGN KEY (cycle_id) REFERENCES tuition_cycles(id),
            CONSTRAINT fk_tuition_adjustments_source_cycle FOREIGN KEY (source_cycle_id) REFERENCES tuition_cycles(id),
            CONSTRAINT fk_tuition_adjustments_session FOREIGN KEY (session_id) REFERENCES class_sessions(id),
            CONSTRAINT fk_tuition_adjustments_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
            CONSTRAINT fk_tuition_adjustments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT fk_tuition_adjustments_reversed FOREIGN KEY (reversed_adjustment_id) REFERENCES tuition_adjustments(id),
            CONSTRAINT ck_tuition_adjustments_type CHECK (
                adjustment_type IN ('SIBLING_DISCOUNT', 'ABSENCE_CREDIT', 'CANCELLATION_CREDIT', 'MANUAL')
            ),
            CONSTRAINT ck_tuition_adjustments_status CHECK (status IN ('ACTIVE', 'REVERSED')),
            CONSTRAINT ck_tuition_adjustments_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
        );
        CREATE INDEX ix_tuition_adjustments_cycle ON tuition_adjustments(cycle_id);
        CREATE UNIQUE INDEX uq_tuition_adjustments_active_absence
            ON tuition_adjustments(source_cycle_id, adjustment_type)
            WHERE adjustment_type = 'ABSENCE_CREDIT' AND status = 'ACTIVE';
        CREATE UNIQUE INDEX uq_tuition_adjustments_active_cancellation
            ON tuition_adjustments(cycle_id, session_id, adjustment_type)
            WHERE adjustment_type = 'CANCELLATION_CREDIT' AND status = 'ACTIVE';
        CREATE UNIQUE INDEX uq_tuition_adjustments_active_sibling
            ON tuition_adjustments(cycle_id, adjustment_type)
            WHERE adjustment_type = 'SIBLING_DISCOUNT' AND status = 'ACTIVE';

        ALTER TABLE tuition_invoices DROP CONSTRAINT uq_tuition_invoices_student_id_billing_month;
        ALTER TABLE tuition_invoices DROP CONSTRAINT ck_tuition_invoices_rule1;
        ALTER TABLE tuition_invoices ADD tuition_cycle_id BIGINT NULL,
            policy_discount_snapshot NUMERIC(12,0) NOT NULL CONSTRAINT df_invoices_policy_snapshot DEFAULT 0,
            absence_credit_snapshot NUMERIC(12,0) NOT NULL CONSTRAINT df_invoices_absence_snapshot DEFAULT 0,
            cancellation_credit_snapshot NUMERIC(12,0) NOT NULL CONSTRAINT df_invoices_cancel_snapshot DEFAULT 0,
            manual_adjustment_snapshot NUMERIC(12,0) NOT NULL CONSTRAINT df_invoices_manual_snapshot DEFAULT 0;
        """
    )
    op.execute(
        """
        ALTER TABLE tuition_invoices ADD CONSTRAINT fk_tuition_invoices_cycle
            FOREIGN KEY (tuition_cycle_id) REFERENCES tuition_cycles(id);
        CREATE UNIQUE INDEX uq_tuition_invoices_cycle
            ON tuition_invoices(tuition_cycle_id) WHERE tuition_cycle_id IS NOT NULL;
        ALTER TABLE tuition_invoices ADD CONSTRAINT ck_tuition_invoices_final_nonnegative
            CHECK (final_amount >= 0);
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE tuition_invoices DROP CONSTRAINT ck_tuition_invoices_final_nonnegative;
        DROP INDEX uq_tuition_invoices_cycle ON tuition_invoices;
        ALTER TABLE tuition_invoices DROP CONSTRAINT fk_tuition_invoices_cycle;
        ALTER TABLE tuition_invoices DROP CONSTRAINT df_invoices_policy_snapshot;
        ALTER TABLE tuition_invoices DROP CONSTRAINT df_invoices_absence_snapshot;
        ALTER TABLE tuition_invoices DROP CONSTRAINT df_invoices_cancel_snapshot;
        ALTER TABLE tuition_invoices DROP CONSTRAINT df_invoices_manual_snapshot;
        ALTER TABLE tuition_invoices DROP COLUMN tuition_cycle_id, policy_discount_snapshot,
            absence_credit_snapshot, cancellation_credit_snapshot, manual_adjustment_snapshot;
        UPDATE tuition_invoices
        SET base_amount = CASE WHEN final_amount > base_amount THEN final_amount ELSE base_amount END,
            discount_amount = CASE
                WHEN final_amount > base_amount THEN 0
                ELSE base_amount - final_amount
            END;
        ALTER TABLE tuition_invoices ADD CONSTRAINT uq_tuition_invoices_student_id_billing_month UNIQUE (student_id, billing_month);
        ALTER TABLE tuition_invoices ADD CONSTRAINT ck_tuition_invoices_rule1 CHECK (final_amount = base_amount - discount_amount);
        DROP TABLE IF EXISTS tuition_adjustments;
        DROP TABLE IF EXISTS sibling_relationships;
        DROP TABLE IF EXISTS tuition_cycle_sessions;
        DROP TABLE IF EXISTS tuition_cycles;
        DROP TABLE IF EXISTS tuition_business_policies;
        """
    )
