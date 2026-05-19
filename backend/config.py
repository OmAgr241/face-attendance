# --- Configuration Constants ---
# Face Recognition Attendance System
# All configurable parameters are centralized here.

import os

# --- Base Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Database ---
DB_PATH = os.path.join(BASE_DIR, "attendance.db")

# --- Face Recognition ---
RECOGNITION_THRESHOLD = 0.5        # Lower = stricter matching
MAX_FACES_PER_STUDENT = 10         # Maximum face images per student

# --- Storage Paths ---
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
STUDENT_IMAGE_DIR = os.path.join(STORAGE_DIR, "student_images")
PROOF_IMAGE_DIR = os.path.join(STORAGE_DIR, "proof_images")

# --- Camera ---
CAMERA_INDEX_DEFAULT = 0           # Default camera (0 = laptop built-in)
MAX_CAMERA_SCAN = 5                # Scan camera indices 0..4 for detection
JPEG_QUALITY = 85                  # Quality for proof image saves
STREAM_FPS_LIMIT = 15              # Max frames per second to stream
FRAME_WIDTH = 640                  # Stream frame width
FRAME_HEIGHT = 480                 # Stream frame height

# --- Auth ---
SECRET_KEY = os.environ.get("SECRET_KEY", "face-attendance-secret-key-dev")
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"

# --- Upload Limits ---
MAX_IMAGE_SIZE_MB = 5
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
