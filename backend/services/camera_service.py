# --- Camera Service ---
# Manages camera capture, face recognition loop, annotation, and MJPEG streaming.
# Runs recognition in a daemon thread so it doesn't block Flask.

import cv2
import threading
import time
import traceback
import numpy as np
from datetime import datetime
from database import get_db
from config import (
    STREAM_FPS_LIMIT, FRAME_WIDTH, FRAME_HEIGHT,
    JPEG_QUALITY, MAX_CAMERA_SCAN
)
from services.face_service import detect_faces_in_frame, match_face, load_all_encodings
from services.attendance_service import mark_attendance


class CameraService:
    """Singleton-style camera service for live face recognition and MJPEG streaming."""

    def __init__(self):
        self._cap = None
        self._thread = None
        self._running = False
        self._camera_index = 0
        self._lock = threading.Lock()
        self._frame_lock = threading.Lock()
        self._current_frame = None          # Latest annotated JPEG frame
        self._marked_today = set()          # In-memory dedup: student IDs marked this session
        self._known_encodings = []          # Cached encodings from DB
        self._recent_events = []            # Last N recognition events for live log
        self._student_name_cache = {}       # Cache student names to avoid repeated DB calls
        self._error_count = 0               # Track consecutive errors

    # --- Public API ---

    def start(self, camera_index=0):
        """Start the camera and recognition loop."""
        if self._running:
            raise RuntimeError("Camera already running")

        self._cap = cv2.VideoCapture(camera_index)
        if not self._cap.isOpened():
            self._cap = None
            raise RuntimeError(f"Camera index {camera_index} not available")

        # --- Set resolution ---
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        # --- Set buffer size to 1 to reduce latency ---
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._camera_index = camera_index
        self._running = True
        self._marked_today = set()
        self._recent_events = []
        self._student_name_cache = {}
        self._error_count = 0

        # --- Load all known face encodings ---
        self._known_encodings = load_all_encodings()

        # --- Start daemon thread ---
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        print(f"[CAMERA] Started on index {camera_index}")

    def stop(self):
        """Stop the camera and release resources."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
            self._thread = None
        if self._cap:
            self._cap.release()
            self._cap = None
        with self._lock:
            self._marked_today.clear()
        self._current_frame = None
        self._student_name_cache = {}
        print("[CAMERA] Stopped")

    def is_running(self):
        return self._running

    def get_camera_index(self):
        return self._camera_index

    def get_recent_events(self):
        """Return the last 10 recognition events."""
        return list(self._recent_events[-10:])

    def reload_encodings(self):
        """Reload encodings from DB (call after registering a new student)."""
        self._known_encodings = load_all_encodings()
        self._student_name_cache = {}
        print("[CAMERA] Encodings reloaded")

    def generate_stream(self):
        """Generator that yields MJPEG frames for streaming."""
        while self._running:
            frame = None
            with self._frame_lock:
                frame = self._current_frame

            if frame is not None:
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
                )
            time.sleep(1.0 / STREAM_FPS_LIMIT)

    # --- Camera Detection (Phone-as-Webcam Support) ---

    @staticmethod
    def detect_cameras():
        """
        Scan for available camera devices.
        Returns list of dicts with camera index and name.
        Useful for detecting phone cameras connected via USB (e.g., DroidCam, Iriun).
        """
        cameras = []
        for i in range(MAX_CAMERA_SCAN):
            try:
                cap = cv2.VideoCapture(i)
                if cap.isOpened():
                    backend = cap.getBackendName() if hasattr(cap, 'getBackendName') else 'unknown'
                    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    cameras.append({
                        "index": i,
                        "name": f"Camera {i}" + (f" ({backend})" if backend != 'unknown' else ""),
                        "resolution": f"{w}x{h}"
                    })
                    cap.release()
            except Exception:
                pass
        return cameras

    # --- Private: Capture Loop ---

    def _capture_loop(self):
        """Main loop: capture frames, detect faces, annotate, and stream."""
        frame_interval = 1.0 / STREAM_FPS_LIMIT
        # --- Process recognition every N frames to keep stream smooth ---
        frame_count = 0
        recognition_interval = 3  # Run recognition every 3rd frame

        while self._running:
            loop_start = time.time()

            try:
                ret, frame = self._cap.read()
                if not ret:
                    self._error_count += 1
                    if self._error_count > 30:
                        print("[CAMERA] Too many read failures, stopping")
                        self._running = False
                        break
                    time.sleep(0.05)
                    continue

                self._error_count = 0
                frame_count += 1

                # --- Keep a clean copy for proof images ---
                raw_frame = frame.copy()
                annotated = frame.copy()

                # --- Run recognition only every Nth frame for performance ---
                if frame_count % recognition_interval == 0:
                    try:
                        faces = detect_faces_in_frame(frame)
                        for (top, right, bottom, left), encoding in faces:
                            self._process_face(
                                annotated, raw_frame,
                                top, right, bottom, left, encoding
                            )
                    except Exception as e:
                        # --- Don't let recognition errors kill the stream ---
                        print(f"[CAMERA] Recognition error (non-fatal): {e}")

                # --- Encode frame as JPEG ---
                _, jpeg = cv2.imencode(
                    '.jpg', annotated,
                    [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                )
                with self._frame_lock:
                    self._current_frame = jpeg.tobytes()

            except Exception as e:
                print(f"[CAMERA] Frame error: {e}")
                traceback.print_exc()
                time.sleep(0.1)
                continue

            # --- FPS limiting ---
            elapsed = time.time() - loop_start
            if elapsed < frame_interval:
                time.sleep(frame_interval - elapsed)

        print("[CAMERA] Capture loop ended")

    def _process_face(self, annotated, raw_frame, top, right, bottom, left, encoding):
        """Process a single detected face: match, mark attendance, annotate."""
        result = match_face(encoding, self._known_encodings)

        if result:
            student_id, confidence = result
            student_name = self._get_student_name(student_id)

            with self._lock:
                already_marked = student_id in self._marked_today

            if already_marked:
                # --- Blue box: already marked ---
                color = (255, 165, 0)
                label = f"{student_name} - Already Marked"
            else:
                # --- Green box: new attendance ---
                color = (0, 200, 0)
                label = f"{student_name} ({confidence:.0%})"
                # --- Mark attendance ---
                try:
                    success = mark_attendance(
                        student_id, raw_frame,
                        self._camera_index, confidence
                    )
                    if success:
                        with self._lock:
                            self._marked_today.add(student_id)
                        self._add_event(student_name, confidence)
                        print(f"[CAMERA] Attendance marked: {student_name}")
                except Exception as e:
                    print(f"[CAMERA] Attendance save error: {e}")
        else:
            # --- Red box: unknown ---
            color = (0, 0, 255)
            label = "Unknown"

        # --- Draw bounding box and label ---
        cv2.rectangle(annotated, (left, top), (right, bottom), color, 2)
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)[0]
        cv2.rectangle(
            annotated,
            (left, top - label_size[1] - 10),
            (left + label_size[0] + 6, top),
            color, -1
        )
        cv2.putText(
            annotated, label,
            (left + 3, top - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1
        )

    def _get_student_name(self, student_id):
        """Fetch student name from DB with caching."""
        if student_id in self._student_name_cache:
            return self._student_name_cache[student_id]
        conn = get_db()
        row = conn.execute("SELECT name FROM student WHERE id = ?", (student_id,)).fetchone()
        conn.close()
        name = row['name'] if row else f"Student #{student_id}"
        self._student_name_cache[student_id] = name
        return name

    def _add_event(self, name, confidence):
        """Add a recognition event to the recent events list."""
        event = {
            "name": name,
            "confidence": round(confidence * 100, 1),
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        self._recent_events.append(event)
        if len(self._recent_events) > 20:
            self._recent_events = self._recent_events[-20:]


# --- Singleton Instance ---
camera_service = CameraService()
