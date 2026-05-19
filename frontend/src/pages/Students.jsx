import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { UserPlus, Search, Users } from 'lucide-react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await client.get('/students');
      setStudents(res.data);
    } catch (err) {
      console.error('Fetch students error:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Client-side search filter ---
  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const getPctColor = (pct) => {
    if (pct >= 75) return 'var(--success)';
    if (pct >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getPctBadge = (pct) => {
    if (pct >= 75) return 'badge-success';
    if (pct >= 50) return 'badge-warning';
    return 'badge-danger';
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-header flex justify-between items-center" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1>PROFILES DB</h1>
          <p>{students.length} REGISTERED IDENTITIES</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/students/new')}>
          <UserPlus size={18} />
          ADD PROFILE
        </button>
      </div>

      {/* Search */}
      <div className="search-bar mb-lg">
        <span className="search-icon">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="QUERY DATABASE BY NAME OR ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="student-search"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <Users size={48} color="var(--border-hover)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p style={{ fontFamily: 'var(--font-mono)' }}>{search ? 'NO MATCHES FOUND IN DATABASE' : 'DATABASE EMPTY'}</p>
            {!search && (
              <button className="btn btn-primary mt-md" onClick={() => navigate('/students/new')}>
                INITIALIZE FIRST PROFILE
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>ID.NO</th>
                <th>BRANCH</th>
                <th>SECTION</th>
                <th>SEMESTER</th>
                <th>BIOMETRICS</th>
                <th>PRESENCE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="clickable"
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{s.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>{s.roll_number}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.branch || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.section || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.semester || '—'}</td>
                  <td>
                    <span className={`badge ${s.face_count > 0 ? 'badge-primary' : 'badge-warning'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                      {s.face_count || 0} DATASET
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getPctBadge(s.attendance_percentage)}`} style={{ fontWeight: 700, fontSize: 'var(--font-sm)', fontFamily: 'var(--font-mono)' }}>
                      {s.attendance_percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
