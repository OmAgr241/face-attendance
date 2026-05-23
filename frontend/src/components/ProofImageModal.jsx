import { useState, useEffect } from 'react';
import { X, UserCheck, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function ProofImageModal({ record, onClose, onStatusChange }) {
  const [confirming, setConfirming] = useState(false);
  const [updating, setUpdating] = useState(false);

  const imagePath = record?.proof_image_path;
  const currentStatus = record?.status || 'Present';
  const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';

  // --- Close on Escape key ---
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (confirming) {
          setConfirming(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, confirming]);

  const handleToggle = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setUpdating(true);
    try {
      if (onStatusChange) {
        await onStatusChange(record.id, newStatus);
      }
      onClose();
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdating(false);
      setConfirming(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '1.5rem', maxWidth: '700px' }}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-md)', paddingRight: '2rem' }}>
          <UserCheck size={20} color="var(--primary)" />
          <h3 style={{
            fontSize: 'var(--font-lg)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            ATTENDANCE PROOF
          </h3>
        </div>

        {/* Student info bar */}
        {record?.name && (
          <div className="proof-info-bar">
            <span className="proof-info-name">{record.name}</span>
            <span className="proof-info-roll">{record.roll_number}</span>
            <span className="proof-info-date">{record.date} · {record.time}</span>
          </div>
        )}

        <img
          src={`/${imagePath}`}
          alt="Attendance proof"
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            display: 'block',
            border: '1px solid var(--border)',
          }}
        />

        {/* Status toggle section */}
        {onStatusChange && (
          <div className="proof-status-section">
            <div className="proof-status-current">
              <span className="proof-status-label">CURRENT STATUS</span>
              <span className={`badge ${currentStatus === 'Present' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 'var(--font-sm)', padding: '0.35rem 1rem' }}>
                {currentStatus === 'Present' ? <ShieldCheck size={14} style={{ marginRight: '0.3rem' }} /> : <ShieldAlert size={14} style={{ marginRight: '0.3rem' }} />}
                {currentStatus}
              </span>
            </div>

            {confirming ? (
              <div className="proof-confirm-bar">
                <div className="proof-confirm-warning">
                  <AlertTriangle size={16} color="var(--warning)" />
                  <span>Change status to <strong>{newStatus}</strong>?</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirming(false)}
                    disabled={updating}
                  >
                    CANCEL
                  </button>
                  <button
                    className={`btn btn-sm ${newStatus === 'Absent' ? 'btn-danger' : 'btn-success'}`}
                    onClick={handleToggle}
                    disabled={updating}
                  >
                    {updating ? 'UPDATING...' : `CONFIRM ${newStatus.toUpperCase()}`}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={`btn btn-sm ${newStatus === 'Absent' ? 'btn-danger' : 'btn-success'}`}
                onClick={handleToggle}
                style={{ marginTop: '0.75rem' }}
              >
                {newStatus === 'Absent' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                MARK AS {newStatus.toUpperCase()}
              </button>
            )}
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>
          {imagePath}
        </p>
      </div>
    </div>
  );
}
