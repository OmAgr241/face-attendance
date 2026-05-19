# --- Attendance Service ---
# Handles marking attendance with deduplication and proof image saving.

import os
import cv2
from datetime import datetime, date
from database import get_db
from config import PROOF_IMAGE_DIR, JPEG_QUALITY


def mark_attendance(student_id, frame, camera_source, confidence):
    """
    Mark attendance for a student. Saves proof image and inserts DB record.
    Returns: True if attendance was newly recorded, False if already marked.
    """
    today = date.today().isoformat()
    now = datetime.now().strftime("%H:%M:%S")
    conn = get_db()

    # --- DB-level dedup check ---
    existing = conn.execute(
        "SELECT id FROM attendance WHERE student_id = ? AND date = ?",
        (student_id, today)
    ).fetchone()

    if existing:
        conn.close()
        return False

    # --- Save proof image ---
    proof_path = _save_proof_image(student_id, frame)

    # --- Insert attendance record ---
    try:
        conn.execute(
            """INSERT INTO attendance (student_id, date, time, status, proof_image_path, camera_source, confidence)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (student_id, today, now, "Present", proof_path, camera_source, confidence)
        )
        conn.commit()
    except Exception:
        # --- Unique constraint violation (race condition safety) ---
        conn.rollback()
        conn.close()
        return False
    finally:
        conn.close()

    return True


def _save_proof_image(student_id, frame):
    """
    Save the raw frame as a proof image.
    Returns: relative path (relative to backend/) for DB storage.
    """
    today = date.today().isoformat()
    timestamp = datetime.now().strftime("%H%M%S")

    # --- Create date directory ---
    date_dir = os.path.join(PROOF_IMAGE_DIR, today)
    os.makedirs(date_dir, exist_ok=True)

    # --- Save image ---
    filename = f"{student_id}_{timestamp}.jpg"
    full_path = os.path.join(date_dir, filename)
    cv2.imwrite(full_path, frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])

    # --- Return relative path ---
    rel_path = os.path.join("storage", "proof_images", today, filename)
    return rel_path.replace("\\", "/")
