-- =====================================================================
-- NEKO Edu - Smart English Center Management Platform (C1SE.77)
-- 01_schema.sql - Tạo cấu trúc (DROP & CREATE, dùng cho database mới)
-- Target : Microsoft SQL Server 2022+  |  Generated: 2026-10-01
-- Owner  : Database - phamtngochuyen3@dtu.edu.vn
-- =====================================================================

DROP VIEW IF EXISTS v_student_tuition_summary;
DROP VIEW IF EXISTS v_attendance_monthly;
DROP VIEW IF EXISTS v_finance_monthly;
DROP VIEW IF EXISTS v_lead_funnel_monthly;
DROP VIEW IF EXISTS v_staff_schedule;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS policy_documents;
DROP TABLE IF EXISTS ai_alerts;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS finance_transactions;
DROP TABLE IF EXISTS finance_categories;
DROP TABLE IF EXISTS staff_payrolls;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS tuition_invoices;
DROP TABLE IF EXISTS student_discounts;
DROP TABLE IF EXISTS discount_policies;
DROP TABLE IF EXISTS student_requests;
DROP TABLE IF EXISTS attendances;
DROP TABLE IF EXISTS class_sessions;
DROP TABLE IF EXISTS class_enrollments;
DROP TABLE IF EXISTS class_schedules;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS admission_leads;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS levels;
DROP TABLE IF EXISTS guardians;
DROP TABLE IF EXISTS staff_profiles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- Danh mục vai trò hệ thống (RBAC).
CREATE TABLE roles (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_roles_code UNIQUE (code),
    CONSTRAINT ck_roles_code CHECK (code IN ('MANAGER', 'LECTURER', 'TEACHING_ASSISTANT', 'STUDENT_PARENT'))
);

-- Tài khoản đăng nhập của mọi actor. Mỗi học viên có 1 tài khoản dùng chung Student/Parent.
CREATE TABLE users (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
    email NVARCHAR(150),
    password_hash NVARCHAR(100) NOT NULL,
    full_name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(10),
    role_id BIGINT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_login_at DATETIMEOFFSET(6),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE NO ACTION,
    CONSTRAINT ck_users_phone CHECK (phone LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'INACTIVE'))
);
CREATE UNIQUE INDEX uq_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX ix_users_role_id ON users(role_id);

-- Hồ sơ nhân sự (Manager, Lecturer, Teaching Assistant); dùng cho phân công lớp và tính lương.
CREATE TABLE staff_profiles (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    staff_code NVARCHAR(20) NOT NULL,
    position NVARCHAR(30) NOT NULL,
    specialization NVARCHAR(200),
    rate_per_session NUMERIC(12,0) NOT NULL DEFAULT 0,
    hire_date DATE NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_staff_profiles_user_id UNIQUE (user_id),
    CONSTRAINT uq_staff_profiles_staff_code UNIQUE (staff_code),
    CONSTRAINT fk_staff_profiles_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_staff_profiles_position CHECK (position IN ('MANAGER', 'LECTURER', 'TEACHING_ASSISTANT')),
    CONSTRAINT ck_staff_profiles_rate_per_session CHECK (rate_per_session >= 0),
    CONSTRAINT ck_staff_profiles_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- Phụ huynh/người giám hộ. Anh chị em ruột dùng chung 1 guardian (theo SĐT trong file nguồn).
CREATE TABLE guardians (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(10) NOT NULL,
    email NVARCHAR(150),
    relationship NVARCHAR(20) NOT NULL,
    address NVARCHAR(255),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_guardians_phone UNIQUE (phone),
    CONSTRAINT ck_guardians_phone CHECK (phone LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT ck_guardians_relationship CHECK (relationship IN ('FATHER', 'MOTHER', 'GUARDIAN'))
);

-- Cấp độ học theo độ tuổi (KINDY → TEEN 3).
CREATE TABLE levels (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    min_age SMALLINT NOT NULL,
    max_age SMALLINT NOT NULL,
    sort_order SMALLINT NOT NULL,
    CONSTRAINT uq_levels_code UNIQUE (code),
    CONSTRAINT uq_levels_sort_order UNIQUE (sort_order),
    CONSTRAINT ck_levels_min_age CHECK (min_age >= 0),
    CONSTRAINT ck_levels_rule1 CHECK (max_age >= min_age)
);

-- Hồ sơ học viên. Import từ sheet DanhSachHocSinh.
CREATE TABLE students (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    student_code NVARCHAR(10) NOT NULL,
    full_name NVARCHAR(100) NOT NULL,
    english_name NVARCHAR(50),
    date_of_birth DATE NOT NULL,
    guardian_id BIGINT NOT NULL,
    user_id BIGINT,
    current_level_id BIGINT NOT NULL,
    enrolled_at DATE NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    note NVARCHAR(500),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_students_student_code UNIQUE (student_code),
    CONSTRAINT fk_students_guardian_id FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE NO ACTION,
    CONSTRAINT fk_students_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_students_current_level_id FOREIGN KEY (current_level_id) REFERENCES levels(id) ON DELETE NO ACTION,
    CONSTRAINT ck_students_status CHECK (status IN ('ACTIVE', 'ON_HOLD', 'DROPPED', 'GRADUATED')),
    CONSTRAINT ck_students_rule1 CHECK (enrolled_at > date_of_birth)
);
CREATE UNIQUE INDEX uq_students_user_id ON students(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX ix_students_guardian_id ON students(guardian_id);
CREATE INDEX ix_students_current_level_id ON students(current_level_id);

-- Phiếu tuyển sinh/tư vấn. Lead ENROLLED liên kết tới students; dữ liệu nguồn cho AI gợi ý thời điểm tuyển sinh.
CREATE TABLE admission_leads (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    lead_code NVARCHAR(20) NOT NULL,
    child_full_name NVARCHAR(100) NOT NULL,
    child_dob DATE,
    guardian_name NVARCHAR(100) NOT NULL,
    guardian_phone NVARCHAR(10) NOT NULL,
    source NVARCHAR(20) NOT NULL,
    interested_level_id BIGINT,
    placement_score NUMERIC(4,1),
    status NVARCHAR(20) NOT NULL,
    student_id BIGINT,
    consultant_user_id BIGINT,
    converted_at DATE,
    note NVARCHAR(500),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_admission_leads_lead_code UNIQUE (lead_code),
    CONSTRAINT fk_admission_leads_interested_level_id FOREIGN KEY (interested_level_id) REFERENCES levels(id) ON DELETE SET NULL,
    CONSTRAINT fk_admission_leads_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT fk_admission_leads_consultant_user_id FOREIGN KEY (consultant_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_admission_leads_guardian_phone CHECK (guardian_phone LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT ck_admission_leads_source CHECK (source IN ('FACEBOOK', 'ZALO', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'SCHOOL_EVENT')),
    CONSTRAINT ck_admission_leads_placement_score CHECK (placement_score BETWEEN 0 AND 10),
    CONSTRAINT ck_admission_leads_status CHECK (status IN ('NEW', 'CONTACTED', 'TESTED', 'ENROLLED', 'LOST')),
    CONSTRAINT ck_admission_leads_rule1 CHECK ((status = 'ENROLLED' AND student_id IS NOT NULL) OR (status <> 'ENROLLED' AND student_id IS NULL)),
    CONSTRAINT ck_admission_leads_rule2 CHECK ((status = 'ENROLLED' AND converted_at IS NOT NULL) OR (status <> 'ENROLLED' AND converted_at IS NULL))
);
CREATE UNIQUE INDEX uq_admission_leads_student_id ON admission_leads(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX ix_admission_leads_interested_level_id ON admission_leads(interested_level_id);
CREATE INDEX ix_admission_leads_consultant_user_id ON admission_leads(consultant_user_id);

-- Khóa học (chương trình) theo level, kèm học phí chuẩn theo tháng.
CREATE TABLE courses (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    course_code NVARCHAR(20) NOT NULL,
    level_id BIGINT NOT NULL,
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(1000),
    sessions_per_week SMALLINT NOT NULL,
    session_minutes SMALLINT NOT NULL,
    monthly_fee NUMERIC(12,0) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_courses_course_code UNIQUE (course_code),
    CONSTRAINT fk_courses_level_id FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE NO ACTION,
    CONSTRAINT ck_courses_sessions_per_week CHECK (sessions_per_week BETWEEN 1 AND 7),
    CONSTRAINT ck_courses_session_minutes CHECK (session_minutes > 0),
    CONSTRAINT ck_courses_monthly_fee CHECK (monthly_fee >= 0),
    CONSTRAINT ck_courses_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE INDEX ix_courses_level_id ON courses(level_id);

-- Phòng học.
CREATE TABLE rooms (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(10) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    capacity SMALLINT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT uq_rooms_code UNIQUE (code),
    CONSTRAINT ck_rooms_capacity CHECK (capacity > 0),
    CONSTRAINT ck_rooms_status CHECK (status IN ('AVAILABLE', 'MAINTENANCE'))
);

-- Lớp học cụ thể của một khóa; tên lớp giữ đúng file nguồn (Kindy A, Kid 1A…).
CREATE TABLE classes (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    class_code NVARCHAR(20) NOT NULL,
    name NVARCHAR(50) NOT NULL,
    course_id BIGINT NOT NULL,
    lecturer_id BIGINT NOT NULL,
    assistant_id BIGINT,
    default_room_id BIGINT NOT NULL,
    max_students SMALLINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status NVARCHAR(20) NOT NULL,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_classes_class_code UNIQUE (class_code),
    CONSTRAINT uq_classes_name UNIQUE (name),
    CONSTRAINT fk_classes_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE NO ACTION,
    CONSTRAINT fk_classes_lecturer_id FOREIGN KEY (lecturer_id) REFERENCES staff_profiles(id) ON DELETE NO ACTION,
    CONSTRAINT fk_classes_assistant_id FOREIGN KEY (assistant_id) REFERENCES staff_profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_classes_default_room_id FOREIGN KEY (default_room_id) REFERENCES rooms(id) ON DELETE NO ACTION,
    CONSTRAINT ck_classes_max_students CHECK (max_students > 0),
    CONSTRAINT ck_classes_status CHECK (status IN ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_classes_rule1 CHECK (end_date > start_date),
    CONSTRAINT ck_classes_rule2 CHECK (assistant_id IS NULL OR assistant_id <> lecturer_id)
);
CREATE INDEX ix_classes_course_id ON classes(course_id);
CREATE INDEX ix_classes_lecturer_id ON classes(lecturer_id);
CREATE INDEX ix_classes_assistant_id ON classes(assistant_id);
CREATE INDEX ix_classes_default_room_id ON classes(default_room_id);

-- Lịch học lặp hằng tuần của lớp (dùng để sinh class_sessions).
CREATE TABLE class_schedules (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    class_id BIGINT NOT NULL,
    day_of_week SMALLINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_id BIGINT NOT NULL,
    CONSTRAINT uq_class_schedules_class_id_day_of_week_start_time UNIQUE (class_id, day_of_week, start_time),
    CONSTRAINT fk_class_schedules_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_schedules_room_id FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE NO ACTION,
    CONSTRAINT ck_class_schedules_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_class_schedules_rule1 CHECK (end_time > start_time)
);
CREATE INDEX ix_class_schedules_class_id ON class_schedules(class_id);
CREATE INDEX ix_class_schedules_room_id ON class_schedules(room_id);

-- Học viên thuộc lớp nào (lịch sử chuyển lớp giữ ở đây).
CREATE TABLE class_enrollments (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    class_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    enrolled_date DATE NOT NULL,
    left_date DATE,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_class_enrollments_class_id_student_id UNIQUE (class_id, student_id),
    CONSTRAINT fk_class_enrollments_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION,
    CONSTRAINT fk_class_enrollments_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT ck_class_enrollments_status CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'DROPPED', 'COMPLETED')),
    CONSTRAINT ck_class_enrollments_rule1 CHECK (left_date IS NULL OR left_date >= enrolled_date)
);
CREATE INDEX ix_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX ix_class_enrollments_student_id ON class_enrollments(student_id);

-- Từng buổi học thực tế (sinh từ lịch). Nguồn cho điểm danh, lịch dạy GV/TG và lương.
CREATE TABLE class_sessions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    class_id BIGINT NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_id BIGINT NOT NULL,
    lecturer_id BIGINT NOT NULL,
    assistant_id BIGINT,
    status NVARCHAR(20) NOT NULL,
    note NVARCHAR(255),
    CONSTRAINT uq_class_sessions_class_id_session_date_start_time UNIQUE (class_id, session_date, start_time),
    CONSTRAINT fk_class_sessions_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_sessions_room_id FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_class_sessions_lecturer_id FOREIGN KEY (lecturer_id) REFERENCES staff_profiles(id) ON DELETE NO ACTION,
    CONSTRAINT fk_class_sessions_assistant_id FOREIGN KEY (assistant_id) REFERENCES staff_profiles(id) ON DELETE SET NULL,
    CONSTRAINT ck_class_sessions_status CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_class_sessions_rule1 CHECK (end_time > start_time)
);
CREATE INDEX ix_class_sessions_class_id ON class_sessions(class_id);
CREATE INDEX ix_class_sessions_room_id ON class_sessions(room_id);
CREATE INDEX ix_class_sessions_lecturer_id ON class_sessions(lecturer_id);
CREATE INDEX ix_class_sessions_assistant_id ON class_sessions(assistant_id);

-- Điểm danh thủ công từng học viên trong từng buổi (chỉ buổi COMPLETED).
CREATE TABLE attendances (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    session_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    recorded_by BIGINT NOT NULL,
    recorded_at DATETIMEOFFSET(6) NOT NULL,
    note NVARCHAR(255),
    CONSTRAINT uq_attendances_session_id_student_id UNIQUE (session_id, student_id),
    CONSTRAINT fk_attendances_session_id FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendances_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT fk_attendances_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT ck_attendances_status CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED'))
);
CREATE INDEX ix_attendances_session_id ON attendances(session_id);
CREATE INDEX ix_attendances_student_id ON attendances(student_id);
CREATE INDEX ix_attendances_recorded_by ON attendances(recorded_by);

-- Đơn xin nghỉ (LEAVE) / bảo lưu (HOLD) gửi từ tài khoản Student/Parent.
CREATE TABLE student_requests (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    request_code NVARCHAR(20) NOT NULL,
    student_id BIGINT NOT NULL,
    request_type NVARCHAR(10) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason NVARCHAR(500) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    submitted_by BIGINT NOT NULL,
    reviewed_by BIGINT,
    reviewed_at DATETIMEOFFSET(6),
    review_note NVARCHAR(500),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_student_requests_request_code UNIQUE (request_code),
    CONSTRAINT fk_student_requests_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT fk_student_requests_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_student_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_student_requests_request_type CHECK (request_type IN ('LEAVE', 'HOLD')),
    CONSTRAINT ck_student_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_student_requests_rule1 CHECK (to_date >= from_date),
    CONSTRAINT ck_student_requests_rule2 CHECK (status NOT IN ('APPROVED','REJECTED') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX ix_student_requests_student_id ON student_requests(student_id);
CREATE INDEX ix_student_requests_submitted_by ON student_requests(submitted_by);
CREATE INDEX ix_student_requests_reviewed_by ON student_requests(reviewed_by);

-- Chính sách giảm giá (vd: giảm 10% khi có anh chị em cùng học).
CREATE TABLE discount_policies (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    name NVARCHAR(150) NOT NULL,
    discount_type NVARCHAR(10) NOT NULL,
    discount_value NUMERIC(12,2) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_discount_policies_code UNIQUE (code),
    CONSTRAINT ck_discount_policies_discount_type CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
    CONSTRAINT ck_discount_policies_discount_value CHECK (discount_value > 0),
    CONSTRAINT ck_discount_policies_rule1 CHECK (discount_type <> 'PERCENT' OR discount_value <= 100)
);

-- Học viên được áp dụng chính sách giảm giá nào, trong thời gian nào.
CREATE TABLE student_discounts (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    student_id BIGINT NOT NULL,
    discount_policy_id BIGINT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    reason NVARCHAR(255),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_student_discounts_student_id_discount_policy_id_valid_from UNIQUE (student_id, discount_policy_id, valid_from),
    CONSTRAINT fk_student_discounts_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_student_discounts_discount_policy_id FOREIGN KEY (discount_policy_id) REFERENCES discount_policies(id) ON DELETE NO ACTION,
    CONSTRAINT ck_student_discounts_rule1 CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX ix_student_discounts_student_id ON student_discounts(student_id);
CREATE INDEX ix_student_discounts_discount_policy_id ON student_discounts(discount_policy_id);

-- Phiếu học phí hằng tháng của từng học viên. Import từ sheet TheoDoiHocPhi.
CREATE TABLE tuition_invoices (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    invoice_code NVARCHAR(20) NOT NULL,
    student_id BIGINT NOT NULL,
    class_id BIGINT NOT NULL,
    billing_month DATE NOT NULL,
    base_amount NUMERIC(12,0) NOT NULL,
    discount_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
    final_amount NUMERIC(12,0) NOT NULL,
    paid_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status NVARCHAR(20) NOT NULL,
    generated_by NVARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    discount_policy_id BIGINT,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_tuition_invoices_invoice_code UNIQUE (invoice_code),
    CONSTRAINT uq_tuition_invoices_student_id_billing_month UNIQUE (student_id, billing_month),
    CONSTRAINT fk_tuition_invoices_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT fk_tuition_invoices_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION,
    CONSTRAINT fk_tuition_invoices_discount_policy_id FOREIGN KEY (discount_policy_id) REFERENCES discount_policies(id) ON DELETE SET NULL,
    CONSTRAINT ck_tuition_invoices_base_amount CHECK (base_amount >= 0),
    CONSTRAINT ck_tuition_invoices_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT ck_tuition_invoices_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT ck_tuition_invoices_status CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED')),
    CONSTRAINT ck_tuition_invoices_generated_by CHECK (generated_by IN ('MANUAL', 'IMPORT', 'AI_ENGINE')),
    CONSTRAINT ck_tuition_invoices_rule1 CHECK (final_amount = base_amount - discount_amount),
    CONSTRAINT ck_tuition_invoices_rule2 CHECK (paid_amount <= final_amount),
    CONSTRAINT ck_tuition_invoices_rule3 CHECK (due_date >= billing_month),
    CONSTRAINT ck_tuition_invoices_rule4 CHECK ((status = 'PAID' AND paid_amount = final_amount AND final_amount > 0) OR (status <> 'PAID' AND (paid_amount <> final_amount OR final_amount <= 0))),
    CONSTRAINT ck_tuition_invoices_rule5 CHECK (status <> 'UNPAID' OR paid_amount = 0)
);
CREATE INDEX ix_tuition_invoices_student_id ON tuition_invoices(student_id);
CREATE INDEX ix_tuition_invoices_class_id ON tuition_invoices(class_id);
CREATE INDEX ix_tuition_invoices_discount_policy_id ON tuition_invoices(discount_policy_id);

-- Giao dịch thu học phí (1 phiếu có thể thu nhiều lần).
CREATE TABLE payments (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    payment_code NVARCHAR(20) NOT NULL,
    invoice_id BIGINT NOT NULL,
    amount NUMERIC(12,0) NOT NULL,
    method NVARCHAR(20) NOT NULL,
    paid_at DATETIMEOFFSET(6) NOT NULL,
    received_by BIGINT,
    transaction_ref NVARCHAR(50),
    note NVARCHAR(255),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_payments_payment_code UNIQUE (payment_code),
    CONSTRAINT fk_payments_invoice_id FOREIGN KEY (invoice_id) REFERENCES tuition_invoices(id) ON DELETE NO ACTION,
    CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_method CHECK (method IN ('CASH', 'BANK_TRANSFER', 'MOMO', 'VNPAY'))
);
CREATE INDEX ix_payments_invoice_id ON payments(invoice_id);
CREATE INDEX ix_payments_received_by ON payments(received_by);

-- Biên lai phát hành cho mỗi giao dịch thu.
CREATE TABLE receipts (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    receipt_no NVARCHAR(20) NOT NULL,
    payment_id BIGINT NOT NULL,
    issued_at DATETIMEOFFSET(6) NOT NULL,
    issued_by BIGINT,
    CONSTRAINT uq_receipts_receipt_no UNIQUE (receipt_no),
    CONSTRAINT uq_receipts_payment_id UNIQUE (payment_id),
    CONSTRAINT fk_receipts_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE NO ACTION,
    CONSTRAINT fk_receipts_issued_by FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_receipts_issued_by ON receipts(issued_by);

-- Bảng lương theo tháng của GV/TG, tính theo số buổi COMPLETED.
CREATE TABLE staff_payrolls (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    payroll_month DATE NOT NULL,
    session_count SMALLINT NOT NULL,
    rate_per_session NUMERIC(12,0) NOT NULL,
    bonus NUMERIC(12,0) NOT NULL DEFAULT 0,
    deduction NUMERIC(12,0) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,0) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    approved_by BIGINT,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_staff_payrolls_staff_id_payroll_month UNIQUE (staff_id, payroll_month),
    CONSTRAINT fk_staff_payrolls_staff_id FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE NO ACTION,
    CONSTRAINT fk_staff_payrolls_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_staff_payrolls_session_count CHECK (session_count >= 0),
    CONSTRAINT ck_staff_payrolls_rate_per_session CHECK (rate_per_session >= 0),
    CONSTRAINT ck_staff_payrolls_bonus CHECK (bonus >= 0),
    CONSTRAINT ck_staff_payrolls_deduction CHECK (deduction >= 0),
    CONSTRAINT ck_staff_payrolls_status CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
    CONSTRAINT ck_staff_payrolls_rule1 CHECK (total_amount = session_count * rate_per_session + bonus - deduction)
);
CREATE INDEX ix_staff_payrolls_staff_id ON staff_payrolls(staff_id);
CREATE INDEX ix_staff_payrolls_approved_by ON staff_payrolls(approved_by);

-- Danh mục thu/chi toàn trung tâm.
CREATE TABLE finance_categories (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    txn_type NVARCHAR(10) NOT NULL,
    CONSTRAINT uq_finance_categories_code UNIQUE (code),
    CONSTRAINT ck_finance_categories_txn_type CHECK (txn_type IN ('INCOME', 'EXPENSE'))
);

-- Sổ thu/chi toàn trung tâm. Thu học phí liên kết payments; chi lương liên kết staff_payrolls.
CREATE TABLE finance_transactions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    txn_code NVARCHAR(25) NOT NULL,
    category_id BIGINT NOT NULL,
    amount NUMERIC(14,0) NOT NULL,
    txn_date DATE NOT NULL,
    description NVARCHAR(255) NOT NULL,
    payment_id BIGINT,
    payroll_id BIGINT,
    created_by BIGINT,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_finance_transactions_txn_code UNIQUE (txn_code),
    CONSTRAINT fk_finance_transactions_category_id FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE NO ACTION,
    CONSTRAINT fk_finance_transactions_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE NO ACTION,
    CONSTRAINT fk_finance_transactions_payroll_id FOREIGN KEY (payroll_id) REFERENCES staff_payrolls(id) ON DELETE NO ACTION,
    CONSTRAINT fk_finance_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_finance_transactions_amount CHECK (amount > 0),
    CONSTRAINT ck_finance_transactions_rule1 CHECK (payment_id IS NULL OR payroll_id IS NULL)
);
CREATE UNIQUE INDEX uq_finance_transactions_payment_id ON finance_transactions(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX uq_finance_transactions_payroll_id ON finance_transactions(payroll_id) WHERE payroll_id IS NOT NULL;
CREATE INDEX ix_finance_transactions_category_id ON finance_transactions(category_id);
CREATE INDEX ix_finance_transactions_created_by ON finance_transactions(created_by);

-- Thông báo gửi tới từng tài khoản (broadcast được fan-out thành nhiều dòng).
CREATE TABLE notifications (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL,
    notification_type NVARCHAR(20) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    related_invoice_id BIGINT,
    is_read BIT NOT NULL DEFAULT 0,
    read_at DATETIMEOFFSET(6),
    created_by BIGINT,
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT fk_notifications_recipient_user_id FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_related_invoice_id FOREIGN KEY (related_invoice_id) REFERENCES tuition_invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT ck_notifications_notification_type CHECK (notification_type IN ('TUITION', 'SCHEDULE', 'REQUEST', 'GENERAL')),
    CONSTRAINT ck_notifications_rule1 CHECK ((is_read = 1 AND read_at IS NOT NULL) OR (is_read = 0 AND read_at IS NULL))
);
CREATE INDEX ix_notifications_recipient_user_id ON notifications(recipient_user_id);
CREATE INDEX ix_notifications_related_invoice_id ON notifications(related_invoice_id);
CREATE INDEX ix_notifications_created_by ON notifications(created_by);

-- Cảnh báo/gợi ý do AI (hoặc rule) sinh ra, chờ Manager review.
CREATE TABLE ai_alerts (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    alert_type NVARCHAR(30) NOT NULL,
    severity NVARCHAR(10) NOT NULL,
    student_id BIGINT,
    title NVARCHAR(200) NOT NULL,
    detail NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'NEW',
    source NVARCHAR(20) NOT NULL,
    reviewed_by BIGINT,
    reviewed_at DATETIMEOFFSET(6),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT fk_ai_alerts_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_alerts_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_ai_alerts_alert_type CHECK (alert_type IN ('DEBT_RISK', 'LOW_ATTENDANCE', 'TUITION_DATA_ANOMALY', 'FINANCE_RISK', 'ENROLLMENT_RECOMMENDATION')),
    CONSTRAINT ck_ai_alerts_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT ck_ai_alerts_status CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    CONSTRAINT ck_ai_alerts_source CHECK (source IN ('SEED', 'AI_ENGINE'))
);
CREATE INDEX ix_ai_alerts_student_id ON ai_alerts(student_id);
CREATE INDEX ix_ai_alerts_reviewed_by ON ai_alerts(reviewed_by);

-- Văn bản chính sách nội bộ làm kho tri thức cho RAG assistant.
CREATE TABLE policy_documents (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    doc_code NVARCHAR(30) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    category NVARCHAR(30) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    version NVARCHAR(10) NOT NULL,
    effective_date DATE NOT NULL,
    visibility NVARCHAR(20) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_policy_documents_doc_code UNIQUE (doc_code),
    CONSTRAINT ck_policy_documents_category CHECK (category IN ('TUITION', 'ATTENDANCE', 'ADMISSION', 'HR', 'OPERATION')),
    CONSTRAINT ck_policy_documents_visibility CHECK (visibility IN ('MANAGER_ONLY', 'ALL_STAFF')),
    CONSTRAINT ck_policy_documents_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

-- Nhật ký thay đổi dữ liệu nhạy cảm (học phí, thanh toán, quyền, điểm).
CREATE TABLE audit_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    actor_user_id BIGINT,
    action NVARCHAR(20) NOT NULL,
    entity_name NVARCHAR(50) NOT NULL,
    entity_id BIGINT,
    old_data NVARCHAR(MAX),
    new_data NVARCHAR(MAX),
    ip_address NVARCHAR(45),
    created_at DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT fk_audit_logs_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_audit_logs_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE')),
    CONSTRAINT ck_audit_logs_old_data_json CHECK (old_data IS NULL OR ISJSON(old_data) = 1),
    CONSTRAINT ck_audit_logs_new_data_json CHECK (new_data IS NULL OR ISJSON(new_data) = 1)
);
CREATE INDEX ix_audit_logs_actor_user_id ON audit_logs(actor_user_id);
