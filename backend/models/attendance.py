# --- Attendance Model ---
# Query functions for attendance records, stats, and filtering.

from database import get_db
from datetime import date


def get_attendance_records(filter_date=None, student_id=None, section=None, branch=None,
                           date_from=None, date_to=None):
    """Get attendance records with optional filters. Joins student table for name/roll."""
    conn = get_db()
    query = """
        SELECT a.*, s.name, s.roll_number, s.branch, s.section
        FROM attendance a
        JOIN student s ON a.student_id = s.id
        WHERE 1=1
    """
    params = []

    if filter_date:
        query += " AND a.date = ?"
        params.append(filter_date)
    if student_id:
        query += " AND a.student_id = ?"
        params.append(student_id)
    if section:
        query += " AND s.section = ?"
        params.append(section)
    if branch:
        query += " AND s.branch = ?"
        params.append(branch)
    if date_from:
        query += " AND a.date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND a.date <= ?"
        params.append(date_to)

    query += " ORDER BY a.date DESC, a.time DESC"
    records = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in records]


def get_today_attendance():
    """Get all attendance records for today."""
    today = date.today().isoformat()
    return get_attendance_records(filter_date=today)


def get_attendance_stats():
    """Get summary statistics: total students, present today, overall attendance %."""
    conn = get_db()
    today = date.today().isoformat()

    total_students = conn.execute("SELECT COUNT(*) FROM student").fetchone()[0]
    present_today = conn.execute(
        "SELECT COUNT(*) FROM attendance WHERE date = ?", (today,)
    ).fetchone()[0]

    # --- Overall attendance percentage ---
    total_days = conn.execute("SELECT COUNT(DISTINCT date) FROM attendance").fetchone()[0]
    if total_days == 0 or total_students == 0:
        overall_pct = 0.0
    else:
        total_records = conn.execute("SELECT COUNT(*) FROM attendance").fetchone()[0]
        overall_pct = round((total_records / (total_students * total_days)) * 100, 1)

    conn.close()
    return {
        "total_students": total_students,
        "present_today": present_today,
        "overall_percentage": overall_pct,
        "date": today
    }


def get_student_attendance_history(student_id):
    """Get full attendance history for a specific student."""
    conn = get_db()
    records = conn.execute(
        """SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC, time DESC""",
        (student_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in records]
