# --- Student Model ---
# CRUD operations for students and attendance percentage calculation.

from datetime import datetime
from database import get_db


def create_student(name, roll_number, branch=None, semester=None, section=None, email=None, phone=None):
    """Create a new student record. Returns the new student's ID."""
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO student (name, roll_number, branch, semester, section, email, phone, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, roll_number, branch, semester, section, email, phone, datetime.now().isoformat())
        )
        conn.commit()
        student_id = cursor.lastrowid
        return student_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_all_students():
    """Get all students with their attendance percentage."""
    conn = get_db()
    students = conn.execute("SELECT * FROM student ORDER BY name").fetchall()
    result = []
    for s in students:
        student_dict = dict(s)
        student_dict['attendance_percentage'] = _calc_attendance_pct(conn, s['id'])
        # --- Get face count ---
        face_count = conn.execute(
            "SELECT COUNT(*) FROM student_face WHERE student_id = ?", (s['id'],)
        ).fetchone()[0]
        student_dict['face_count'] = face_count
        result.append(student_dict)
    conn.close()
    return result


def get_student_by_id(student_id):
    """Get a single student with attendance percentage."""
    conn = get_db()
    student = conn.execute("SELECT * FROM student WHERE id = ?", (student_id,)).fetchone()
    if student is None:
        conn.close()
        return None
    student_dict = dict(student)
    student_dict['attendance_percentage'] = _calc_attendance_pct(conn, student_id)
    # --- Get face images ---
    faces = conn.execute(
        "SELECT id, face_image_path, created_at FROM student_face WHERE student_id = ?",
        (student_id,)
    ).fetchall()
    student_dict['faces'] = [dict(f) for f in faces]
    # --- Get face count ---
    student_dict['face_count'] = len(student_dict['faces'])
    conn.close()
    return student_dict


def delete_student(student_id):
    """Delete a student and all related data (faces, attendance cascade via FK)."""
    conn = get_db()
    conn.execute("DELETE FROM student WHERE id = ?", (student_id,))
    conn.commit()
    conn.close()


def get_student_by_roll(roll_number):
    """Check if a roll number already exists."""
    conn = get_db()
    student = conn.execute(
        "SELECT * FROM student WHERE roll_number = ?", (roll_number,)
    ).fetchone()
    conn.close()
    return dict(student) if student else None


# --- Helper: Calculate Attendance Percentage ---
def _calc_attendance_pct(conn, student_id):
    """
    Formula: (student's present count / total working days) * 100
    Working days = distinct dates with at least 1 attendance record globally.
    """
    total_days = conn.execute(
        "SELECT COUNT(DISTINCT date) FROM attendance"
    ).fetchone()[0]
    if total_days == 0:
        return 0.0
    present_days = conn.execute(
        "SELECT COUNT(*) FROM attendance WHERE student_id = ?", (student_id,)
    ).fetchone()[0]
    return round((present_days / total_days) * 100, 1)
