# --- Auth Routes ---
# POST /api/login, POST /api/logout
# Simple UUID token stored in server-side dict.

import uuid
from functools import wraps
from flask import Blueprint, request, jsonify, g
from models.admin import verify_admin

auth_bp = Blueprint('auth', __name__)

# --- In-Memory Token Store ---
# Maps token -> admin_id
_active_tokens = {}


def auth_required(f):
    """Decorator to enforce authentication on routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth_header[7:]
        if token not in _active_tokens:
            return jsonify({"error": "Unauthorized"}), 401
        g.admin_id = _active_tokens[token]
        g.token = token
        return f(*args, **kwargs)
    return decorated


# --- POST /api/login ---
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password required"}), 400

    admin = verify_admin(data['username'], data['password'])
    if admin is None:
        return jsonify({"error": "Invalid username or password"}), 401

    # --- Generate token ---
    token = str(uuid.uuid4())
    _active_tokens[token] = admin['id']
    return jsonify({"token": token, "admin_id": admin['id']}), 200


# --- POST /api/logout ---
@auth_bp.route('/api/logout', methods=['POST'])
@auth_required
def logout():
    token = g.token
    _active_tokens.pop(token, None)
    return jsonify({"message": "Logged out successfully"}), 200
