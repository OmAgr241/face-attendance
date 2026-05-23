# --- Attendance Model ---
# Query functions for attendance records, stats, filtering, and analytics.

from database import get_db
from datetime import date, timedelta


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
    """Get summary statistics: total students, present today, today's %, overall %."""
    conn = get_db()
    today = date.today().isoformat()

    total_students = conn.execute("SELECT COUNT(*) FROM student").fetchone()[0]
    present_today = conn.execute(
        "SELECT COUNT(*) FROM attendance WHERE date = ? AND status = 'Present'", (today,)
    ).fetchone()[0]

    # --- Today's attendance percentage ---
    if total_students == 0:
        today_pct = 0.0
    else:
        today_pct = round((present_today / total_students) * 100, 1)

    # --- Overall attendance percentage (across all recorded days) ---
    total_days = conn.execute("SELECT COUNT(DISTINCT date) FROM attendance").fetchone()[0]
    if total_days == 0 or total_students == 0:
        overall_pct = 0.0
    else:
        total_records = conn.execute("SELECT COUNT(*) FROM attendance WHERE status = 'Present'").fetchone()[0]
        overall_pct = round((total_records / (total_students * total_days)) * 100, 1)

    conn.close()
    return {
        "total_students": total_students,
        "present_today": present_today,
        "today_percentage": today_pct,
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


def get_analytics_data(date_from=None, date_to=None, section=None, branch=None):
    """
    Get comprehensive analytics data for charting.
    Returns daily trends, per-student rates, section breakdown, and summary stats.
    """
    conn = get_db()

    # Default date range: last 30 days
    if not date_to:
        date_to = date.today().isoformat()
    if not date_from:
        date_from = (date.today() - timedelta(days=30)).isoformat()

    total_students = conn.execute("SELECT COUNT(*) FROM student").fetchone()[0]

    # --- Build student filter ---
    student_filter = ""
    student_params = []
    if section:
        student_filter += " AND s.section = ?"
        student_params.append(section)
    if branch:
        student_filter += " AND s.branch = ?"
        student_params.append(branch)

    # --- 1. Daily attendance trend ---
    daily_query = """
        SELECT a.date, COUNT(DISTINCT a.student_id) as present_count
        FROM attendance a
        JOIN student s ON a.student_id = s.id
        WHERE a.date >= ? AND a.date <= ? AND a.status = 'Present'
    """ + student_filter + """
        GROUP BY a.date
        ORDER BY a.date ASC
    """
    daily_rows = conn.execute(daily_query, [date_from, date_to] + student_params).fetchall()

    # Get filtered student count for percentage calculation
    if section or branch:
        filtered_count_query = "SELECT COUNT(*) FROM student s WHERE 1=1" + student_filter
        filtered_total = conn.execute(filtered_count_query, student_params).fetchone()[0]
    else:
        filtered_total = total_students

    daily_trend = []
    for row in daily_rows:
        pct = round((row['present_count'] / filtered_total) * 100, 1) if filtered_total > 0 else 0
        daily_trend.append({
            "date": row['date'],
            "present": row['present_count'],
            "total": filtered_total,
            "percentage": pct
        })

    # --- 2. Per-student attendance rates ---
    student_query = """
        SELECT s.id, s.name, s.roll_number, s.section, s.branch,
               COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as days_present
        FROM student s
        LEFT JOIN attendance a ON s.id = a.student_id
            AND a.date >= ? AND a.date <= ?
        WHERE 1=1
    """ + student_filter.replace("s.", "s.") + """
        GROUP BY s.id
        ORDER BY days_present DESC
    """
    student_rows = conn.execute(student_query, [date_from, date_to] + student_params).fetchall()

    total_days_in_range = conn.execute(
        "SELECT COUNT(DISTINCT date) FROM attendance WHERE date >= ? AND date <= ?",
        (date_from, date_to)
    ).fetchone()[0]

    student_rates = []
    for row in student_rows:
        rate = round((row['days_present'] / total_days_in_range) * 100, 1) if total_days_in_range > 0 else 0
        student_rates.append({
            "id": row['id'],
            "name": row['name'],
            "roll_number": row['roll_number'],
            "section": row['section'] or "N/A",
            "branch": row['branch'] or "N/A",
            "days_present": row['days_present'],
            "total_days": total_days_in_range,
            "rate": min(rate, 100)
        })

    # --- 3. Section-wise breakdown ---
    section_query = """
        SELECT COALESCE(s.section, 'Unassigned') as section_name,
               COUNT(DISTINCT s.id) as student_count,
               COUNT(DISTINCT a.id) as total_records
        FROM student s
        LEFT JOIN attendance a ON s.id = a.student_id
            AND a.date >= ? AND a.date <= ?
        GROUP BY s.section
        ORDER BY student_count DESC
    """
    section_rows = conn.execute(section_query, (date_from, date_to)).fetchall()
    section_breakdown = [
        {
            "section": row['section_name'],
            "students": row['student_count'],
            "records": row['total_records']
        }
        for row in section_rows
    ]

    # --- 4. Branch-wise breakdown ---
    branch_query = """
        SELECT COALESCE(s.branch, 'Unassigned') as branch_name,
               COUNT(DISTINCT s.id) as student_count,
               COUNT(DISTINCT a.id) as total_records
        FROM student s
        LEFT JOIN attendance a ON s.id = a.student_id
            AND a.date >= ? AND a.date <= ?
        GROUP BY s.branch
        ORDER BY student_count DESC
    """
    branch_rows = conn.execute(branch_query, (date_from, date_to)).fetchall()
    branch_breakdown = [
        {
            "branch": row['branch_name'],
            "students": row['student_count'],
            "records": row['total_records']
        }
        for row in branch_rows
    ]

    # --- 5. Summary stats ---
    if daily_trend:
        avg_pct = round(sum(d['percentage'] for d in daily_trend) / len(daily_trend), 1)
        best_day = max(daily_trend, key=lambda d: d['percentage'])
        worst_day = min(daily_trend, key=lambda d: d['percentage'])
    else:
        avg_pct = 0
        best_day = {"date": "N/A", "percentage": 0}
        worst_day = {"date": "N/A", "percentage": 0}

    conn.close()
    return {
        "date_range": {"from": date_from, "to": date_to},
        "total_students": filtered_total,
        "total_days": total_days_in_range,
        "daily_trend": daily_trend,
        "student_rates": student_rates,
        "section_breakdown": section_breakdown,
        "branch_breakdown": branch_breakdown,
        "summary": {
            "average_percentage": avg_pct,
            "best_day": {"date": best_day['date'], "percentage": best_day['percentage']},
            "worst_day": {"date": worst_day['date'], "percentage": worst_day['percentage']},
        }
    }


def update_attendance_status(attendance_id, new_status):
    """Update the status of an attendance record (Present <-> Absent)."""
    conn = get_db()
    cursor = conn.execute(
        "UPDATE attendance SET status = ? WHERE id = ?",
        (new_status, attendance_id)
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def get_attendance_for_export(filter_date=None, date_from=None, date_to=None,
                               section=None, branch=None):
    """
    Get daily attendance data for Excel export.
    Returns ALL registered students; those without attendance records appear as 'Absent'.
    """
    conn = get_db()

    # --- Get all students (optionally filtered) ---
    student_query = "SELECT id, name, roll_number, branch, section FROM student WHERE 1=1"
    student_params = []
    if section:
        student_query += " AND section = ?"
        student_params.append(section)
    if branch:
        student_query += " AND branch = ?"
        student_params.append(branch)
    student_query += " ORDER BY name"
    students = conn.execute(student_query, student_params).fetchall()

    # --- Determine dates to export ---
    if filter_date:
        dates = [filter_date]
    elif date_from and date_to:
        # Get all distinct attendance dates in range
        date_rows = conn.execute(
            "SELECT DISTINCT date FROM attendance WHERE date >= ? AND date <= ? ORDER BY date",
            (date_from, date_to)
        ).fetchall()
        dates = [r['date'] for r in date_rows]
        if not dates:
            dates = [date_from]
    else:
        dates = [date.today().isoformat()]

    # --- Build export data per date ---
    export_data = []
    for d in dates:
        for s in students:
            record = conn.execute(
                "SELECT status, time, confidence FROM attendance WHERE student_id = ? AND date = ?",
                (s['id'], d)
            ).fetchone()
            export_data.append({
                "date": d,
                "name": s['name'],
                "roll_number": s['roll_number'],
                "branch": s['branch'] or "N/A",
                "section": s['section'] or "N/A",
                "status": record['status'] if record else "Absent",
                "time": record['time'] if record else "-",
            })

    conn.close()
    return export_data


def get_student_attendance_summary(date_from=None, date_to=None,
                                    section=None, branch=None,
                                    min_percentage=None):
    """
    Get per-student attendance summary for a period.
    If min_percentage is set, only return students whose attendance % is BELOW that value.
    """
    conn = get_db()

    if not date_to:
        date_to = date.today().isoformat()
    if not date_from:
        date_from = (date.today() - timedelta(days=30)).isoformat()

    # --- Total working days in range ---
    total_days = conn.execute(
        "SELECT COUNT(DISTINCT date) FROM attendance WHERE date >= ? AND date <= ?",
        (date_from, date_to)
    ).fetchone()[0]

    # --- Student filter ---
    student_filter = ""
    student_params = []
    if section:
        student_filter += " AND s.section = ?"
        student_params.append(section)
    if branch:
        student_filter += " AND s.branch = ?"
        student_params.append(branch)

    query = """
        SELECT s.id, s.name, s.roll_number, s.branch, s.section,
               COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as days_present
        FROM student s
        LEFT JOIN attendance a ON s.id = a.student_id
            AND a.date >= ? AND a.date <= ?
        WHERE 1=1
    """ + student_filter + """
        GROUP BY s.id
        ORDER BY s.name
    """
    rows = conn.execute(query, [date_from, date_to] + student_params).fetchall()

    results = []
    for row in rows:
        if total_days > 0:
            pct = round((row['days_present'] / total_days) * 100, 1)
        else:
            pct = 0.0
        pct = min(pct, 100.0)

        # --- Filter by min percentage (include students BELOW threshold) ---
        if min_percentage is not None and pct >= min_percentage:
            continue

        results.append({
            "name": row['name'],
            "roll_number": row['roll_number'],
            "branch": row['branch'] or "N/A",
            "section": row['section'] or "N/A",
            "days_present": row['days_present'],
            "total_days": total_days,
            "percentage": pct,
        })

    conn.close()
    return results
