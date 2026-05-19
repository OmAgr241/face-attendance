import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import toast from 'react-hot-toast';
import { User, Image as ImageIcon, Calendar, Trash2, ArrowLeft } from 'lucide-react';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchStudent(); }, [id]);

  const fetchStudent = async () => {
    try {
      const res = await client.get(`/students/${id}`);
      setStudent(res.data);
    } catch (err) {
      toast.error('Student not found');
      navigate('/students');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`PURGE RECORD: ${student.name}? This action is irreversible.`)) return;
    setDeleting(true);
    try {
      await client.delete(`/students/${id}`);
      toast.success('Identity Purged');
      navigate('/students');
    } catch (err) {
      toast.error('Purge Failed');
    } finally { setDeleting(false); }
  };

  const getPctColor = (pct) => {
    if (pct >= 75) return 'var(--success)';
    if (pct >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (loading) {
    return <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner"></div></div>;
  }

  if (!student) return null;

  const pct = student.attendance_percentage || 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDash = (pct / 100) * circumference;

  return (
    <div className="page-enter">
      <div className="page-header flex justify-between items-center" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{student.name}</h1>
          <p className="text-sm">ID: {student.roll_number}</p>
        </div>
        <div className="flex gap-md">
          <button className="btn btn-secondary" onClick={() => navigate('/students')}>
            <ArrowLeft size={16} />
            BACK
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} />
            {deleting ? 'PURGING...' : 'PURGE'}
          </button>
        </div>
      </div>

      <div className="card-grid-2 mb-xl">

        {/* Student Info Card */}
        <div className="glass-card">
          <div className="section-header">
            <User size={18} color="var(--primary)" />
            <h3>IDENTITY METADATA</h3>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {[
              ['BRANCH', student.branch],
              ['SEMESTER', student.semester],
              ['SECTION', student.section],
              ['EMAIL', student.email],
              ['PHONE', student.phone],
              ['REGISTERED', student.created_at?.split('T')[0]],
              ['DATASET', `${student.face_count || 0} PROFILES`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Progress Card */}
        <div className="glass-card flex flex-col items-center justify-center">
          <div className="section-header" style={{ alignSelf: 'flex-start' }}>
            <Calendar size={18} color="var(--primary)" />
            <h3>ATTENDANCE SCORE</h3>
          </div>
          <div className="circular-progress">
            <svg width="160" height="160">
              <circle cx="80" cy="80" r="54" fill="none" stroke="var(--bg-input)" strokeWidth="10" />
              <circle cx="80" cy="80" r="54" fill="none" stroke={getPctColor(pct)} strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={circumference - strokeDash}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <span className="progress-value" style={{ fontFamily: 'var(--font-mono)' }}>{pct}%</span>
          </div>
          <p className="text-sm mt-md">
            {(student.attendance_history || []).length} LOGGED ENTRIES
          </p>
        </div>
      </div>

      {/* Face Images */}
      {student.faces && student.faces.length > 0 && (
        <div className="glass-card mb-lg">
          <div className="section-header">
            <ImageIcon size={18} color="var(--primary)" />
            <h3>BIOMETRIC PROFILES</h3>
          </div>
          <div className="image-previews">
            {student.faces.map((face) => (
              <div key={face.id} className="image-preview">
                <img src={`/${face.face_image_path}`} alt="Face" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance History */}
      <div className="glass-card">
        <div className="section-header">
          <Calendar size={18} color="var(--primary)" />
          <h3>ACCESS LOGS</h3>
        </div>
        <AttendanceTable records={(student.attendance_history || []).map(r => ({ ...r, name: student.name, roll_number: student.roll_number }))} showStudent={false} />
      </div>
    </div>
  );
}
