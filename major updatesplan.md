# Major Update: Multi-Teacher, Multi-Branch, Per-Subject Attendance System

## Problem Summary

The current system has a single admin, one attendance record per student per day, and no concept of subjects or classes. We need to transform it into a multi-teacher system where:

- Multiple teachers each manage their own class groups (Branch + Section + Subject)
- Attendance is tracked **per class group** (a student can be Present for Math but Absent for Physics on the same day)
- Teachers only see their own students/data
- An admin (super-admin) manages teachers, subjects, branches, and sees everything
- The camera only recognizes students belonging to the selected class group

---

## Agreed Design Decisions

| Decision | Answer |
|---|---|
| **Who creates teachers?** | Admin creates teacher accounts (username/password) |
| **Who creates class groups?** | Teachers create their own class groups from predefined branches + subjects |
| **Who registers students?** | Both admin and teachers (teachers only for their branch/section) |
| **What can teachers see?** | Only their own class groups, students, and attendance |
| **What can admin see?** | Everything globally + manage teachers/subjects/branches |
| **Can admin take attendance?** | No — admin is a manager only |
| **Login flow** | Same login page, backend auto-detects role (admin vs teacher) |
| **Multiple admins?** | Yes — allow multiple admin accounts (for HODs) |
| **Camera flow** | Teacher selects class group → starts camera → only that group's students are recognized |
| **Attendance dedup** | No limit per class group per day — teacher can take attendance multiple times |
| **Student-class relationship** | Student belongs to ONE branch+section. All teachers teaching that group auto-see the student |
| **Subjects** | Predefined master list managed by admin |
| **Branches** | Predefined master list managed by admin |
| **Excel exports** | Available to both admin (all data) and teachers (their class groups) |
| **Multi-camera (future)** | Plan for both: per-classroom devices + one server managing multiple cameras |

---

## Phase 1: Database Schema Changes

> [!IMPORTANT]
> This is the foundation. All other phases depend on getting the schema right. We must migrate existing data.

### New Tables

#### `teacher` table
```sql
CREATE TABLE teacher (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);
```

#### `subject` table (admin-managed master list)
```sql
CREATE TABLE subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,        -- e.g., "Mathematics", "Physics"
    code TEXT UNIQUE,                 -- e.g., "MATH101"
    created_at TEXT NOT NULL
);
```

#### `branch` table (admin-managed master list)
```sql
CREATE TABLE branch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,        -- e.g., "CSE", "ISE", "ECE"
    full_name TEXT,                   -- e.g., "Computer Science & Engineering"
    created_at TEXT NOT NULL
);
```

#### `class_group` table (teacher creates these)
```sql
CREATE TABLE class_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    section TEXT NOT NULL,            -- e.g., "A", "B"
    subject_id INTEGER NOT NULL,
    semester TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branch(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id),
    UNIQUE(teacher_id, branch_id, section, subject_id)  -- No duplicate class groups per teacher
);
```

### Modified Tables

#### `admin` table — add `name` column
```sql
ALTER TABLE admin ADD COLUMN name TEXT DEFAULT 'Admin';
```

#### `student` table — change `branch` from free text → FK
```sql
-- student.branch becomes branch_id (FK to branch table)
-- student.section stays as TEXT
-- Migration: create branch entries from existing distinct values, then update FKs
```

#### `attendance` table — add `class_group_id`, remove `UNIQUE(student_id, date)`
```sql
-- OLD: UNIQUE(student_id, date)     — one record per student per day
-- NEW: No unique constraint          — multiple records per student per day (different class groups)
-- ADD: class_group_id INTEGER        — which class group this attendance belongs to
-- ADD: session_label TEXT            — optional label like "Period 1", "Period 2"
```

### Data Migration Strategy

1. Create new tables (`teacher`, `subject`, `branch`, `class_group`)
2. Extract distinct branches from `student.branch` → populate `branch` table
3. Add `branch_id` column to `student` → populate from `branch` table → drop old `branch` TEXT column
4. Add `class_group_id` column to `attendance` (nullable for legacy records)
5. Drop `UNIQUE(student_id, date)` constraint from `attendance`

> [!WARNING]
> The existing `attendance.db` has data. We need a careful migration script that preserves all existing records. Legacy records without `class_group_id` will have it as NULL.

---

## Phase 2: Backend — Auth & Role System

### [MODIFY] [auth.py](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/backend/routes/auth.py)

- Update login to check BOTH `admin` and `teacher` tables
- Return `role` field in login response: `"admin"` or `"teacher"`
- Store role + user ID in token map: `{token: {id, role}}`
- Update `auth_required` decorator to set `g.role` and `g.user_id`
- Add `admin_required` decorator (rejects teachers)
- Add `teacher_required` decorator (rejects admins on teacher-only routes)

### [NEW] `models/teacher.py`
- CRUD for teacher accounts
- `create_teacher(name, username, password)`
- `get_all_teachers()`
- `get_teacher_by_id(id)`
- `delete_teacher(id)`
- `verify_teacher(username, password)` — for login

### [MODIFY] `models/admin.py`
- Support multiple admin accounts
- Add `create_admin()`, `get_all_admins()`

---

## Phase 3: Backend — Admin Management APIs

### [NEW] `routes/admin_management.py`

Admin-only routes for managing the system:

```
POST   /api/admin/teachers           — Create a teacher account
GET    /api/admin/teachers           — List all teachers
DELETE /api/admin/teachers/:id       — Delete a teacher

POST   /api/admin/subjects           — Create a subject
GET    /api/admin/subjects           — List all subjects
PUT    /api/admin/subjects/:id       — Update a subject
DELETE /api/admin/subjects/:id       — Delete a subject

POST   /api/admin/branches           — Create a branch
GET    /api/admin/branches           — List all branches
PUT    /api/admin/branches/:id       — Update a branch
DELETE /api/admin/branches/:id       — Delete a branch

POST   /api/admin/admins             — Create another admin account
GET    /api/admin/admins             — List all admins
```

### [NEW] `models/subject.py`
- CRUD for subjects

### [NEW] `models/branch_model.py`
- CRUD for branches

---

## Phase 4: Backend — Teacher APIs & Class Groups

### [NEW] `routes/teacher.py`

Teacher-specific routes:

```
# --- Class Groups ---
POST   /api/teacher/class-groups              — Create a class group (branch+section+subject)
GET    /api/teacher/class-groups              — List teacher's class groups
DELETE /api/teacher/class-groups/:id          — Delete a class group

# --- Students (filtered to teacher's branch+section) ---
GET    /api/teacher/students                  — List students in teacher's class groups
POST   /api/teacher/students                  — Register a student (to teacher's branch/section)

# --- Attendance (filtered to teacher's class groups) ---
GET    /api/teacher/attendance?class_group_id=X  — Get attendance for a class group
GET    /api/teacher/attendance/stats              — Dashboard stats for teacher's classes
GET    /api/teacher/attendance/analytics          — Analytics for teacher's classes

# --- Exports ---
GET    /api/teacher/attendance/export/daily       — Excel export (filtered)
GET    /api/teacher/attendance/export/summary     — Summary export (filtered)
```

### [MODIFY] `services/camera_service.py`

Major change: Camera now operates in context of a **class group**.

- `start(camera_index, class_group_id)` — takes a class group ID
- Only loads face encodings for students matching the class group's `branch_id + section`
- `_known_encodings` filtered to class group's students only
- Attendance records include `class_group_id`

### [MODIFY] `services/attendance_service.py`

- `mark_attendance(student_id, frame, camera_source, confidence, class_group_id)`
- Remove `UNIQUE(student_id, date)` dedup — replace with per-class-group dedup within a session
- In-memory session dedup: `_marked_today` keyed by `(student_id, class_group_id)`

### [MODIFY] `routes/camera.py`

- `POST /api/camera/start` now requires `class_group_id` in body
- Add `teacher_id` validation — teacher must own the class group
- Return class group info in `/api/camera/status`

---

## Phase 5: Frontend Changes

### Auth & Routing

#### [MODIFY] [App.jsx](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/frontend/src/App.jsx)
- Store `role` in localStorage alongside token
- Route guards: admin pages vs teacher pages
- Redirect based on role after login

#### [MODIFY] [Login.jsx](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/frontend/src/pages/Login.jsx)
- Same login page (backend auto-detects role)
- After login, redirect to `/dashboard` (admin) or `/teacher/dashboard` (teacher)

---

### Admin Pages

#### [NEW] `pages/admin/ManageTeachers.jsx`
- Table of all teachers
- Create teacher form (name, username, password)
- Delete teacher button

#### [NEW] `pages/admin/ManageSubjects.jsx`
- Table of all subjects
- Add subject form (name, code)
- Edit/delete

#### [NEW] `pages/admin/ManageBranches.jsx`
- Table of all branches
- Add branch form (name, full_name)
- Edit/delete

#### [MODIFY] [Dashboard.jsx](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/frontend/src/pages/Dashboard.jsx)
- Add navigation links to teacher/subject/branch management
- Show global stats across all class groups

#### [MODIFY] [Navbar.jsx](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/frontend/src/components/Navbar.jsx)
- Show different nav items based on role
- Admin: Dashboard, Students, Attendance, Analytics, **Manage Teachers**, **Manage Subjects**, **Manage Branches**
- Teacher: Dashboard, My Classes, Students, Attendance, Analytics, Live Camera

---

### Teacher Pages

#### [NEW] `pages/teacher/TeacherDashboard.jsx`
- Stats for teacher's class groups only
- Today's attendance summary per class group
- Quick-access to start camera for each class group

#### [NEW] `pages/teacher/MyClassGroups.jsx`
- List of teacher's class groups (Branch + Section + Subject)
- Create new class group (select from admin-defined branches + subjects)
- Delete class group

#### [NEW] `pages/teacher/TeacherAttendance.jsx`
- Attendance records filtered by class group
- Filter by date, class group
- Excel export for selected class group

#### [NEW] `pages/teacher/TeacherAnalytics.jsx`
- Analytics filtered to teacher's class groups
- Per-class-group attendance trends

#### [MODIFY] [LiveAttendance.jsx](file:///d:/code%20playground/anti%20gravity/opencode/face-attendance/frontend/src/pages/LiveAttendance.jsx)
- Add **class group selector** dropdown before camera controls
- Teacher MUST select a class group before starting camera
- Show selected class group info prominently
- Optional: session label input (e.g., "Period 1")

---

## Future: Multi-Camera Architecture (Not implementing now)

> [!NOTE]
> These are planned for future phases. Documenting the architecture now.

### Option A: Per-Classroom Devices
- Each classroom runs its own backend instance (e.g., on Raspberry Pi)
- All instances connect to a shared cloud database (PostgreSQL/MySQL instead of SQLite)
- Teacher logs in from any device → data syncs via shared DB

### Option B: Central Server, Multiple Cameras
- One central server manages multiple camera streams
- `CameraService` becomes a registry of camera sessions: `{camera_id: CameraSession}`
- Each camera session is tied to a `class_group_id`
- API: `POST /api/camera/start {camera_index, class_group_id}` — can run multiple simultaneously
- Requires moving from singleton to multi-instance pattern

### Database Migration for Cloud (Future)
- Migrate from SQLite → PostgreSQL
- Add proper connection pooling
- Add `institution_id` for multi-tenant support

---

## Verification Plan

### Automated Tests
- Test login for admin vs teacher → correct role returned
- Test teacher can only see their own class groups/students
- Test attendance with class_group_id works
- Test admin can see everything
- Test camera filters encodings by class group

### Manual Verification
1. Create admin → create branches → create subjects
2. Create teacher account → login as teacher
3. Teacher creates class groups → registers students
4. Teacher starts camera for specific class group → only those students recognized
5. Take attendance for same students under different class groups on same day
6. Verify teacher dashboard shows only their data
7. Verify admin sees everything
8. Test Excel exports for both roles

---

## File Change Summary

| Category | Files | Type |
|---|---|---|
| **Database** | `database.py` | MODIFY |
| **Models** | `teacher.py`, `subject.py`, `branch_model.py` | NEW |
| **Models** | `admin.py`, `student.py`, `attendance.py` | MODIFY |
| **Auth** | `auth.py` | MODIFY |
| **Routes** | `admin_management.py`, `teacher.py` | NEW |
| **Routes** | `camera.py`, `attendance.py`, `students.py` | MODIFY |
| **Services** | `camera_service.py`, `attendance_service.py` | MODIFY |
| **Frontend Pages** | `ManageTeachers.jsx`, `ManageSubjects.jsx`, `ManageBranches.jsx` | NEW |
| **Frontend Pages** | `TeacherDashboard.jsx`, `MyClassGroups.jsx`, `TeacherAttendance.jsx`, `TeacherAnalytics.jsx` | NEW |
| **Frontend Pages** | `Login.jsx`, `Dashboard.jsx`, `LiveAttendance.jsx` | MODIFY |
| **Frontend** | `App.jsx`, `Navbar.jsx`, `client.js` | MODIFY |
| **Config** | `config.py` | MODIFY |

**Estimated scope**: ~20 files modified/created across backend + frontend
