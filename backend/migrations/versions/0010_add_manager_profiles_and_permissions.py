"""Store Manager profile fields, course groups and editable role permissions.

Revision ID: 0010
Revises: 0009

The existing student age levels, classes, rooms, enrollments and staff/session
assignments remain the source of truth. These additions do not connect the
frontend adapters or change the current hard-coded API authorization policy.
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE users ADD
            date_of_birth DATE NULL,
            gender NVARCHAR(10) NULL,
            address NVARCHAR(255) NULL,
            avatar_storage_key NVARCHAR(500) NULL,
            lock_reason NVARCHAR(500) NULL,
            locked_at DATETIMEOFFSET(6) NULL,
            locked_until DATETIMEOFFSET(6) NULL,
            locked_by BIGINT NULL,
            deleted_at DATETIMEOFFSET(6) NULL,
            deleted_by BIGINT NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE users ADD
            CONSTRAINT ck_users_gender CHECK (
                gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER')
            ),
            CONSTRAINT ck_users_lock_dates CHECK (
                locked_until IS NULL OR
                (locked_at IS NOT NULL AND locked_until > locked_at)
            ),
            CONSTRAINT fk_users_locked_by FOREIGN KEY (locked_by)
                REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT fk_users_deleted_by FOREIGN KEY (deleted_by)
                REFERENCES users(id) ON DELETE NO ACTION;

        ALTER TABLE students ADD
            gender NVARCHAR(10) NULL,
            address NVARCHAR(255) NULL,
            contact_email NVARCHAR(150) NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE students ADD CONSTRAINT ck_students_gender CHECK (
            gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER')
        );

        ALTER TABLE staff_profiles ADD
            contract_type NVARCHAR(20) NULL,
            certificate NVARCHAR(500) NULL,
            hourly_rate NUMERIC(12,0) NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE staff_profiles ADD
            CONSTRAINT ck_staff_profiles_contract_type CHECK (
                contract_type IS NULL OR
                contract_type IN ('FULL_TIME', 'PART_TIME', 'TEMPORARY')
            ),
            CONSTRAINT ck_staff_profiles_hourly_rate CHECK (
                hourly_rate IS NULL OR hourly_rate >= 0
            );

        CREATE TABLE course_groups (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            code NVARCHAR(20) NOT NULL,
            name NVARCHAR(100) NOT NULL,
            description NVARCHAR(500) NULL,
            sort_order SMALLINT NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
            created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_course_groups_code UNIQUE (code),
            CONSTRAINT uq_course_groups_sort_order UNIQUE (sort_order),
            CONSTRAINT ck_course_groups_sort_order CHECK (sort_order >= 0),
            CONSTRAINT ck_course_groups_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
        );
        INSERT INTO course_groups (code, name, description, sort_order)
        VALUES
            (N'KINDY', N'KINDY', N'Tiếng Anh mầm non', 1),
            (N'KID', N'KID', N'Tiếng Anh thiếu nhi', 2),
            (N'TEEN', N'TEEN', N'Tiếng Anh thiếu niên', 3);

        ALTER TABLE courses ADD
            group_id BIGINT NULL,
            curriculum_level SMALLINT NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE courses ADD
            CONSTRAINT fk_courses_group_id FOREIGN KEY (group_id)
                REFERENCES course_groups(id) ON DELETE NO ACTION,
            CONSTRAINT ck_courses_curriculum_level CHECK (
                curriculum_level IS NULL OR curriculum_level BETWEEN 1 AND 99
            );
        CREATE INDEX ix_courses_group_id ON courses(group_id);
        """
    )
    # A separate batch is necessary for SQL Server to resolve the newly added
    # course columns. Preserve all eight existing age levels, including KID_4.
    op.execute(
        """
        UPDATE c SET group_id = g.id,
            curriculum_level = CASE
                WHEN l.code = N'KINDY' THEN 1
                ELSE TRY_CONVERT(SMALLINT, RIGHT(l.code, 1)) END
        FROM courses c
        JOIN levels l ON l.id = c.level_id
        JOIN course_groups g ON g.code = CASE
            WHEN l.code = N'KINDY' THEN N'KINDY'
            WHEN l.code LIKE N'KID[_]%' THEN N'KID'
            WHEN l.code LIKE N'TEEN[_]%' THEN N'TEEN' END;

        CREATE TABLE permission_resources (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            code NVARCHAR(40) NOT NULL,
            name NVARCHAR(100) NOT NULL,
            sort_order SMALLINT NOT NULL,
            CONSTRAINT uq_permission_resources_code UNIQUE (code),
            CONSTRAINT uq_permission_resources_sort_order UNIQUE (sort_order)
        );
        INSERT INTO permission_resources (code, name, sort_order)
        VALUES
            (N'STUDENTS', N'Học viên (hồ sơ)', 1),
            (N'COURSES_CLASSES', N'Khóa học & lớp học', 2),
            (N'SCHEDULES', N'Lịch', 3),
            (N'ATTENDANCE', N'Điểm danh', 4),
            (N'GRADES', N'Điểm số (nhập điểm)', 5),
            (N'ASSISTANTS', N'Trợ giảng', 6),
            (N'LEARNING_MATERIALS', N'Tài liệu học tập', 7),
            (N'STUDENT_COMMENTS', N'Nhận xét học viên', 8),
            (N'CENTER_ADMINISTRATION', N'Quản trị trung tâm', 9);

        CREATE TABLE role_permissions (
            id BIGINT IDENTITY(1,1) PRIMARY KEY,
            role_id BIGINT NOT NULL,
            resource_id BIGINT NOT NULL,
            action_code NVARCHAR(10) NOT NULL,
            effect NVARCHAR(20) NOT NULL,
            condition_code NVARCHAR(50) NULL,
            note NVARCHAR(500) NULL,
            updated_by BIGINT NULL,
            updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT uq_role_permissions_role_resource_action
                UNIQUE (role_id, resource_id, action_code),
            CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (role_id)
                REFERENCES roles(id) ON DELETE NO ACTION,
            CONSTRAINT fk_role_permissions_resource_id FOREIGN KEY (resource_id)
                REFERENCES permission_resources(id) ON DELETE NO ACTION,
            CONSTRAINT fk_role_permissions_updated_by FOREIGN KEY (updated_by)
                REFERENCES users(id) ON DELETE NO ACTION,
            CONSTRAINT ck_role_permissions_action CHECK (
                action_code IN ('VIEW', 'CREATE', 'UPDATE', 'DELETE')
            ),
            CONSTRAINT ck_role_permissions_effect CHECK (
                effect IN ('DENY', 'CONDITIONAL', 'ALLOW')
            ),
            CONSTRAINT ck_role_permissions_condition CHECK (
                effect <> 'CONDITIONAL' OR
                (condition_code IS NOT NULL AND LEN(LTRIM(RTRIM(condition_code))) > 0)
            )
        );
        CREATE INDEX ix_role_permissions_resource_id ON role_permissions(resource_id);
        CREATE INDEX ix_role_permissions_updated_by ON role_permissions(updated_by);
        """
    )


def downgrade():
    op.execute(
        """
        DROP TABLE role_permissions;
        DROP TABLE permission_resources;

        DROP INDEX ix_courses_group_id ON courses;
        ALTER TABLE courses DROP CONSTRAINT fk_courses_group_id;
        ALTER TABLE courses DROP CONSTRAINT ck_courses_curriculum_level;
        ALTER TABLE courses DROP COLUMN group_id, curriculum_level;
        DROP TABLE course_groups;

        ALTER TABLE staff_profiles DROP CONSTRAINT ck_staff_profiles_contract_type;
        ALTER TABLE staff_profiles DROP CONSTRAINT ck_staff_profiles_hourly_rate;
        ALTER TABLE staff_profiles DROP COLUMN contract_type, certificate, hourly_rate;

        ALTER TABLE students DROP CONSTRAINT ck_students_gender;
        ALTER TABLE students DROP COLUMN gender, address, contact_email;

        ALTER TABLE users DROP CONSTRAINT fk_users_locked_by;
        ALTER TABLE users DROP CONSTRAINT fk_users_deleted_by;
        ALTER TABLE users DROP CONSTRAINT ck_users_gender;
        ALTER TABLE users DROP CONSTRAINT ck_users_lock_dates;
        ALTER TABLE users DROP COLUMN date_of_birth, gender, address,
            avatar_storage_key, lock_reason, locked_at, locked_until, locked_by,
            deleted_at, deleted_by;
        """
    )
