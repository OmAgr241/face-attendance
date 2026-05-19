import { CameraOff, ScanFace } from 'lucide-react';

export default function CameraFeed({ isRunning }) {
  if (!isRunning) {
    return (
      <div className="camera-container">
        <div className="camera-placeholder">
          <CameraOff size={48} opacity={0.3} color="var(--primary)" />
          <p style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '1rem' }}>SYSTEM STANDBY</p>
          <p style={{ fontSize: 'var(--font-sm)', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            Select a source and initialize stream
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-container active">
      {/* Stream overlay for high-tech look */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(2, 6, 23, 0.6)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(4px)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>
        <ScanFace size={16} /> REC
      </div>
      <img
        src="/api/camera/stream"
        alt="Live camera feed"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}
