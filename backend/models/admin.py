# --- Admin Model ---
# Functions for admin authentication and lookup.

import bcrypt
from database import get_db


def get_admin_by_username(username):
    """Fetch an admin record by username."""
    conn = get_db()
    admin = conn.execute(
        "SELECT * FROM admin WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    return dict(admin) if admin else None


def verify_admin(username, password):
    """Verify admin credentials. Returns admin dict on success, None on failure."""
    admin = get_admin_by_username(username)
    if admin is None:
        return None
    if bcrypt.checkpw(password.encode('utf-8'), admin['password_hash'].encode('utf-8')):
        return admin
    return None
