# FaceAttend — Face Recognition Attendance System

A full-stack college attendance system powered by real-time face recognition. A camera detects and recognizes student faces, announces their names via text-to-speech, marks attendance automatically with photographic proof, and provides a rich admin dashboard for reviewing records, analytics, and exports.

## ✨ Key Features

- **🎯 Real-Time Face Recognition** — Live MJPEG camera stream with bounding boxes, names, and confidence scores on detected faces
- **🗣️ Text-to-Speech Announcements** — Speaks _"{Name}, Present"_ on recognition; _"Person not in database"_ for unknowns
- **🔇 Mute/Unmute Toggle** — Control TTS announcements from the live attendance page
- **📸 Proof Images** — Raw camera frame saved as JPEG proof for each attendance record
- **📊 Admin Dashboard** — Stat cards, quick-access modules, today's attendance logs
- **📈 Analytics** — Interactive charts with daily trends, per-student rates, section/branch breakdowns
- **👤 Student Management** — Full CRUD with multi-image face upload, re-encoding, and attendance history
- **📋 Attendance Management** — Filterable records with date ranges, branch, section, status toggle, and proof viewer
- **📥 Excel Exports** — Download daily attendance and student summary reports as styled `.xlsx` files
- **📱 Mobile Camera Support** — Use your phone as a webcam via USB (DroidCam / Iriun)
- **🚫 Unknown Person Alerts** — Red bounding box + toast notification for unrecognized faces

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 8 |
| Styling | TailwindCSS v4 + Custom CSS |
| Charts | Recharts |
| Backend | Python 3 + Flask |
| CV/AI | OpenCV + face_recognition (dlib) |
| Database | SQLite |
| Auth | bcrypt + UUID token |

## Prerequisites

- **Python 3.10+** (tested on 3.14.0)
- **Node.js 18+** (tested on v22.20.0)
- **CMake** (for dlib compilation)
- **dlib** (face_recognition dependency)

## Quick Start

### 1. Backend

```bash
cd face-attendance/backend

# Create & activate virtual environment
python -m venv venv
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

Backend runs on **http://localhost:5000**.

### 2. Frontend

```bash
cd face-attendance/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:5173** with API proxy to Flask.

### 3. First-Time Usage

1. Open `http://localhost:5173` — this is the **Live Attendance** kiosk (public, no login)
2. Click **Admin Login** → use `admin` / `admin123`
3. Go to **Register Student** → fill details + upload 3–10 face photos
4. Return to **Live Attendance** → select camera → click **Start Camera**
5. Students face the camera — attendance is marked automatically with TTS announcements
6. Check **Dashboard** for today's stats and **Analytics** for historical charts

## Default Credentials

| Username | Password |
|----------|----------|
| admin    | admin123 |

## Architecture

```
┌─────────────────┐     HTTP/REST      ┌──────────────────────────┐
│   React (Vite)  │ ◄──── proxy ─────► │      Flask (5000)        │
│   Port 5173     │                    │                          │
│                 │  /api/camera/stream │  ┌── Capture Thread ──┐ │
│  MJPEG <img>   │ ◄── MJPEG stream ── │  │ Read → Draw → JPEG │ │
│  TTS Engine    │                    │  └──────────────────────┘ │
│  (browser)      │                    │  ┌── Recognition Thread┐ │
└─────────────────┘                    │  │ Detect → Match →    │ │
                                       │  │ Mark Attendance     │ │
                                       │  └──────────────────────┘ │
                                       │                          │
                                       │  face_recognition + dlib │
                                       │  OpenCV + SQLite         │
                                       └──────────────────────────┘
```

The camera service uses a **two-thread architecture**:
- **Capture Thread** (fast, ~15 FPS) — reads frames, draws cached bounding boxes, encodes JPEG. Never blocks.
- **Recognition Thread** (slow, ~2–5 FPS) — runs face detection and matching asynchronously, updates cached face results.

This prevents heavy face recognition from freezing the live stream.

## Using Your Phone as a Webcam

1. Install **DroidCam** (Android) or **Iriun Webcam** (iOS/Android) on your phone
2. Install the desktop client on your PC
3. Connect your phone via USB and start the app
4. In the Live Attendance page, click **Refresh Cameras** to detect the phone camera
5. Select it from the dropdown and click **Start**

## Live Attendance Features

| Feature | Description |
|---------|-------------|
| **Bounding Boxes** | Green = recognized & marked, Orange = already marked today, Red = unknown |
| **Name Labels** | Student name displayed above the bounding box |
| **TTS** | Browser's SpeechSynthesis API announces names on recognition |
| **Mute/Unmute** | Toggle button to silence TTS announcements |
| **Unknown Alerts** | Toast notification + TTS for unrecognized faces (5s cooldown) |
| **Event Log** | Real-time log panel with timestamps, confidence scores, and status indicators |

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/login | ✗ | Admin login |
| POST | /api/logout | ✓ | Admin logout |

### Students

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/students | ✓ | List all students with face count and attendance % |
| POST | /api/students | ✓ | Create student (multipart with face images) |
| GET | /api/students/:id | ✓ | Student detail with attendance history |
| DELETE | /api/students/:id | ✓ | Delete student and all related data |
| POST | /api/students/:id/faces | ✓ | Upload additional face images |
| POST | /api/students/:id/reencode | ✓ | Re-encode all face images |

### Attendance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/attendance | ✓ | Filtered records (date, student, section, branch, date range) |
| GET | /api/attendance/today | ✓ | Today's records |
| GET | /api/attendance/stats | ✓ | Dashboard statistics |
| GET | /api/attendance/analytics | ✓ | Analytics data with charts |
| PATCH | /api/attendance/:id/status | ✓ | Toggle Present/Absent |
| GET | /api/attendance/export/daily | ✓ | Download daily Excel report |
| GET | /api/attendance/export/summary | ✓ | Download student summary Excel report |

### Camera (Public — No Auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/camera/start | ✗ | Start camera with specified index |
| POST | /api/camera/stop | ✗ | Stop camera and release resources |
| GET | /api/camera/stream | ✗ | MJPEG video stream |
| GET | /api/camera/status | ✗ | Camera running state |
| GET | /api/camera/devices | ✗ | Scan available cameras |
| GET | /api/camera/events | ✗ | Recent recognition events (with type: recognized/unknown) |

## Folder Structure

```
face-attendance/
├── backend/
│   ├── app.py                          (Flask entry + dlib monkey-patch)
│   ├── config.py                       (all configurable constants)
│   ├── database.py                     (SQLite init + table creation + admin seed)
│   ├── requirements.txt
│   ├── models/                         (admin, student, attendance)
│   ├── routes/                         (auth, students, attendance, camera)
│   ├── services/
│   │   ├── face_service.py             (encoding, matching, detection)
│   │   ├── camera_service.py           (two-thread capture + recognition + MJPEG)
│   │   └── attendance_service.py       (mark attendance + proof images)
│   └── storage/                        (student_images/, proof_images/)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LiveAttendance.jsx      (camera + TTS + mute toggle + event log)
│   │   │   ├── Dashboard.jsx           (stat cards + modules + today's logs)
│   │   │   ├── Analytics.jsx           (charts + filters + student table)
│   │   │   ├── AttendanceList.jsx      (filterable records + proof viewer + exports)
│   │   │   ├── Students.jsx            (searchable student list)
│   │   │   ├── RegisterStudent.jsx     (registration + face upload)
│   │   │   ├── StudentDetail.jsx       (profile + faces + history)
│   │   │   └── Login.jsx               (admin auth)
│   │   ├── components/
│   │   │   ├── Navbar.jsx              (top navigation)
│   │   │   ├── AttendanceTable.jsx     (reusable records table)
│   │   │   ├── CameraFeed.jsx          (MJPEG stream display)
│   │   │   ├── ProofImageModal.jsx     (full-screen proof viewer)
│   │   │   └── StudentCard.jsx         (student profile card)
│   │   ├── api/client.js               (Axios instance + auth interceptor)
│   │   └── index.css                   (complete design system)
│   └── vite.config.js
├── IMPLEMENTATION_PROMPT.md            (future multi-teacher implementation guide)
├── PROJECT_REPORT.md
└── README.md
```

## Configuration

All tunable parameters are in `backend/config.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `RECOGNITION_THRESHOLD` | `0.5` | Face match threshold (lower = stricter) |
| `MAX_FACES_PER_STUDENT` | `10` | Maximum face images per student |
| `STREAM_FPS_LIMIT` | `15` | Max MJPEG stream FPS |
| `FRAME_WIDTH × FRAME_HEIGHT` | `640×480` | Camera capture resolution |
| `JPEG_QUALITY` | `85` | Proof image quality |
| `MAX_IMAGE_SIZE_MB` | `5` | Max upload size per face image |

## Planned Features

- **Multi-teacher** — Multiple teacher accounts with role-based access
- **Multi-branch** — Admin-managed branches and subjects
- **Per-subject attendance** — Track attendance per class group (Branch + Section + Subject)
- **Multiple sessions per day** — Unlimited attendance sessions per class group
- **Teacher dashboard** — Scoped analytics and exports per teacher
- **Multi-camera** — Support multiple classroom cameras simultaneously

See [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md) for the full implementation plan.

## License

College project — for educational purposes only.

**Project by**: Om Agrawal
**GitHub**: [github.com/OmAgr241/face-attendance](https://github.com/OmAgr241/face-attendance)
