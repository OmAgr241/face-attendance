# IMPLEMENTATION PROMPT — Multi-Teacher, Multi-Branch, Per-Subject Attendance System

> **INSTRUCTIONS**: Feed this entire file as a prompt to implement the full feature set described below. Do NOT skip any section. Implement all 5 phases in order. Preserve all existing functionality and data.

---

## PROJECT CONTEXT

This is a **Face Recognition Attendance System** with:
- **Backend**: Python Flask + SQLite (`backend/`)
- **Frontend**: React + Vite + TailwindCSS v4 (`frontend/`)
- **Face Recognition**: `face_recognition` library + OpenCV for camera streaming
- **Current Auth**: Single admin account (admin/admin123), UUID token auth
- **Current Attendance**: One record per student per day (`UNIQUE(student_id, date)`)
- **Current Camera**: Singleton `CameraService` — one MJPEG stream, two-thread architecture (capture thread + recognition thread)

The system currently has: Login, Dashboard, Student Management, Attendance List, Analytics, Live Camera (with TTS + bounding boxes), Excel Exports.

---

## WHAT TO BUILD

### Feature 1: Multi-Teacher & Multi-Branch
- Multiple **teacher accounts** (created by admin)
- Multiple **admin accounts** (for HODs)
- **Predefined branches** managed by admin (CSE, ISE, ECE, etc.)
- **Predefined subjects** managed by admin (Mathematics, Physics, etc.)
- **Class Groups** — the core concept: a class group = **Teacher + Branch + Section + Subject**
  - Teachers create their own class groups from admin-defined branches and subjects
  - Example: Teacher X has class groups: "CSE-A Math", "CSE-B Math", "ISE-A Physics"

### Feature 2: Per-Subject Attendance (Multiple Per Day)
- Attendance tracked **per class group**, not per day
- A student can be Present for Math but Absent for Physics on the same day
- **No limit** on how many times attendance can be taken for the same class group per day
- Remove `UNIQUE(student_id, date)` constraint → replace with per-class-group session dedup

---

## AGREED DESIGN DECISIONS

| Decision | Answer |
|---|---|
| Who creates teachers? | Admin creates teacher accounts (username + password, minimal info) |
| Who creates class groups? | Teachers create their own class groups (picking from admin-defined branches + subjects) |
| Who registers students? | Both admin (any student) and teachers (only for their own branch/section) |
| What can teachers see? | Only their own class groups, their students (by branch+section match), their attendance |
| What can admin see? | Everything globally + manage teachers/subjects/branches. Admin CANNOT take camera attendance |
| Login flow | Same `/login` page, backend auto-detects role from username (checks admin table first, then teacher table) |
| Multiple admins? | Yes — allow multiple admin accounts |
| Camera flow | Teacher selects class group → starts camera → only students matching that class group's branch+section are recognized |
| Attendance dedup | No limit per class group per day — unlimited sessions allowed |
| Student-class relationship | Student belongs to ONE branch+section. ALL teachers who teach that branch+section auto-see the student |
| Student cap per class | No limit |
| Excel exports | Available to both admin (all data) and teachers (their own class groups) |

---

## PHASE 1: DATABASE SCHEMA CHANGES

### File: `backend/database.py`

Add these NEW tables to `init_db()`:

```sql
-- Teacher accounts (created by admin)
CREATE TABLE IF NOT EXISTS teacher (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- Admin-managed subject master list
CREATE TABLE IF NOT EXISTS subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE,
    created_at TEXT NOT NULL
);

-- Admin-managed branch master list
CREATE TABLE IF NOT EXISTS branch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TEXT NOT NULL
);

-- Teacher's class groups (teacher + branch + section + subject)
CREATE TABLE IF NOT EXISTS class_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    section TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    semester TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branch(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id),
    UNIQUE(teacher_id, branch_id, section, subject_id)
);
```

### Modify `admin` table:
```sql
ALTER TABLE admin ADD COLUMN name TEXT DEFAULT 'Admin';
```

### Modify `student` table:
- Add `branch_id INTEGER` column (FK to `branch` table)
- Keep `branch TEXT` temporarily for migration, then drop it
- Keep `section TEXT` as-is

### Modify `attendance` table:
- **ADD** `class_group_id INTEGER` (FK to `class_group`, nullable for legacy records)
- **ADD** `session_label TEXT` (optional, e.g., "Period 1")
- **REMOVE** the `UNIQUE(student_id, date)` constraint
- The new dedup is done in-memory per camera session: `(student_id, class_group_id)` per session

### Data Migration:
1. Create new tables
2. Extract distinct `student.branch` values → insert into `branch` table
3. Add `branch_id` to `student` → populate from `branch` table lookups
4. Add `class_group_id` to `attendance` (NULL for old records is fine)
5. Rebuild `attendance` table without the `UNIQUE(student_id, date)` constraint (SQLite doesn't support DROP CONSTRAINT, so recreate the table)

---

## PHASE 2: AUTH & ROLE SYSTEM

### Modify: `backend/routes/auth.py`

- **Login**: Check `admin` table first, then `teacher` table. Return `{token, user_id, role: "admin"|"teacher", name}`.
- **Token store**: Change from `{token: admin_id}` to `{token: {id, role, name}}`.
- **`auth_required` decorator**: Set `g.user_id`, `g.role`, `g.user_name`.
- **New `admin_required` decorator**: Wraps `auth_required` + rejects if `g.role != "admin"`.
- **New `teacher_required` decorator**: Wraps `auth_required` + rejects if `g.role != "teacher"`.

### New: `backend/models/teacher.py`
- `create_teacher(name, username, password, email=None, phone=None)` — hash password with bcrypt
- `get_all_teachers()` — list all teachers
- `get_teacher_by_id(teacher_id)`
- `delete_teacher(teacher_id)`
- `verify_teacher(username, password)` — for login
- `update_teacher(teacher_id, **fields)`

### Modify: `backend/models/admin.py`
- Add `create_admin(name, username, password)`
- Add `get_all_admins()`
- Keep existing `verify_admin()`

---

## PHASE 3: ADMIN MANAGEMENT APIs

### New: `backend/routes/admin_management.py`

All routes require `@admin_required`:

```
POST   /api/admin/teachers           — Create teacher {name, username, password}
GET    /api/admin/teachers           — List all teachers
DELETE /api/admin/teachers/:id       — Delete teacher

POST   /api/admin/subjects           — Create subject {name, code}
GET    /api/admin/subjects           — List all subjects (also available to teachers for dropdowns)
PUT    /api/admin/subjects/:id       — Update subject
DELETE /api/admin/subjects/:id       — Delete subject

POST   /api/admin/branches           — Create branch {name, full_name}
GET    /api/admin/branches           — List all branches (also available to teachers for dropdowns)
PUT    /api/admin/branches/:id       — Update branch
DELETE /api/admin/branches/:id       — Delete branch

POST   /api/admin/admins             — Create another admin {name, username, password}
GET    /api/admin/admins             — List all admins
```

### New: `backend/models/subject.py`
- CRUD for subjects: `create_subject()`, `get_all_subjects()`, `update_subject()`, `delete_subject()`

### New: `backend/models/branch_model.py`
- CRUD for branches: `create_branch()`, `get_all_branches()`, `update_branch()`, `delete_branch()`

### Public lookup routes (no admin required, just auth):
```
GET /api/subjects    — List all subjects (for teacher dropdowns)
GET /api/branches    — List all branches (for teacher dropdowns)
```

Register the new blueprint in `app.py`.

---

## PHASE 4: TEACHER APIs, CLASS GROUPS & CAMERA

### New: `backend/routes/teacher.py`

All routes require `@teacher_required`:

```
# --- Class Groups ---
POST   /api/teacher/class-groups              — Create class group {branch_id, section, subject_id, semester?}
GET    /api/teacher/class-groups              — List teacher's class groups (with branch name + subject name joined)
DELETE /api/teacher/class-groups/:id          — Delete (only if teacher owns it)

# --- Students (filtered to teacher's branch+section combinations) ---
GET    /api/teacher/students                  — List students matching teacher's class groups
POST   /api/teacher/students                  — Register student {name, roll_number, branch_id, section, ...}
                                                Validate: branch+section must match one of teacher's class groups

# --- Attendance ---
GET    /api/teacher/attendance?class_group_id=X&date=Y  — Attendance records for a class group
GET    /api/teacher/attendance/stats                     — Stats across all teacher's class groups
GET    /api/teacher/attendance/analytics                 — Analytics for teacher's class groups

# --- Exports ---
GET    /api/teacher/attendance/export/daily?class_group_id=X
GET    /api/teacher/attendance/export/summary?class_group_id=X
```

Register the new blueprint in `app.py`.

### Modify: `backend/services/camera_service.py`

- `start(camera_index, class_group_id)` — takes class group ID
- On start, look up the class group → get `branch_id` + `section`
- Load encodings ONLY for students matching that `branch_id` + `section` (not all students)
- Change `load_all_encodings()` call → `load_encodings_for_class(branch_id, section)`
- `_marked_today` dedup keyed by `(student_id, class_group_id)`
- Store `class_group_id` on the service instance so attendance records include it

### Modify: `backend/services/attendance_service.py`

- `mark_attendance(student_id, frame, camera_source, confidence, class_group_id)`
- Dedup check: instead of `WHERE student_id = ? AND date = ?`, use in-memory session dedup only (no DB-level dedup since unlimited sessions are allowed)
- Insert `class_group_id` into attendance record

### Modify: `backend/services/face_service.py`

- Add `load_encodings_for_class(branch_id, section)`:
  ```python
  def load_encodings_for_class(branch_id, section):
      conn = get_db()
      rows = conn.execute("""
          SELECT sf.student_id, sf.face_encoding 
          FROM student_face sf
          JOIN student s ON sf.student_id = s.id
          WHERE s.branch_id = ? AND s.section = ?
      """, (branch_id, section)).fetchall()
      conn.close()
      return [(row['student_id'], deserialize_encoding(row['face_encoding'])) for row in rows]
  ```

### Modify: `backend/routes/camera.py`

- `POST /api/camera/start` — require `class_group_id` in body + validate teacher owns it
- `GET /api/camera/status` — return `class_group_id` + class group info
- Camera routes need `@teacher_required` (admin cannot use camera)

### Modify: `backend/models/attendance.py`

- All query functions: add `class_group_id` filter parameter
- `get_attendance_records()` — add optional `class_group_id` filter
- `get_today_attendance()` — add optional `class_group_id` filter
- `get_attendance_stats()` — accept list of class_group_ids for teacher-scoped stats
- `get_analytics_data()` — accept list of class_group_ids
- Update Excel export functions similarly

### Modify: `backend/routes/attendance.py`

- Existing admin attendance routes stay (admin sees everything)
- Add class_group_id filter support to existing routes

### Modify: `backend/routes/students.py`

- Existing admin student routes stay (admin sees all students)
- Teacher student routes in `routes/teacher.py` are filtered

---

## PHASE 5: FRONTEND CHANGES

### Design Principles:
- Keep the existing dark theme, glassmorphism, mono font aesthetic
- Use the same CSS variables from `index.css`
- All new pages should match the premium look of existing pages
- Use lucide-react icons consistently

### Modify: `frontend/src/api/client.js`
- No changes needed (already sends Bearer token)

### Modify: `frontend/src/App.jsx`
- Store `role` in localStorage on login
- Add route guards:
  - Admin routes: `/dashboard`, `/students`, `/attendance`, `/analytics`, `/admin/*`
  - Teacher routes: `/teacher/*`, `/live`
  - Redirect based on role after login
- Add new routes:
  ```
  /admin/teachers     → ManageTeachers
  /admin/subjects     → ManageSubjects
  /admin/branches     → ManageBranches
  /teacher/dashboard  → TeacherDashboard
  /teacher/classes    → MyClassGroups
  /teacher/attendance → TeacherAttendance
  /teacher/analytics  → TeacherAnalytics
  /teacher/students   → TeacherStudents
  ```

### Modify: `frontend/src/pages/Login.jsx`
- After login, read `role` from response
- Store `role` in localStorage
- Redirect: admin → `/dashboard`, teacher → `/teacher/dashboard`

### Modify: `frontend/src/components/Navbar.jsx`
- Read role from localStorage
- Admin nav: Dashboard, Students, Attendance, Analytics, **Teachers**, **Subjects**, **Branches**
- Teacher nav: Dashboard, My Classes, Students, Attendance, Analytics, **Live Camera**
- Show logged-in user name + role badge

### New: `frontend/src/pages/admin/ManageTeachers.jsx`
- Glass card table of all teachers (name, username, email, status, created_at)
- "Add Teacher" button → modal/form with name, username, password fields
- Delete button per row with confirmation
- Use same table styling as AttendanceTable

### New: `frontend/src/pages/admin/ManageSubjects.jsx`
- Glass card table of subjects (name, code, created_at)
- Add/Edit/Delete with inline or modal forms

### New: `frontend/src/pages/admin/ManageBranches.jsx`
- Glass card table of branches (name, full_name, created_at)
- Add/Edit/Delete with inline or modal forms

### New: `frontend/src/pages/teacher/TeacherDashboard.jsx`
- Stats cards: total class groups, total students across groups, attendance today per group
- Per-class-group summary cards showing today's attendance count
- Quick actions: Start Camera (per class group), View Attendance, View Analytics

### New: `frontend/src/pages/teacher/MyClassGroups.jsx`
- List of teacher's class groups as cards/table
- Each shows: Branch + Section + Subject + student count
- "Create Class Group" form: dropdowns for branch (from API), section (text input), subject (from API)
- Delete button per group

### New: `frontend/src/pages/teacher/TeacherAttendance.jsx`
- Class group selector dropdown at top
- Attendance table filtered by selected class group
- Date filter
- Session label shown if present
- Excel export button

### New: `frontend/src/pages/teacher/TeacherAnalytics.jsx`
- Same charts as Analytics.jsx but filtered to teacher's class groups
- Class group selector to view specific group analytics

### Modify: `frontend/src/pages/LiveAttendance.jsx`
- Add **class group selector** dropdown (fetch from `/api/teacher/class-groups`)
- Teacher MUST select a class group before "START CAMERA" is enabled
- Pass `class_group_id` in the start camera API call
- Show selected class group info banner (e.g., "CSE - Section A - Mathematics")
- Optional: session label text input

### Modify: `frontend/src/pages/Dashboard.jsx` (admin)
- Add quick-access cards/links to: Manage Teachers, Manage Subjects, Manage Branches
- Keep existing stats (global view)

---

## IMPLEMENTATION ORDER

1. **Phase 1** — Database schema + migration script
2. **Phase 2** — Auth system + teacher model
3. **Phase 3** — Admin management APIs + models
4. **Phase 4** — Teacher APIs + camera/attendance modifications
5. **Phase 5** — Frontend (admin pages first, then teacher pages, then LiveAttendance modifications)

## VERIFICATION CHECKLIST

After implementing, verify:
- [ ] Admin can log in and see global dashboard
- [ ] Admin can create/list/delete teachers
- [ ] Admin can create/list/edit/delete subjects
- [ ] Admin can create/list/edit/delete branches
- [ ] Admin can create additional admin accounts
- [ ] Admin can see all students, attendance, analytics globally
- [ ] Teacher can log in and see teacher dashboard
- [ ] Teacher can create class groups (picking from admin-defined branches + subjects)
- [ ] Teacher can see only students matching their class groups' branch+section
- [ ] Teacher can register students (only for their branch/section)
- [ ] Teacher can start camera with a selected class group
- [ ] Camera only recognizes students in the selected class group's branch+section
- [ ] Attendance records include class_group_id
- [ ] Same student can have attendance for multiple class groups on same day
- [ ] Teacher can only see their own attendance records
- [ ] Teacher can export Excel for their class groups
- [ ] Admin CANNOT start camera (no live attendance for admin)
- [ ] TTS and bounding boxes still work correctly
- [ ] All existing data is preserved after migration
- [ ] Login auto-detects role and redirects correctly
