# --- Attendance Routes ---
# GET endpoints for attendance records, today's list, stats, and analytics.

from flask import Blueprint, request, jsonify
from models.attendance import (
    get_attendance_records, get_today_attendance,
    get_attendance_stats, get_analytics_data
)
from routes.auth import auth_required

attendance_bp = Blueprint('attendance', __name__)


# --- GET /api/attendance ---
@attendance_bp.route('/api/attendance', methods=['GET'])
@auth_required
def list_attendance():
    records = get_attendance_records(
        filter_date=request.args.get('date'),
        student_id=request.args.get('student_id'),
        section=request.args.get('section'),
        branch=request.args.get('branch'),
        date_from=request.args.get('date_from'),
        date_to=request.args.get('date_to')
    )
    return jsonify(records), 200


# --- GET /api/attendance/today ---
@attendance_bp.route('/api/attendance/today', methods=['GET'])
@auth_required
def today_attendance():
    records = get_today_attendance()
    return jsonify(records), 200


# --- GET /api/attendance/stats ---
@attendance_bp.route('/api/attendance/stats', methods=['GET'])
@auth_required
def attendance_stats():
    stats = get_attendance_stats()
    return jsonify(stats), 200


# --- GET /api/attendance/analytics ---
@attendance_bp.route('/api/attendance/analytics', methods=['GET'])
@auth_required
def attendance_analytics():
    data = get_analytics_data(
        date_from=request.args.get('date_from'),
        date_to=request.args.get('date_to'),
        section=request.args.get('section'),
        branch=request.args.get('branch')
    )
    return jsonify(data), 200
