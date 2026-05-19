# Face Recognition Attendance System

A full-stack college attendance system using real-time face recognition. A camera detects and recognizes student faces, marks attendance automatically, and provides an admin dashboard for reviewing records, profiles, and proof images.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Backend | Python 3 + Flask |
| CV/AI | OpenCV + face_recognition (dlib) |
| Database | SQLite |
| Storage | Local filesystem |

## Prerequisites

- **Python 3.10+** (tested on 3.14.0)
- **Node.js 18+** (tested on v22.20.0)
- **CMake** (for dlib compilation)
- **dlib** (face_recognition dependency)

## Setup Instructions

### 1. Backend

```bash
cd face-attendance/backend

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install cmake dlib
pip install -r requirements.txt

# Start the server
python app.py
```

The backend runs on **http://localhost:5000**.

### 2. Frontend

```bash
cd face-attendance/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on **http://localhost:5173** with API proxy to Flask.

## Default Credentials

| Username | Password |
|----------|----------|
| admin    | admin123 |

## Using Your Phone as a Webcam

You can connect your phone via USB and use it as a camera source:

1. Install **DroidCam** (Android) or **Iriun Webcam** (iOS/Android) on your phone
2. Install the desktop client on your PC
3. Connect your phone via USB and start the app
4. In the Live Attendance page, click **Refresh Cameras** to detect the phone camera
5. Select it from the dropdown and click **Start**

## Architecture

```
┌─────────────────┐     HTTP/REST      ┌──────────────────┐
│   React (Vite)  │ ◄──── proxy ─────► │   Flask (5000)   │
│   Port 5173     │                    │                  │
│                 │  /api/camera/stream │  Camera Thread   │
│  MJPEG <img>   │ ◄── MJPEG stream ── │  (daemon)        │
└─────────────────┘                    │                  │
                                       │  face_recognition│
                                       │  OpenCV          │
                                       │  SQLite DB       │
                                       └──────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | Admin login |
| POST | /api/logout | Admin logout |
| GET | /api/students | List all students |
| POST | /api/students | Create student |
| GET | /api/students/:id | Student detail |
| DELETE | /api/students/:id | Delete student |
| POST | /api/students/:id/faces | Upload face images |
| GET | /api/attendance | Filtered attendance list |
| GET | /api/attendance/today | Today's records |
| GET | /api/attendance/stats | Dashboard statistics |
| POST | /api/camera/start | Start camera |
| POST | /api/camera/stop | Stop camera |
| GET | /api/camera/stream | MJPEG video stream |
| GET | /api/camera/status | Camera state |
| GET | /api/camera/devices | Detect available cameras |
| GET | /api/camera/events | Recent recognition events |

## Folder Structure

```
face-attendance/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models/  (admin, student, attendance)
│   ├── routes/  (auth, students, attendance, camera)
│   ├── services/ (face, camera, attendance)
│   ├── storage/ (student_images/, proof_images/)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/ (Login, Dashboard, Students, etc.)
│   │   ├── components/ (Navbar, CameraFeed, etc.)
│   │   ├── api/client.js
│   │   └── App.jsx
│   └── vite.config.js
└── README.md
```

## License

College project — for educational purposes only.
