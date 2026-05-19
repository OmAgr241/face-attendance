# --- Face Recognition Service ---
# Handles encoding generation from images and face matching against stored encodings.
# Compatible with dlib 20+ and numpy 2.x

import face_recognition
import numpy as np
import pickle
import os
from database import get_db
from config import RECOGNITION_THRESHOLD


def _ensure_uint8_contiguous(image):
    """
    Ensure image array is uint8 and C-contiguous.
    Required for dlib 20+ compatibility with numpy 2.x.
    """
    if image.dtype != np.uint8:
        image = image.astype(np.uint8)
    if not image.flags['C_CONTIGUOUS']:
        image = np.ascontiguousarray(image)
    return image


def generate_encoding(image_path):
    """
    Generate a face encoding from an image file.
    Returns: numpy array (128-d face encoding)
    Raises: ValueError if no face is detected in the image.
    """
    image = face_recognition.load_image_file(image_path)
    image = _ensure_uint8_contiguous(image)
    encodings = face_recognition.face_encodings(image)
    if len(encodings) == 0:
        raise ValueError(f"No face detected in image: {os.path.basename(image_path)}")
    # --- Use the first face found ---
    return encodings[0]


def serialize_encoding(encoding):
    """Serialize a numpy encoding to bytes for DB storage."""
    return pickle.dumps(encoding)


def deserialize_encoding(blob):
    """Deserialize bytes from DB back to numpy encoding."""
    return pickle.loads(blob)


def load_all_encodings():
    """
    Load all stored face encodings from the database.
    Returns: list of tuples (student_id, numpy_encoding)
    """
    conn = get_db()
    rows = conn.execute("SELECT student_id, face_encoding FROM student_face").fetchall()
    conn.close()
    encodings = []
    for row in rows:
        enc = deserialize_encoding(row['face_encoding'])
        encodings.append((row['student_id'], enc))
    return encodings


def match_face(unknown_encoding, known_encodings):
    """
    Match an unknown face encoding against a list of known encodings.
    Args:
        unknown_encoding: numpy array (128-d)
        known_encodings: list of (student_id, numpy_encoding) tuples
    Returns:
        (student_id, confidence) if match found, else None
        confidence = 1 - face_distance
    """
    if not known_encodings:
        return None

    student_ids = [k[0] for k in known_encodings]
    encodings = [k[1] for k in known_encodings]

    # --- Calculate distances ---
    distances = face_recognition.face_distance(encodings, unknown_encoding)
    min_idx = np.argmin(distances)
    min_distance = distances[min_idx]

    if min_distance < RECOGNITION_THRESHOLD:
        confidence = round(1.0 - min_distance, 4)
        return (student_ids[min_idx], confidence)
    return None


def detect_faces_in_frame(frame):
    """
    Detect face locations and encodings in a video frame.
    Args:
        frame: BGR numpy array from OpenCV
    Returns:
        list of (location, encoding) tuples
        location = (top, right, bottom, left)
    """
    # --- Convert BGR to RGB for face_recognition ---
    rgb_frame = frame[:, :, ::-1].copy()
    # --- Ensure uint8 contiguous for dlib compatibility ---
    rgb_frame = _ensure_uint8_contiguous(rgb_frame)
    # --- Use 'hog' model for speed (use 'cnn' for accuracy if GPU available) ---
    face_locations = face_recognition.face_locations(rgb_frame, model='hog')
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
    return list(zip(face_locations, face_encodings))
