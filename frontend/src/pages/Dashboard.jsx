import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import { Zap, Plus, Clock, Activity, Users, TrendingUp, BarChart3, Video, ClipboardList, UserPlus, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, todayRes] = await Promise.all([
        client.get('/attendance/stats'),
        client.get('/attendance/today')
      ]);
      setStats(statsRes.data);
      setTodayRecords(todayRes.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', paddingTop: '8rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const totalProfiles = stats?.total_students || 0;
  const presentToday = stats?.present_today || 0;
  const todayRate = stats?.today_percentage || 0;
  const absentToday = totalProfiles - presentToday;

  return (
    <div className="dashboard-container page-enter">
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Zap size={20} /></div>
          <div className="stat-value">{totalProfiles}</div>
          <div className="stat-label">TOTAL STUDENTS</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Activity size={20} /></div>
          <div className="stat-value">{presentToday}</div>
          <div className="stat-label">PRESENT TODAY</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Users size={20} /></div>
          <div className="stat-value">{absentToday}</div>
          <div className="stat-label">ABSENT TODAY</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div className="stat-value">{todayRate}%</div>
          <div className="stat-label">TODAY'S RATE</div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="glass-card mb-lg">
        <h2 className="section-title">MODULES</h2>
        <div className="modules-grid">
          <div className="module-card" onClick={() => navigate('/analytics')}>
            <div className="module-icon" style={{ background: 'linear-gradient(135deg, #ff5722, #ff7a00)' }}>
              <BarChart3 size={24} color="#fff" />
            </div>
            <div className="module-info">
              <span className="module-name">Analytics</span>
              <span className="module-desc">Charts, trends & reports</span>
            </div>
            <ChevronRight size={18} className="module-arrow" />
          </div>
          <div className="module-card" onClick={() => navigate('/students')}>
            <div className="module-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <Users size={24} color="#fff" />
            </div>
            <div className="module-info">
              <span className="module-name">Students</span>
              <span className="module-desc">Manage student profiles</span>
            </div>
            <ChevronRight size={18} className="module-arrow" />
          </div>
          <div className="module-card" onClick={() => navigate('/attendance')}>
            <div className="module-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <ClipboardList size={24} color="#fff" />
            </div>
            <div className="module-info">
              <span className="module-name">Attendance Logs</span>
              <span className="module-desc">View & filter records</span>
            </div>
            <ChevronRight size={18} className="module-arrow" />
          </div>
          <div className="module-card" onClick={() => navigate('/live')}>
            <div className="module-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <Video size={24} color="#fff" />
            </div>
            <div className="module-info">
              <span className="module-name">Live Camera</span>
              <span className="module-desc">Real-time face detection</span>
            </div>
            <ChevronRight size={18} className="module-arrow" />
          </div>
          <div className="module-card" onClick={() => navigate('/students/new')}>
            <div className="module-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <UserPlus size={24} color="#fff" />
            </div>
            <div className="module-info">
              <span className="module-name">Register Student</span>
              <span className="module-desc">Add new student & faces</span>
            </div>
            <ChevronRight size={18} className="module-arrow" />
          </div>
        </div>
      </div>

      {/* Today's Logs */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            TODAY'S LOGS
          </h2>
          <span style={{
            fontSize: 'var(--font-sm)',
            color: '#ff5722',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(255, 87, 34, 0.15)',
            padding: '0.3rem 0.8rem',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            border: '1px solid rgba(255, 87, 34, 0.3)'
          }}>
            {stats?.date || new Date().toISOString().split('T')[0]}
          </span>
        </div>
        <AttendanceTable records={todayRecords} />
      </div>

      {/* Component Specific Styling */}
      <style>{`
        .dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          width: 100%;
        }

        .section-title {
          font-size: var(--font-xl);
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--text-primary);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: var(--space-lg);
        }

        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .module-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .module-card:hover {
          border-color: var(--primary);
          background: var(--bg-input-focus);
          transform: translateX(4px);
          box-shadow: 0 4px 16px rgba(255, 87, 34, 0.1);
        }

        .module-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .module-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .module-name {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: var(--font-base);
          color: var(--text-primary);
          letter-spacing: 0.03em;
        }

        .module-desc {
          font-size: var(--font-sm);
          color: var(--text-muted);
          margin-top: 0.1rem;
        }

        .module-arrow {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .module-card:hover .module-arrow {
          color: var(--primary);
          transform: translateX(4px);
        }

        .mb-lg {
          margin-bottom: var(--space-lg);
        }

        @media (max-width: 640px) {
          .modules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
