# --- Camera Routes ---
# Start/stop camera, MJPEG stream, status, and device detection.
# These routes are PUBLIC (no auth) so the live attendance kiosk can work
# without admin login. Admin dashboard pages handle their own auth.

from flask import Blueprint, request, jsonify, Response
from services.camera_service import camera_service

camera_bp = Blueprint('camera', __name__)


# --- POST /api/camera/start ---
@camera_bp.route('/api/camera/start', methods=['POST'])
def start_camera():
    data = request.get_json() or {}
    camera_index = data.get('camera_index', 0)

    try:
        camera_service.start(camera_index=camera_index)
    except RuntimeError as e:
        msg = str(e)
        if "already running" in msg.lower():
            return jsonify({"error": "Camera already running"}), 409
        elif "not available" in msg.lower():
            return jsonify({"error": f"Camera index {camera_index} not available"}), 503
        return jsonify({"error": msg}), 500

    return jsonify({
        "message": "Camera started",
        "camera_index": camera_index
    }), 200


# --- POST /api/camera/stop ---
@camera_bp.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    camera_service.stop()
    return jsonify({"message": "Camera stopped"}), 200


# --- GET /api/camera/stream ---
@camera_bp.route('/api/camera/stream', methods=['GET'])
def camera_stream():
    """MJPEG stream endpoint — must be public for <img> tag to work."""
    if not camera_service.is_running():
        return jsonify({"error": "Camera not running"}), 503

    return Response(
        camera_service.generate_stream(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive'
        }
    )


# --- GET /api/camera/status ---
@camera_bp.route('/api/camera/status', methods=['GET'])
def camera_status():
    return jsonify({
        "running": camera_service.is_running(),
        "camera_index": camera_service.get_camera_index()
    }), 200


# --- GET /api/camera/devices ---
@camera_bp.route('/api/camera/devices', methods=['GET'])
def list_camera_devices():
    """
    Detect all available camera devices.
    Public so live attendance kiosk can detect phone cameras.
    """
    cameras = camera_service.detect_cameras()
    return jsonify({"cameras": cameras}), 200


# --- GET /api/camera/events ---
@camera_bp.route('/api/camera/events', methods=['GET'])
def camera_events():
    """Get recent recognition events for the live log panel."""
    events = camera_service.get_recent_events()
    return jsonify({"events": events}), 200
