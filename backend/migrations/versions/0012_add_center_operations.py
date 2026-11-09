"""Persist announcements, hourly payroll, invoice lines and forecast outputs.

Revision ID: 0012
Revises: 0011

Existing payments, ledger, notifications and AI alerts remain authoritative.
New workflow tables complement them; no existing business rows are deleted.
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE announcement_templates (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            code NVARCHAR(40) NOT NULL,
            title NVARCHAR(200) NOT NULL,
            content NVARCHAR(2000) NOT NULL,
            message_type NVARCHAR(20) NOT NULL,
            is_active BIT NOT NULL DEFAULT 1,
            created_by BIGINT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_announcement_templates_code UNIQUE (code),
            CONSTRAINT fk_announcement_templates_author FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_announcement_templates_type CHECK (message_type IN ('SCHEDULE','TUITION','ASSESSMENT','EVENT','SYSTEM'))
        );
        CREATE TABLE announcements (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            template_id BIGINT NULL,
            title NVARCHAR(200) NOT NULL,
            content NVARCHAR(2000) NOT NULL DEFAULT N'',
            message_type NVARCHAR(20) NOT NULL,
            priority NVARCHAR(10) NOT NULL DEFAULT N'NORMAL',
            audience_type NVARCHAR(20) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'DRAFT',
            scheduled_at DATETIMEOFFSET(6) NULL,
            sent_at DATETIMEOFFSET(6) NULL,
            is_pinned BIT NOT NULL DEFAULT 0,
            send_email BIT NOT NULL DEFAULT 0,
            send_push BIT NOT NULL DEFAULT 0,
            created_by BIGINT NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_announcements_template FOREIGN KEY (template_id) REFERENCES announcement_templates(id),
            CONSTRAINT fk_announcements_author FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_announcements_type CHECK (message_type IN ('SCHEDULE','TUITION','ASSESSMENT','EVENT','SYSTEM')),
            CONSTRAINT ck_announcements_priority CHECK (priority IN ('NORMAL','IMPORTANT')),
            CONSTRAINT ck_announcements_audience CHECK (audience_type IN ('ALL_STUDENTS','ALL_USERS','CLASSES','STUDENTS')),
            CONSTRAINT ck_announcements_status CHECK (status IN ('DRAFT','SCHEDULED','SENDING','SENT','CANCELLED')),
            CONSTRAINT ck_announcements_schedule CHECK (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL),
            CONSTRAINT ck_announcements_sent CHECK (status <> 'SENT' OR sent_at IS NOT NULL),
            CONSTRAINT ck_announcements_content CHECK (status = 'DRAFT' OR
                (LEN(LTRIM(RTRIM(title))) > 0 AND LEN(LTRIM(RTRIM(content))) > 0))
        );
        CREATE INDEX ix_announcements_status_schedule ON announcements(status, scheduled_at);
        CREATE INDEX ix_announcements_author ON announcements(created_by);
        CREATE TABLE announcement_classes (
            announcement_id BIGINT NOT NULL,
            class_id BIGINT NOT NULL,
            CONSTRAINT pk_announcement_classes PRIMARY KEY (announcement_id, class_id),
            CONSTRAINT fk_announcement_classes_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id),
            CONSTRAINT fk_announcement_classes_class FOREIGN KEY (class_id) REFERENCES classes(id)
        );
        CREATE INDEX ix_announcement_classes_class ON announcement_classes(class_id);
        CREATE TABLE announcement_students (
            announcement_id BIGINT NOT NULL,
            student_id BIGINT NOT NULL,
            CONSTRAINT pk_announcement_students PRIMARY KEY (announcement_id, student_id),
            CONSTRAINT fk_announcement_students_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id),
            CONSTRAINT fk_announcement_students_student FOREIGN KEY (student_id) REFERENCES students(id)
        );
        CREATE INDEX ix_announcement_students_student ON announcement_students(student_id);
        CREATE TABLE announcement_attachments (
            announcement_id BIGINT NOT NULL,
            file_id BIGINT NOT NULL,
            display_order SMALLINT NOT NULL,
            CONSTRAINT pk_announcement_attachments PRIMARY KEY (announcement_id, file_id),
            CONSTRAINT uq_announcement_attachments_position UNIQUE (announcement_id, display_order),
            CONSTRAINT fk_announcement_attachments_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id),
            CONSTRAINT fk_announcement_attachments_file FOREIGN KEY (file_id) REFERENCES stored_files(id),
            CONSTRAINT ck_announcement_attachments_position CHECK (display_order BETWEEN 1 AND 5)
        );
        CREATE INDEX ix_announcement_attachments_file ON announcement_attachments(file_id);
        CREATE TABLE announcement_replies (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            announcement_id BIGINT NOT NULL,
            author_user_id BIGINT NOT NULL,
            content NVARCHAR(2000) NOT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT fk_announcement_replies_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id),
            CONSTRAINT fk_announcement_replies_author FOREIGN KEY (author_user_id) REFERENCES users(id),
            CONSTRAINT ck_announcement_replies_content CHECK (LEN(LTRIM(RTRIM(content))) > 0)
        );
        CREATE INDEX ix_announcement_replies_announcement ON announcement_replies(announcement_id, created_at);

        ALTER TABLE notifications ADD announcement_id BIGINT NULL;
        ALTER TABLE staff_payrolls ADD
            calculation_basis NVARCHAR(10) NOT NULL CONSTRAINT df_staff_payrolls_basis DEFAULT N'SESSION',
            teaching_hours DECIMAL(9,2) NULL,
            hourly_rate NUMERIC(12,0) NULL,
            approved_at DATETIMEOFFSET(6) NULL,
            paid_at DATETIMEOFFSET(6) NULL;
    """)
    op.execute("""
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_announcement
            FOREIGN KEY (announcement_id) REFERENCES announcements(id);
        CREATE UNIQUE INDEX uq_notifications_announcement_recipient
            ON notifications(announcement_id, recipient_user_id) WHERE announcement_id IS NOT NULL;
        CREATE TABLE notification_deliveries (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            notification_id BIGINT NOT NULL,
            channel NVARCHAR(10) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
            attempt_count INT NOT NULL DEFAULT 0,
            next_attempt_at DATETIMEOFFSET(6) NULL,
            delivered_at DATETIMEOFFSET(6) NULL,
            last_error NVARCHAR(500) NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_notification_deliveries_channel UNIQUE (notification_id, channel),
            CONSTRAINT fk_notification_deliveries_notification FOREIGN KEY (notification_id) REFERENCES notifications(id),
            CONSTRAINT ck_notification_deliveries_channel CHECK (channel IN ('IN_APP','EMAIL','PUSH')),
            CONSTRAINT ck_notification_deliveries_status CHECK (status IN ('PENDING','SENT','FAILED')),
            CONSTRAINT ck_notification_deliveries_attempts CHECK (attempt_count >= 0),
            CONSTRAINT ck_notification_deliveries_sent CHECK (status <> 'SENT' OR delivered_at IS NOT NULL)
        );
        CREATE INDEX ix_notification_deliveries_pending ON notification_deliveries(status, next_attempt_at);

        ALTER TABLE staff_payrolls DROP CONSTRAINT ck_staff_payrolls_rule1;
        ALTER TABLE staff_payrolls ADD
            CONSTRAINT ck_staff_payrolls_basis CHECK (calculation_basis IN ('SESSION','HOUR')),
            CONSTRAINT ck_staff_payrolls_hours CHECK (teaching_hours IS NULL OR teaching_hours >= 0),
            CONSTRAINT ck_staff_payrolls_hourly_rate CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
            CONSTRAINT ck_staff_payrolls_rule1 CHECK (
                (calculation_basis = 'SESSION' AND total_amount = session_count * rate_per_session + bonus - deduction)
                OR (calculation_basis = 'HOUR' AND teaching_hours IS NOT NULL AND hourly_rate IS NOT NULL
                    AND total_amount >= 0 AND total_amount = ROUND(teaching_hours * hourly_rate + bonus - deduction, 0))
            );

        CREATE TABLE finance_transaction_attachments (
            transaction_id BIGINT NOT NULL,
            file_id BIGINT NOT NULL,
            CONSTRAINT pk_finance_transaction_attachments PRIMARY KEY (transaction_id, file_id),
            CONSTRAINT fk_finance_transaction_attachments_txn FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id),
            CONSTRAINT fk_finance_transaction_attachments_file FOREIGN KEY (file_id) REFERENCES stored_files(id)
        );
        CREATE INDEX ix_finance_transaction_attachments_file ON finance_transaction_attachments(file_id);
        CREATE TABLE tuition_invoice_items (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            invoice_id BIGINT NOT NULL,
            line_no SMALLINT NOT NULL,
            item_type NVARCHAR(20) NOT NULL,
            description NVARCHAR(255) NOT NULL,
            amount NUMERIC(12,0) NOT NULL,
            CONSTRAINT uq_tuition_invoice_items_line UNIQUE (invoice_id, line_no),
            CONSTRAINT fk_tuition_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES tuition_invoices(id),
            CONSTRAINT ck_tuition_invoice_items_type CHECK (item_type IN ('TUITION','MATERIAL','OTHER')),
            CONSTRAINT ck_tuition_invoice_items_line CHECK (line_no > 0),
            CONSTRAINT ck_tuition_invoice_items_amount CHECK (amount >= 0),
            CONSTRAINT ck_tuition_invoice_items_description CHECK (LEN(LTRIM(RTRIM(description))) > 0)
        );
        INSERT INTO tuition_invoice_items (invoice_id, line_no, item_type, description, amount)
        SELECT id, 1, N'TUITION', N'Học phí', base_amount FROM tuition_invoices;

        CREATE TABLE ai_forecast_runs (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            model_name NVARCHAR(100) NOT NULL,
            model_version NVARCHAR(50) NOT NULL,
            source NVARCHAR(20) NOT NULL,
            scope NVARCHAR(10) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'RUNNING',
            parameters_json NVARCHAR(MAX) NULL,
            input_summary_json NVARCHAR(MAX) NULL,
            created_by BIGINT NULL,
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            completed_at DATETIMEOFFSET(6) NULL,
            CONSTRAINT fk_ai_forecast_runs_author FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT ck_ai_forecast_runs_source CHECK (source IN ('SEED','RULE','AI_ENGINE')),
            CONSTRAINT ck_ai_forecast_runs_scope CHECK (scope IN ('COURSE','MONTH','YEAR')),
            CONSTRAINT ck_ai_forecast_runs_status CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
            CONSTRAINT ck_ai_forecast_runs_parameters CHECK (parameters_json IS NULL OR ISJSON(parameters_json) = 1),
            CONSTRAINT ck_ai_forecast_runs_input CHECK (input_summary_json IS NULL OR ISJSON(input_summary_json) = 1),
            CONSTRAINT ck_ai_forecast_runs_completed CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL)
        );
        CREATE INDEX ix_ai_forecast_runs_scope_date ON ai_forecast_runs(scope, created_at);
        CREATE UNIQUE INDEX uq_courses_id_group_id ON courses(id, group_id);
        CREATE TABLE ai_forecast_points (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            run_id BIGINT NOT NULL,
            metric_code NVARCHAR(40) NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            course_group_id BIGINT NULL,
            course_id BIGINT NULL,
            student_id BIGINT NULL,
            predicted_value DECIMAL(12,2) NOT NULL,
            lower_bound DECIMAL(12,2) NULL,
            upper_bound DECIMAL(12,2) NULL,
            confidence_percent DECIMAL(5,2) NULL,
            basis_json NVARCHAR(MAX) NULL,
            CONSTRAINT uq_ai_forecast_points_dimension UNIQUE
                (run_id, metric_code, period_start, course_group_id, course_id, student_id),
            CONSTRAINT fk_ai_forecast_points_run FOREIGN KEY (run_id) REFERENCES ai_forecast_runs(id),
            CONSTRAINT fk_ai_forecast_points_group FOREIGN KEY (course_group_id) REFERENCES course_groups(id),
            CONSTRAINT fk_ai_forecast_points_course FOREIGN KEY (course_id) REFERENCES courses(id),
            CONSTRAINT fk_ai_forecast_points_course_group FOREIGN KEY (course_id, course_group_id) REFERENCES courses(id, group_id),
            CONSTRAINT fk_ai_forecast_points_student FOREIGN KEY (student_id) REFERENCES students(id),
            CONSTRAINT ck_ai_forecast_points_metric CHECK (metric_code IN
                ('ENROLLMENT_COUNT','REENROLLMENT_PROBABILITY','DROPOUT_PROBABILITY','CLASS_COUNT','STAFF_COUNT','OCCUPANCY_RATE','CONVERSION_RATE')),
            CONSTRAINT ck_ai_forecast_points_dates CHECK (period_end >= period_start),
            CONSTRAINT ck_ai_forecast_points_value CHECK (predicted_value >= 0),
            CONSTRAINT ck_ai_forecast_points_probability CHECK (
                metric_code NOT IN ('REENROLLMENT_PROBABILITY','DROPOUT_PROBABILITY','OCCUPANCY_RATE','CONVERSION_RATE')
                OR (predicted_value <= 100 AND (upper_bound IS NULL OR upper_bound <= 100))),
            CONSTRAINT ck_ai_forecast_points_interval CHECK (
                (lower_bound IS NULL OR (lower_bound >= 0 AND lower_bound <= predicted_value)) AND
                (upper_bound IS NULL OR upper_bound >= predicted_value)),
            CONSTRAINT ck_ai_forecast_points_confidence CHECK (confidence_percent IS NULL OR confidence_percent BETWEEN 0 AND 100),
            CONSTRAINT ck_ai_forecast_points_basis CHECK (basis_json IS NULL OR ISJSON(basis_json) = 1)
        );
        CREATE INDEX ix_ai_forecast_points_student ON ai_forecast_points(student_id);
        CREATE INDEX ix_ai_forecast_points_course ON ai_forecast_points(course_id);
        CREATE INDEX ix_ai_forecast_points_group ON ai_forecast_points(course_group_id);
        ALTER TABLE ai_alerts ADD
            forecast_point_id BIGINT NULL,
            confidence_percent DECIMAL(5,2) NULL,
            recommendation_code NVARCHAR(40) NULL,
            recommendation_json NVARCHAR(MAX) NULL,
            review_note NVARCHAR(500) NULL;
    """)
    op.execute("""
        ALTER TABLE ai_alerts ADD
            CONSTRAINT fk_ai_alerts_forecast_point FOREIGN KEY (forecast_point_id) REFERENCES ai_forecast_points(id),
            CONSTRAINT ck_ai_alerts_confidence CHECK (confidence_percent IS NULL OR confidence_percent BETWEEN 0 AND 100),
            CONSTRAINT ck_ai_alerts_recommendation CHECK (recommendation_json IS NULL OR ISJSON(recommendation_json) = 1);
        CREATE INDEX ix_ai_alerts_forecast_point ON ai_alerts(forecast_point_id);
        ALTER TABLE ai_alerts DROP CONSTRAINT ck_ai_alerts_alert_type;
        ALTER TABLE ai_alerts ADD CONSTRAINT ck_ai_alerts_alert_type CHECK (alert_type IN
            ('DEBT_RISK','LOW_ATTENDANCE','TUITION_DATA_ANOMALY','FINANCE_RISK','ENROLLMENT_RECOMMENDATION','REENROLLMENT_RISK','DROPOUT_RISK'));
    """)
    op.execute("""
        CREATE VIEW v_staff_teaching_hours AS
        WITH assignments AS (
            SELECT lecturer_id AS staff_id, session_date, start_time, end_time
            FROM class_sessions WHERE status = 'COMPLETED'
            UNION ALL
            SELECT assistant_id, session_date, start_time, end_time
            FROM class_sessions WHERE status = 'COMPLETED' AND assistant_id IS NOT NULL
        )
        SELECT staff_id, DATEFROMPARTS(YEAR(session_date), MONTH(session_date), 1) AS payroll_month,
            COUNT_BIG(*) AS session_count,
            CAST(SUM(CAST(DATEDIFF(MINUTE, start_time, end_time) AS DECIMAL(12,2))) / 60 AS DECIMAL(9,2)) AS teaching_hours
        FROM assignments
        GROUP BY staff_id, YEAR(session_date), MONTH(session_date)
    """)
    op.execute("""
        CREATE VIEW v_announcement_read_summary AS
        SELECT a.id AS announcement_id, COUNT_BIG(n.id) AS recipient_count,
            SUM(CAST(CASE WHEN n.is_read = 1 THEN 1 ELSE 0 END AS BIGINT)) AS read_count,
            CAST(100.0 * SUM(CASE WHEN n.is_read = 1 THEN 1 ELSE 0 END) /
                NULLIF(COUNT_BIG(n.id), 0) AS DECIMAL(5,2)) AS read_percent
        FROM announcements a LEFT JOIN notifications n ON n.announcement_id = a.id
        GROUP BY a.id
    """)
    op.execute("""
        CREATE VIEW v_student_tuition_balance AS
        SELECT student_id, SUM(final_amount) AS total_billed, SUM(paid_amount) AS total_paid,
            SUM(final_amount - paid_amount) AS outstanding_amount,
            MIN(CASE WHEN paid_amount < final_amount THEN due_date END) AS oldest_unpaid_due_date
        FROM tuition_invoices WHERE status <> 'CANCELLED'
        GROUP BY student_id
    """)


def downgrade():
    # Hourly payroll cannot be expressed by the legacy per-session formula.
    # Refuse rather than rewriting financial history on downgrade.
    op.execute("""
        IF EXISTS (SELECT 1 FROM staff_payrolls WHERE calculation_basis = 'HOUR')
            THROW 50112, 'Hourly payroll exists; archive/reconcile it before downgrade.', 1;
        IF EXISTS (SELECT 1 FROM ai_alerts WHERE alert_type IN ('REENROLLMENT_RISK','DROPOUT_RISK'))
            THROW 50113, 'New risk alerts exist; reconcile them before downgrade.', 1;
        DROP VIEW v_student_tuition_balance;
        DROP VIEW v_announcement_read_summary;
        DROP VIEW v_staff_teaching_hours;
        DROP INDEX ix_ai_alerts_forecast_point ON ai_alerts;
        ALTER TABLE ai_alerts DROP CONSTRAINT fk_ai_alerts_forecast_point, ck_ai_alerts_confidence,
            ck_ai_alerts_recommendation, ck_ai_alerts_alert_type;
        ALTER TABLE ai_alerts ADD CONSTRAINT ck_ai_alerts_alert_type CHECK (alert_type IN
            ('DEBT_RISK','LOW_ATTENDANCE','TUITION_DATA_ANOMALY','FINANCE_RISK','ENROLLMENT_RECOMMENDATION'));
        ALTER TABLE ai_alerts DROP COLUMN forecast_point_id, confidence_percent, recommendation_code,
            recommendation_json, review_note;
        DROP TABLE ai_forecast_points;
        DROP INDEX uq_courses_id_group_id ON courses;
        DROP TABLE ai_forecast_runs;
        DROP TABLE tuition_invoice_items;
        DROP TABLE finance_transaction_attachments;
        ALTER TABLE staff_payrolls DROP CONSTRAINT ck_staff_payrolls_rule1, ck_staff_payrolls_basis,
            ck_staff_payrolls_hours, ck_staff_payrolls_hourly_rate, df_staff_payrolls_basis;
        ALTER TABLE staff_payrolls DROP COLUMN calculation_basis, teaching_hours, hourly_rate, approved_at, paid_at;
        ALTER TABLE staff_payrolls ADD CONSTRAINT ck_staff_payrolls_rule1
            CHECK (total_amount = session_count * rate_per_session + bonus - deduction);
        DROP TABLE notification_deliveries;
        DROP INDEX uq_notifications_announcement_recipient ON notifications;
        ALTER TABLE notifications DROP CONSTRAINT fk_notifications_announcement;
        ALTER TABLE notifications DROP COLUMN announcement_id;
        DROP TABLE announcement_replies;
        DROP TABLE announcement_attachments;
        DROP TABLE announcement_students;
        DROP TABLE announcement_classes;
        DROP TABLE announcements;
        DROP TABLE announcement_templates;
    """)
