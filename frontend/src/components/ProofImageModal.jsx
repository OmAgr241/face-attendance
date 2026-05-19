import { useEffect } from 'react';
import { X, UserCheck } from 'lucide-react';

export default function ProofImageModal({ imagePath, onClose }) {
  // --- Close on Escape key ---
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>
          {imagePath}
        </p>
      </div>
    </div>
  );
}
