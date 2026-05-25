import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CameraFeed from '../components/CameraFeed';
import toast from 'react-hot-toast';
import { Activity, ShieldAlert, LogIn, Play, Square, RefreshCw, CameraOff, Terminal, Zap, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

// --- Direct axios for public camera API (no auth needed) ---
const cameraApi = axios.create({ baseURL: '/api' });

// --- TTS Helper ---
function speak(text) {
  if ('speechSynthesis' in window) {
    // Cancel any queued speech to avoid overlap
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Try to use a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }
}

export default function LiveAttendance() {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [starting, setStarting] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const pollRef = useRef(null);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('auth_token');

  // --- Refs for TTS deduplication ---
  const spokenNamesRef = useRef(new Set());      // Names already announced this session
  const lastUnknownToastRef = useRef(0);          // Timestamp of last unknown toast
  const prevEventCountRef = useRef(0);            // Track previous event count to detect new events
  const isMutedRef = useRef(false);               // Ref mirror to avoid stale closure in effect

  // Keep ref in sync with state
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // --- Load voices on mount (Chrome needs this) ---
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

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
      // Reset TTS tracking when camera stops
      spokenNamesRef.current.clear();
      prevEventCountRef.current = 0;
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
      const newEvents = res.data.events || [];
      
      // --- Process only genuinely new events ---
      const prevCount = prevEventCountRef.current;
      if (newEvents.length > prevCount) {
        const brandNew = newEvents.slice(prevCount);
        
        for (const evt of brandNew) {
          if (evt.type === 'unknown') {
            // --- Unknown person: toast + TTS ---
            const now = Date.now();
            if (now - lastUnknownToastRef.current > 5000) {
              lastUnknownToastRef.current = now;
              toast.error('⚠ Person not in database', {
                duration: 4000,
                style: {
                  background: '#1a1c22',
                  color: '#ff5252',
                  border: '1px solid rgba(255, 82, 82, 0.3)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                },
                icon: '🚫',
              });
              if (!isMutedRef.current) {
                speak('Person not in database');
              }
            }
          } else {
            // --- Recognized person: TTS announcement ---
            const nameKey = evt.name?.toLowerCase();
            if (nameKey && !spokenNamesRef.current.has(nameKey)) {
              spokenNamesRef.current.add(nameKey);
              if (!isMutedRef.current) {
                speak(`${evt.name}, Present`);
              }
            }
          }
        }
      }
      
      prevEventCountRef.current = newEvents.length;
      setEvents(newEvents);
    } catch (err) { /* ignore */ }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await cameraApi.post('/camera/start', { camera_index: selectedCamera });
      setIsRunning(true);
      setStreamKey(Date.now());
      setEvents([]);
      spokenNamesRef.current.clear();
      prevEventCountRef.current = 0;
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
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      toast.success('System Offline');
    } catch (err) {
      toast.error('Failed to terminate system');
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      toast(next ? 'TTS Muted' : 'TTS Unmuted', {
        icon: next ? '🔇' : '🔊',
        duration: 1500,
        style: {
          background: '#1a1c22',
          color: '#e0e0e0',
          border: '1px solid #2a2c32',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        },
      });
      return next;
    });
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
              DASHBOARD
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
              <label>SELECT CAMERA</label>
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
                  {starting ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white' }}></div> STARTING...</> : (
                    <>
                      <Play size={18} />
                      START CAMERA
                    </>
                  )}
                </button>
              ) : (
                <button className="btn btn-danger btn-lg" onClick={handleStop}>
                  <Square size={18} />
                  STOP
                </button>
              )}
              <button className="btn btn-secondary" onClick={detectCameras} disabled={loadingCameras || isRunning}>
                <RefreshCw size={16} />
                REFRESH
              </button>

              {/* Mute/Unmute Toggle */}
              <button
                className={`btn ${isMuted ? 'btn-muted' : 'btn-tts-active'}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute TTS' : 'Mute TTS'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                {isMuted ? 'UNMUTE' : 'TTS ON'}
              </button>
            </div>

            {isRunning && (
              <div className="flex items-center gap-sm" style={{ marginTop: '1.4rem' }}>
                <div className="live-pulse"></div>
                <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>CAMERA ACTIVE</span>
              </div>
            )}
          </div>

          <p className="text-sm mt-md">
            &gt; To use a mobile phone as camera, connect via USB (DroidCam / Iriun) and click Refresh.
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
                  ATTENDANCE LOG
                </h3>
                {events.length > 0 && <span className="badge badge-primary">{events.length}</span>}
              </div>
              {events.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
                  <Terminal size={40} color="var(--border-hover)" style={{ opacity: 0.5 }} />
                  <p className="text-sm" style={{ marginTop: '0.75rem', textTransform: 'uppercase' }}>
                    {isRunning ? 'Waiting for students...' : 'Camera is off'}
                  </p>
                </div>
              ) : (
                <div className="event-log">
                  {[...events].reverse().map((evt, i) => (
                    <div key={`${evt.timestamp}-${evt.name}-${i}`} className={`event-log-item ${evt.type === 'unknown' ? 'event-unknown' : ''}`}>
                      <div className={`event-dot ${evt.type === 'unknown' ? 'event-dot-red' : ''}`}></div>
                      <span className={`event-name ${evt.type === 'unknown' ? 'event-name-red' : ''}`}>
                        {evt.type === 'unknown' && <AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
                        {evt.name}
                      </span>
                      {evt.type !== 'unknown' && (
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{(evt.confidence).toFixed(1)}%</span>
                      )}
                      {evt.type === 'unknown' && (
                        <span className="badge badge-danger-subtle" style={{ fontSize: '0.65rem' }}>NOT IN DB</span>
                      )}
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

        /* --- TTS Button Styles --- */
        .btn-tts-active {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.05));
          border: 1px solid rgba(76, 175, 80, 0.4);
          color: #66bb6a;
          font-family: var(--font-mono);
          font-weight: 700;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-tts-active:hover {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(76, 175, 80, 0.1));
          box-shadow: 0 0 12px rgba(76, 175, 80, 0.2);
        }

        .btn-muted {
          background: linear-gradient(135deg, rgba(255, 82, 82, 0.1), rgba(255, 82, 82, 0.03));
          border: 1px solid rgba(255, 82, 82, 0.3);
          color: #ff5252;
          font-family: var(--font-mono);
          font-weight: 700;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-muted:hover {
          background: linear-gradient(135deg, rgba(255, 82, 82, 0.2), rgba(255, 82, 82, 0.08));
          box-shadow: 0 0 12px rgba(255, 82, 82, 0.2);
        }

        /* --- Unknown event styles --- */
        .event-unknown {
          border-left: 3px solid #ff5252 !important;
          background: rgba(255, 82, 82, 0.05) !important;
        }

        .event-dot-red {
          background: #ff5252 !important;
          box-shadow: 0 0 6px rgba(255, 82, 82, 0.5) !important;
        }

        .event-name-red {
          color: #ff5252 !important;
        }

        .badge-danger-subtle {
          background: rgba(255, 82, 82, 0.15);
          color: #ff5252;
          border: 1px solid rgba(255, 82, 82, 0.3);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
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
