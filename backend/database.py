# --- Database Initialization & Connection ---
# Creates all tables and seeds the default admin on first run.

import sqlite3
import os
from datetime import datetime
import bcrypt
from config import DB_PATH, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD


# --- Connection Helper ---
def get_db():
    """Get a new database connection with Row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# --- Table Creation ---
def init_db():
    """Initialize the database: create tables and seed default admin."""
    conn = get_db()
    cursor = conn.cursor()

    # --- Admin Table ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # --- Student Table ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT UNIQUE NOT NULL,
            branch TEXT,
            semester TEXT,
            section TEXT,
            email TEXT,
            phone TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # --- Student Face Table ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_face (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            face_image_path TEXT NOT NULL,
            face_encoding BLOB NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE
        )
    """)

    # --- Attendance Table ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Present',
            proof_image_path TEXT,
            camera_source INTEGER,
            confidence REAL,
            FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
            UNIQUE(student_id, date)
        )
    """)

    conn.commit()

    # --- Seed Default Admin ---
    cursor.execute("SELECT COUNT(*) FROM admin WHERE username = ?", (DEFAULT_ADMIN_USERNAME,))
    if cursor.fetchone()[0] == 0:
        password_hash = bcrypt.hashpw(
            DEFAULT_ADMIN_PASSWORD.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        cursor.execute(
            "INSERT INTO admin (username, password_hash, created_at) VALUES (?, ?, ?)",
            (DEFAULT_ADMIN_USERNAME, password_hash, datetime.now().isoformat())
        )
        conn.commit()
        print(f"[DB] Default admin '{DEFAULT_ADMIN_USERNAME}' seeded.")

    conn.close()
    print("[DB] Database initialized successfully.")


# --- Run on import for convenience ---
if __name__ == "__main__":
    init_db()
