import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CameraFeed from '../components/CameraFeed';
import toast from 'react-hot-toast';
import { Activity, ShieldAlert, LogIn, Play, Square, RefreshCw, CameraOff, Terminal, Zap } from 'lucide-react';

// --- Direct axios for public camera API (no auth needed) ---
const cameraApi = axios.create({ baseURL: '/api' });

export default function LiveAttendance() {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [starting, setStarting] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const pollRef = useRef(null);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('auth_token');

  useEffect(() => {
    checkStatus();
    detectCameras();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(fetchEvents, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning]);

  const checkStatus = async () => {
    try {
      const res = await cameraApi.get('/camera/status');
      setIsRunning(res.data.running);
      if (res.data.running) {
        setSelectedCamera(res.data.camera_index);
        setStreamKey(Date.now());
      }
    } catch (err) { /* ignore */ }
  };

  const detectCameras = async () => {
    setLoadingCameras(true);
    try {
      const res = await cameraApi.get('/camera/devices');
      setCameras(res.data.cameras || []);
    } catch (err) {
      setCameras([{ index: 0, name: 'Default Camera', resolution: '640x480' }]);
    } finally { setLoadingCameras(false); }
  };

  const fetchEvents = async () => {
    try {
      const res = await cameraApi.get('/camera/events');
      setEvents(res.data.events || []);
    } catch (err) { /* ignore */ }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await cameraApi.post('/camera/start', { camera_index: selectedCamera });
      setIsRunning(true);
      setStreamKey(Date.now());
      setEvents([]);
      toast.success('System Initialized — Scanning Active');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initialize system');
    } finally { setStarting(false); }
  };

  const handleStop = async () => {
    try {
      await cameraApi.post('/camera/stop');
      setIsRunning(false);
      setStreamKey(0);
      toast.success('System Offline');
    } catch (err) {
      toast.error('Failed to terminate system');
    }
  };


  return (
    <div className="live-page">
      {/* Header matching Top Navbar aesthetic */}
      <header className="live-top-navbar">
        <div className="navbar-logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Zap size={20} color="#ffffff" fill="#ffffff" />
          </div>
          <span className="logo-text">FACEATTEND</span>
        </div>
        <div className="navbar-actions">
          {isLoggedIn ? (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>
              <ShieldAlert size={16} />
              COMMAND CENTER
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>
              <LogIn size={16} />
              ADMIN LOGIN
            </button>
          )}
        </div>
      </header>

      <div className="live-body">
        {/* Controls */}
        <div className="glass-card mb-lg">
          <div className="flex items-center gap-lg" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, minWidth: 220 }}>
              <label>HARDWARE SOURCE</label>
              <select className="form-select" value={selectedCamera}
                onChange={(e) => setSelectedCamera(Number(e.target.value))} disabled={isRunning}>
                {cameras.length > 0 ? cameras.map((c) => (
                  <option key={c.index} value={c.index}>{c.name} — {c.resolution}</option>
                )) : (
                  <option value={0}>CAM 0 (DEFAULT)</option>
                )}
              </select>
            </div>

            <div className="flex gap-md" style={{ marginTop: '1.4rem' }}>
              {!isRunning ? (
                <button className="btn btn-success btn-lg" onClick={handleStart} disabled={starting}>
                  {starting ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white' }}></div> BOOTING...</> : (
                    <>
                      <Play size={18} />
                      INIT STREAM
                    </>
                  )}
                </button>
              ) : (
                <button className="btn btn-danger btn-lg" onClick={handleStop}>
                  <Square size={18} />
                  HALT
                </button>
              )}
              <button className="btn btn-secondary" onClick={detectCameras} disabled={loadingCameras || isRunning}>
                <RefreshCw size={16} />
                SCAN
              </button>
            </div>

            {isRunning && (
              <div className="flex items-center gap-sm" style={{ marginTop: '1.4rem' }}>
                <div className="live-pulse"></div>
                <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>LIVE SCANNING</span>
              </div>
            )}
          </div>

          <p className="text-sm mt-md">
            &gt; TO ROUTE MOBILE DEVICE AS HARDWARE SOURCE, BIND VIA USB (DROIDCAM / IRIUN) AND RE-SCAN.
          </p>
        </div>

        <div className="live-grid">
          {/* Camera Feed */}
          <div className="live-feed-area">
            <CameraFeed isRunning={isRunning} streamKey={streamKey} />
          </div>

          {/* Event Log */}
          <div className="live-log-area">
            <div className="glass-card" style={{ height: '100%' }}>
              <div className="flex justify-between items-center mb-md">
                <h3 style={{ fontSize: 'var(--font-lg)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Terminal size={18} />
                  OUTPUT LOG
                </h3>
                {events.length > 0 && <span className="badge badge-primary">{events.length}</span>}
              </div>
              {events.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
                  <Terminal size={40} color="var(--border-hover)" style={{ opacity: 0.5 }} />
                  <p className="text-sm" style={{ marginTop: '0.75rem', textTransform: 'uppercase' }}>
                    {isRunning ? '> AWAITING IDENTIFICATION...' : '> SYSTEM IDLE'}
                  </p>
                </div>
              ) : (
                <div className="event-log">
                  {[...events].reverse().map((evt, i) => (
                    <div key={`${evt.timestamp}-${evt.name}-${i}`} className="event-log-item">
                      <div className="event-dot"></div>
                      <span className="event-name">{evt.name}</span>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{(evt.confidence).toFixed(2)}</span>
                      <span className="event-time">{evt.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .live-page {
          min-height: 100vh;
          background: var(--bg-page);
          display: flex;
          flex-direction: column;
        }

        .live-top-navbar {
          height: 80px;
          background: #0d0e11;
          border-bottom: 1px solid #1a1c22;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding:0 3rem;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 4px 20px rgba(0,0, 0, 0.4);
        }

        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #ff5722;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(255, 87, 34, 0.4);
        }

        .logo-text {
          font-size: 1.25rem;
          font-family: var(--font-mono);
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
        }

        .live-body {
          flex: 1;
          padding: 2rem 3rem;
          max-width: 1500px;
          margin: 0 auto;
          width: 100%;
        }

        .live-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: var(--space-lg);
          align-items: start;
        }

        .live-pulse {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
          animation: pulse 1.5s infinite;
          box-shadow: 0 0 10px rgba(255, 87, 34, 0.6);
        }

        .live-feed-area .camera-container {
          max-width: 100%;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 87, 34, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 87, 34, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 87, 34, 0); }
        }

        @media (max-width: 900px) {
          .live-top-navbar {
            padding: 0 1.5rem;
          }
          .live-grid {
            grid-template-columns: 1fr;
          }
          .live-body {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
