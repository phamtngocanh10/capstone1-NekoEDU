# Manager academic and people integration

The original screens, routes, controls, menu and CSS are retained. Their data sources and save callbacks now use SQL APIs under `/api/v1/manager`. Existing `/students`, `/guardians`, `/staff`, `/users`, scheduling and tuition APIs remain available.

## Existing UI action inventory

This scope contains **31 user actions** when exports are counted by file format and repeating the same create-class form in two locations is counted once. Local search/filter controls use the fetched SQL rows. Navigation buttons retain their existing destinations.

| Module | Existing actions | Persistence/source | Verification |
|---|---|---|---|
| Students (10) | List, detail, create, edit, archive, import, CSV export, XLSX export, PDF export, import template | `students`, `guardians`, `users`, `student_user_links`, `class_enrollments`; actual invoice/attendance/assessment reads | SQL integration tests for profile, family, account, enrollment, rollback and archive; production build for export code |
| Courses/classes (5) | Course groups, group class list, create class, class detail/roster, roster CSV export | `course_groups`, `courses`, `rooms`, `classes`, `class_schedules`, `class_sessions`, enrollments | SQL integration tests for create, 36 schedules/sessions, capacity/conflicts and refetch; build for roster export |
| Lecturers/assistants (7) | List, detail, create, edit, assign, stop with replacements, teaching week | `users`, `staff_profiles`, class defaults and future scheduled sessions; completed sessions stay unchanged | SQL integration test for create/edit/assignment/replacement/stop; build for weekly display |
| Accounts/permissions (9) | List, create, edit, lock, unlock, archive, matrix read, matrix save, restore defaults | `users` soft-delete/lock metadata, `roles`, `permission_resources`, `role_permissions`, `audit_logs` | SQL integration tests for metadata, duplicate/self protection and 36 permission cells |

The first nine focused SQL tests were executed by the main integration agent and passed. Four additional regression cases were then added for safe class cancellation, shared guardian changes, duplicate/self account changes and profile creation without an available class. Consult the main task report for their final executed result. A successful production build verifies compilation; it is not a claim that every browser control or downloaded file has been manually exercised.

## Rules and boundaries

- Class creation uses the **36 sessions shown in the existing class-detail screen**, deriving dates from the submitted starting date and weekdays. The class, recurrence and 36 scheduled sessions commit together. Both recurring schedules and dated exception sessions are checked for staff/room conflicts.
- A profile can be created without a class. The existing course select supplies an explicit SQL course and therefore its `level_id`; the response has `enrollmentState: pending`. Expired/full classes are excluded from new enrollment options. Existing enrollment does not prevent editing an older student's profile.
- Selecting a class creates an enrollment in the same transaction as the profile, guardian and optional account. Capacity, course membership, level, class state and dates are checked. A failed enrollment rolls back all related new records. Transfers preserve earlier enrollment and level history.
- The fee field lists the actual current **8-session** policy. With no configured policy, the same select displays “Chưa có chính sách học phí”, profiles/enrollments still save, and the response is `invoiceState: pendingPolicy`. This workflow creates **no arbitrary invoice or payment** and never marks an uninvoiced student as paid. The existing tuition workflow owns issuing invoices and the existing 10% sibling policy.
- Guardians are shared by phone in the existing schema. Editing that guardian's phone preserves the guardian identity and updates every linked child's contact. The guardian change is audited and the save response/toast identifies the number of linked students.
- Student deletion archives the student and closes active enrollments, preserving attendance, results, family links and financial records. Account deletion revokes login and records `deleted_at/deleted_by`; it does not delete the user row. Active class assignment prevents account deletion.
- Empty classes can be cancelled while retaining all session rows. Classes with enrollment/history or already completed are rejected with an explicit conflict. Class date/time changes use the existing calendar workflow instead of rewriting historical sessions.
- Staff assignment and replacement validate position and conflicts. Existing completed sessions are retained. Schedule changes on classes with dated sessions are rejected here with directions to the calendar workflow.
- Permission values persist as `DENY`, `CONDITIONAL`, `ALLOW`. Conditional values retain the existing row/role scopes. The shared middleware applies configured denials; stored permission values cannot expand the static authorization rules. Managers retain a way to repair the permission matrix.
- A selected email option on account locking does not falsely report delivery. The API returns `emailSent: false` with an explicit message until a mail provider is configured. Internal staff-replacement notifications are actual `notifications` rows.
- Imports accept UTF-8 CSV and XLSX, at most 500 rows/5 MB, and validate the same form fields. All rows commit together. The downloaded import template uses these machine headers: `fullName,birth,gender,address,parentPhone,parentName,parentRelationship,email,course,className,fee,password,note`. `course` is a SQL course ID/name (or the group name when a selected class disambiguates it); dates accept `dd/mm/yyyy` or ISO. Leave `fee` blank when no policy exists.
- CSV, XLSX and PDF exports use the fetched SQL rows. XLSX uses the existing ExcelJS dependency. PDF contains rendered text pages, not a renamed CSV. No schema migration or live database write was needed for this scope.

## Added endpoints

All endpoints require a Manager account. Registration is in the shared router owned by the main integration agent.

| Method | Path after `/api/v1/manager` | Purpose |
|---|---|---|
| GET | `/catalog` | Actual SQL course, available room/staff and fee options |
| GET | `/courses` | Existing course-group cards with SQL aggregates |
| GET, POST | `/classes` | List / transactional create |
| GET, PUT, DELETE | `/classes/{id}` | Detail / safe metadata update / safe cancellation |
| POST | `/classes/{id}/enrollments` | Validated enrollment |
| POST | `/catalog/courses` | Create course catalog record |
| PUT, DELETE | `/catalog/courses/{id}` | Update / deactivate course |
| GET, POST | `/rooms` | List / create room |
| PUT, DELETE | `/rooms/{id}` | Update / mark room unavailable, rejecting active usage |
| GET, POST | `/students` | SQL form rows / transactional profile creation |
| GET | `/students/{code-or-id}` | Profile with actual attendance/results/invoice state |
| PATCH, DELETE | `/students/{id}` | Profile/guardian/account/enrollment update / archive |
| POST | `/students/import` | Atomic multipart CSV/XLSX import |
| GET, POST | `/lecturers` | List / staff and login creation |
| GET, PUT | `/lecturers/{id}` | Staff detail / profile and login update |
| POST | `/lecturers/{id}/assignments` | Staff assignment |
| POST | `/lecturers/{id}/stop` | Validated replacements then staff deactivation |
| GET, POST | `/accounts` | Account list / create |
| PUT, DELETE | `/accounts/{id}` | Account edit / soft-delete |
| POST | `/accounts/{id}/lock` | Lock reason/deadline and token version |
| POST | `/accounts/{id}/unlock` | Unlock and clear lock metadata |
| GET, PUT | `/roles/{role}/permissions` | Matrix read / save (GET `defaults=true` supplies policy defaults) |

## Scoped files

Backend: `app/routers/management_router.py`, `app/schemas/management_schema.py`, `app/services/management_service.py`, the optional `commit=False` extension of `student_service.create_student`, and `tests/test_integration_academic.py`.

Frontend: the existing `api/students.js`, `courses.js`, `lecturers.js`, `accounts.js`; new `api/studentExports.js`; data sources and handlers under `Manager/components/HocVien`, `KhoaHoc`, `GiangVien` and `PhanQuyen`. Shared auth, profile, client, ManagerContext and FormModal changes are owned by the main integration agent.

Tests must run only with an explicitly configured disposable database whose name ends `_test`. The session fixture verifies the actual database identity before destructive test setup. Never point pytest at `NEKO_EDU`; no migration, reset, seed or test writes were run against that live database by this scope.
