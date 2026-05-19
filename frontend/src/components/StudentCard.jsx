import { useNavigate } from 'react-router-dom';

export default function StudentCard({ student }) {
  const navigate = useNavigate();

  const getPctBadge = (pct) => {
    if (pct >= 75) return 'badge-success';
    if (pct >= 50) return 'badge-warning';
    return 'badge-danger';
  };

  return (
    <div
      className="student-card glass-card"
      onClick={() => navigate(`/students/${student.id}`)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 'var(--font-lg)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {student.name}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-mono)' }}>{student.roll_number}</p>
        </div>
        <div>
          <span className={`badge ${getPctBadge(student.attendance_percentage)}`} style={{ fontSize: 'var(--font-base)', fontWeight: 700, padding: '0.4rem 0.8rem' }}>
            {student.attendance_percentage}%
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {student.branch && <span className="badge badge-info">{student.branch}</span>}
        {student.section && <span className="badge badge-info">SEC {student.section}</span>}
        {student.semester && <span className="badge badge-info">SEM {student.semester}</span>}
        <span className="badge badge-primary">{student.face_count || 0} PROFILES</span>
      </div>
    </div>
  );
}
