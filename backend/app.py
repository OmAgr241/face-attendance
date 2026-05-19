# --- Flask Application Entry Point ---
# Registers all blueprints, enables CORS, serves storage files, and initializes DB.

import os
import sys
import numpy as np

# ============================================================
# MONKEY-PATCH: Fix face_recognition + dlib 20 + numpy 2.x
# face_recognition 1.3.0 passes numpy arrays to dlib's
# compute_face_descriptor() in a way that breaks with
# dlib 20 and numpy 2.x. This patch wraps the function to
# ensure arrays are contiguous uint8 copies.
# ============================================================
try:
    import face_recognition.api as _fr_api
    _original_face_encodings = _fr_api.face_encodings

    def _patched_face_encodings(face_image, known_face_locations=None, num_jitters=1, model="small"):
        # Ensure the image is a contiguous uint8 array
        face_image = np.ascontiguousarray(face_image, dtype=np.uint8)
        raw_landmarks = _fr_api._raw_face_landmarks(face_image, known_face_locations, model)
        return [
            np.array(
                _fr_api.face_encoder.compute_face_descriptor(
                    face_image, raw_landmark_set, num_jitters=num_jitters
                )
            )
            for raw_landmark_set in raw_landmarks
        ]

    _fr_api.face_encodings = _patched_face_encodings
    # Also patch the module-level import
    import face_recognition
    face_recognition.face_encodings = _patched_face_encodings
    print("[PATCH] face_recognition.face_encodings patched for dlib 20 / numpy 2.x compatibility")
except Exception as e:
    print(f"[PATCH] Warning: Could not patch face_recognition: {e}")

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from database import init_db
from config import BASE_DIR, STORAGE_DIR
from routes.auth import auth_bp
from routes.students import students_bp
from routes.attendance import attendance_bp
from routes.camera import camera_bp


def create_app():
    """Application factory."""
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload

    # --- Enable CORS for development ---
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- Register Blueprints ---
    app.register_blueprint(auth_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(camera_bp)

    # --- Serve storage files (student images, proof images) ---
    @app.route('/storage/<path:filepath>')
    def serve_storage(filepath):
        return send_from_directory(STORAGE_DIR, filepath)

    # --- Health check ---
    @app.route('/api/health')
    def health():
        return jsonify({"status": "ok"}), 200

    # --- Global error handler ---
    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    return app


# --- Entry Point ---
if __name__ == '__main__':
    # --- Ensure storage directories exist ---
    os.makedirs(os.path.join(STORAGE_DIR, "student_images"), exist_ok=True)
    os.makedirs(os.path.join(STORAGE_DIR, "proof_images"), exist_ok=True)

    # --- Initialize database ---
    init_db()

    # --- Create and run app ---
    app = create_app()
    print("\n" + "=" * 50)
    print("  Face Recognition Attendance System")
    print("  Server running on http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
