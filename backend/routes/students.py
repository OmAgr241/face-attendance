# --- Student Routes ---
# CRUD for students + face image upload with encoding generation.

import os
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from models.student import (
    create_student, get_all_students, get_student_by_id,
    delete_student, get_student_by_roll
)
from models.attendance import get_student_attendance_history
from services.face_service import generate_encoding, serialize_encoding
from services.camera_service import camera_service
from routes.auth import auth_required
from database import get_db
from config import (
    STUDENT_IMAGE_DIR, ALLOWED_IMAGE_EXTENSIONS,
    MAX_IMAGE_SIZE_MB, MAX_FACES_PER_STUDENT
)

students_bp = Blueprint('students', __name__)


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


# --- GET /api/students ---
@students_bp.route('/api/students', methods=['GET'])
@auth_required
def list_students():
    students = get_all_students()
    return jsonify(students), 200


# --- POST /api/students ---
@students_bp.route('/api/students', methods=['POST'])
@auth_required
def create_new_student():
    # --- Support both JSON and form data ---
    if request.content_type and 'multipart/form-data' in request.content_type:
        data = request.form.to_dict()
    else:
        data = request.get_json() or {}

    name = data.get('name')
    roll_number = data.get('roll_number')
    if not name or not roll_number:
        return jsonify({"error": "Name and roll number are required"}), 400

    # --- Check for duplicate roll number ---
    if get_student_by_roll(roll_number):
        return jsonify({"error": "Roll number already registered"}), 409

    try:
        student_id = create_student(
            name=name,
            roll_number=roll_number,
            branch=data.get('branch'),
            semester=data.get('semester'),
            section=data.get('section'),
            email=data.get('email'),
            phone=data.get('phone')
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # --- Handle face images if included in the same request ---
    files = request.files.getlist('face_images')
    face_results = []
    if files:
        face_results = _process_face_uploads(student_id, files)

    student = get_student_by_id(student_id)
    return jsonify({
        "student": student,
        "face_results": face_results
    }), 201


# --- GET /api/students/:id ---
@students_bp.route('/api/students/<int:student_id>', methods=['GET'])
@auth_required
def get_student(student_id):
    student = get_student_by_id(student_id)
    if student is None:
        return jsonify({"error": "Student not found"}), 404
    # --- Include attendance history ---
    student['attendance_history'] = get_student_attendance_history(student_id)
    return jsonify(student), 200


# --- DELETE /api/students/:id ---
@students_bp.route('/api/students/<int:student_id>', methods=['DELETE'])
@auth_required
def remove_student(student_id):
    student = get_student_by_id(student_id)
    if student is None:
        return jsonify({"error": "Student not found"}), 404

    # --- Delete face image files ---
    student_img_dir = os.path.join(STUDENT_IMAGE_DIR, str(student_id))
    if os.path.exists(student_img_dir):
        import shutil
        shutil.rmtree(student_img_dir)

    delete_student(student_id)
    # --- Reload camera encodings if running ---
    if camera_service.is_running():
        camera_service.reload_encodings()
    return jsonify({"message": "Student deleted successfully"}), 200


# --- POST /api/students/:id/faces ---
@students_bp.route('/api/students/<int:student_id>/faces', methods=['POST'])
@auth_required
def upload_faces(student_id):
    student = get_student_by_id(student_id)
    if student is None:
        return jsonify({"error": "Student not found"}), 404

    files = request.files.getlist('face_images')
    if not files:
        return jsonify({"error": "No face images provided"}), 400

    # --- Check max faces limit ---
    current_count = student.get('face_count', 0)
    if current_count + len(files) > MAX_FACES_PER_STUDENT:
        return jsonify({
            "error": f"Maximum {MAX_FACES_PER_STUDENT} face images allowed. Current: {current_count}"
        }), 400

    results = _process_face_uploads(student_id, files)
    errors = [r for r in results if r.get('error')]
    if errors and len(errors) == len(files):
        return jsonify({"error": errors[0]['error'], "details": errors}), 400

    # --- Reload camera encodings if running ---
    if camera_service.is_running():
        camera_service.reload_encodings()

    return jsonify({"results": results}), 200


# --- Helper: Process face image uploads ---
def _process_face_uploads(student_id, files):
    """Save face images, generate encodings, store in DB."""
    results = []
    student_dir = os.path.join(STUDENT_IMAGE_DIR, str(student_id))
    os.makedirs(student_dir, exist_ok=True)

    for file in files:
        filename = secure_filename(file.filename)
        if not filename or not _allowed_file(filename):
            results.append({"filename": filename or "unknown", "error": "Invalid file type"})
            continue

        # --- Check file size ---
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            results.append({"filename": filename, "error": f"File exceeds {MAX_IMAGE_SIZE_MB}MB limit"})
            continue

        # --- Avoid filename conflicts ---
        import time as _time
        base, ext = os.path.splitext(filename)
        unique_filename = f"{base}_{int(_time.time() * 1000)}{ext}"
        filepath = os.path.join(student_dir, unique_filename)
        file.save(filepath)

        try:
            encoding = generate_encoding(filepath)
            encoding_blob = serialize_encoding(encoding)
            rel_path = os.path.join("storage", "student_images", str(student_id), unique_filename).replace("\\", "/")

            conn = get_db()
            from datetime import datetime
            conn.execute(
                """INSERT INTO student_face (student_id, face_image_path, face_encoding, created_at)
                   VALUES (?, ?, ?, ?)""",
                (student_id, rel_path, encoding_blob, datetime.now().isoformat())
            )
            conn.commit()
            conn.close()
            results.append({"filename": filename, "success": True})
            print(f"[FACES] Encoded and saved: {filename} for student {student_id}")
        except ValueError as e:
            # --- No face detected in image ---
            if os.path.exists(filepath):
                os.remove(filepath)
            results.append({"filename": filename, "error": str(e)})
            print(f"[FACES] No face: {filename} - {e}")
        except Exception as e:
            # --- Other errors (encoding crash, DB error, etc.) ---
            # Keep the file for potential retry, but report the error
            if os.path.exists(filepath):
                os.remove(filepath)
            import traceback
            traceback.print_exc()
            results.append({"filename": filename, "error": f"Processing error: {str(e)}"})
            print(f"[FACES] Error: {filename} - {e}")

    return results


# --- POST /api/students/:id/reencode ---
@students_bp.route('/api/students/<int:student_id>/reencode', methods=['POST'])
@auth_required
def reencode_faces(student_id):
    """
    Re-encode all face images for a student.
    Useful after fixing encoding bugs — rescans saved images and
    generates new encodings.
    """
    student = get_student_by_id(student_id)
    if student is None:
        return jsonify({"error": "Student not found"}), 404

    student_dir = os.path.join(STUDENT_IMAGE_DIR, str(student_id))
    if not os.path.exists(student_dir):
        return jsonify({"error": "No image directory found"}), 404

    # --- Delete old encodings ---
    conn = get_db()
    conn.execute("DELETE FROM student_face WHERE student_id = ?", (student_id,))
    conn.commit()
    conn.close()

    # --- Re-encode all images ---
    results = []
    for filename in os.listdir(student_dir):
        filepath = os.path.join(student_dir, filename)
        if not os.path.isfile(filepath):
            continue
        try:
            encoding = generate_encoding(filepath)
            encoding_blob = serialize_encoding(encoding)
            rel_path = os.path.join("storage", "student_images", str(student_id), filename).replace("\\", "/")
            conn = get_db()
            from datetime import datetime
            conn.execute(
                """INSERT INTO student_face (student_id, face_image_path, face_encoding, created_at)
                   VALUES (?, ?, ?, ?)""",
                (student_id, rel_path, encoding_blob, datetime.now().isoformat())
            )
            conn.commit()
            conn.close()
            results.append({"filename": filename, "success": True})
        except ValueError as e:
            results.append({"filename": filename, "error": str(e)})
        except Exception as e:
            results.append({"filename": filename, "error": str(e)})

    # --- Reload camera encodings if running ---
    if camera_service.is_running():
        camera_service.reload_encodings()

    return jsonify({
        "message": f"Re-encoded {len([r for r in results if r.get('success')])} faces",
        "results": results
    }), 200

