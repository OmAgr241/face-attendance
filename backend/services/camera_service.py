# --- Camera Service ---
# Manages camera capture, face recognition, annotation, and MJPEG streaming.
# Uses a two-thread architecture:
#   1. Capture thread  — fast loop: reads frames, draws cached boxes, encodes JPEG
#   2. Recognition thread — slow loop: runs face detection/matching asynchronously
# This prevents the heavy recognition work from freezing the live stream.

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


# --- Cooldown for unknown face events (seconds) ---
UNKNOWN_COOLDOWN_SECONDS = 5


class CameraService:
    """Singleton-style camera service for live face recognition and MJPEG streaming."""

    def __init__(self):
        self._cap = None
        self._capture_thread = None
        self._recog_thread = None
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
        self._last_unknown_time = 0         # Cooldown tracker for unknown face events

        # --- Two-thread architecture state ---
        self._latest_raw_frame = None       # Latest raw frame for recognition thread to pick up
        self._raw_frame_lock = threading.Lock()
        self._cached_face_results = []      # Cached: list of (top, right, bottom, left, label, color)
        self._cached_faces_lock = threading.Lock()

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
        self._last_unknown_time = 0
        self._cached_face_results = []
        self._latest_raw_frame = None

        # --- Load all known face encodings ---
        self._known_encodings = load_all_encodings()

        # --- Start capture thread (fast — just reads frames and draws cached boxes) ---
        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._capture_thread.start()

        # --- Start recognition thread (slow — runs face detection/matching) ---
        self._recog_thread = threading.Thread(target=self._recognition_loop, daemon=True)
        self._recog_thread.start()

        print(f"[CAMERA] Started on index {camera_index} (2-thread mode)")

    def stop(self):
        """Stop the camera and release resources."""
        self._running = False
        if self._capture_thread:
            self._capture_thread.join(timeout=3)
            self._capture_thread = None
        if self._recog_thread:
            self._recog_thread.join(timeout=5)
            self._recog_thread = None
        if self._cap:
            self._cap.release()
            self._cap = None
        with self._lock:
            self._marked_today.clear()
        self._current_frame = None
        self._cached_face_results = []
        self._latest_raw_frame = None
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

    # =============================================
    # Thread 1: CAPTURE LOOP (fast, ~15 FPS)
    # Reads frames, draws cached bounding boxes,
    # encodes JPEG for streaming. Never blocks.
    # =============================================

    def _capture_loop(self):
        """Fast loop: read frames, draw cached boxes, encode JPEG."""
        frame_interval = 1.0 / STREAM_FPS_LIMIT

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

                # --- Provide latest frame to recognition thread ---
                with self._raw_frame_lock:
                    self._latest_raw_frame = frame.copy()

                # --- Draw cached face results on EVERY frame ---
                annotated = frame.copy()
                with self._cached_faces_lock:
                    cached = list(self._cached_face_results)

                for (top, right, bottom, left, label, color) in cached:
                    # --- Draw bounding box ---
                    cv2.rectangle(annotated, (left, top), (right, bottom), color, 2)
                    # --- Draw label background ---
                    label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)[0]
                    cv2.rectangle(
                        annotated,
                        (left, top - label_size[1] - 10),
                        (left + label_size[0] + 6, top),
                        color, -1
                    )
                    # --- Draw label text ---
                    cv2.putText(
                        annotated, label,
                        (left + 3, top - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1
                    )

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

    # =============================================
    # Thread 2: RECOGNITION LOOP (slow, ~2-5 FPS)
    # Grabs the latest frame, runs face detection
    # and matching, then updates cached results.
    # Runs independently so the stream stays smooth.
    # =============================================

    def _recognition_loop(self):
        """Slow loop: detect faces, match, mark attendance, update cached results."""
        print("[CAMERA] Recognition thread started")

        while self._running:
            try:
                # --- Grab latest frame ---
                with self._raw_frame_lock:
                    frame = self._latest_raw_frame
                    self._latest_raw_frame = None  # consume it

                if frame is None:
                    time.sleep(0.05)
                    continue

                raw_frame = frame.copy()

                # --- Run face detection + encoding (the slow part) ---
                faces = detect_faces_in_frame(frame)

                # --- Build new face results ---
                new_results = []
                for (top, right, bottom, left), encoding in faces:
                    label, color = self._process_face(raw_frame, top, right, bottom, left, encoding)
                    new_results.append((top, right, bottom, left, label, color))

                # --- Atomically update cached results ---
                with self._cached_faces_lock:
                    self._cached_face_results = new_results

            except Exception as e:
                print(f"[CAMERA] Recognition error (non-fatal): {e}")
                traceback.print_exc()
                time.sleep(0.2)
                continue

            # --- Small sleep to avoid spinning too fast ---
            time.sleep(0.1)

        print("[CAMERA] Recognition loop ended")

    def _process_face(self, raw_frame, top, right, bottom, left, encoding):
        """Process a single detected face: match, mark attendance. Returns (label, color)."""
        result = match_face(encoding, self._known_encodings)

        if result:
            student_id, confidence = result
            student_name = self._get_student_name(student_id)

            with self._lock:
                already_marked = student_id in self._marked_today

            if already_marked:
                # --- Orange box: already marked ---
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
            # --- Report unknown face event with cooldown ---
            now = time.time()
            if now - self._last_unknown_time > UNKNOWN_COOLDOWN_SECONDS:
                self._last_unknown_time = now
                self._add_event("Unknown Person", 0, event_type="unknown")

        return label, color

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

    def _add_event(self, name, confidence, event_type="recognized"):
        """Add a recognition event to the recent events list."""
        event = {
            "name": name,
            "confidence": round(confidence * 100, 1),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "type": event_type
        }
        self._recent_events.append(event)
        if len(self._recent_events) > 20:
            self._recent_events = self._recent_events[-20:]


# --- Singleton Instance ---
camera_service = CameraService()
