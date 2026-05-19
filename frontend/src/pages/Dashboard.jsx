import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import { Zap, Plus, Clock, Activity, Thermometer, Gauge, Settings, ChevronRight } from 'lucide-react';

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
  const overallHealth = stats?.overall_percentage || 98;

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
          <div className="stat-icon"><Activity size={20} /></div>
          <div className="stat-value">{presentToday}</div>
          <div className="stat-label">PRESENT TODAY</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Gauge size={20} /></div>
          <div className="stat-value">{overallHealth}%</div>
          <div className="stat-label">OVERALL HEALTH</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-value">12H</div>
          <div className="stat-label">UPTIME</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card mb-lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>QUICK ACTIONS</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/students/new')}>
              <Plus size={16} /> ADD STUDENT
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/live')}>
               <Activity size={16} /> LIVE ATTENDANCE
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/attendance')}>
              <Clock size={16} /> VIEW LOGS
            </button>
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="glass-card mb-lg">
        <h2 style={{
          fontSize: 'var(--font-xl)',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-lg)'
        }}>SYSTEM DETAILS</h2>
        <div className="details-grid">
          <div className="detail-box">
            <div className="detail-meta">
              <span className="detail-lbl">Mode</span>
              <span className="detail-val">ACTIVE</span>
            </div>
            <Zap size={16} color="#ffffff" />
          </div>
          <div className="detail-box">
            <div className="detail-meta">
              <span className="detail-lbl">Uptime</span>
              <span className="detail-val">12H 0M</span>
            </div>
            <Clock size={16} color="#ffffff" />
          </div>
          <div className="detail-box">
            <div className="detail-meta">
              <span className="detail-lbl">AI Confidence</span>
              <span className="detail-val">99.4%</span>
            </div>
            <Activity size={16} color="#ffffff" />
          </div>
          <div className="detail-box">
            <div className="detail-meta">
              <span className="detail-lbl">Temperature</span>
              <span className="detail-val">30°C</span>
            </div>
            <Thermometer size={16} color="#ffffff" />
          </div>
        </div>
      </div>

      {/* Today's Logs */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
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

        .details-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .detail-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-input);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          transition: all var(--transition-fast);
        }

        .detail-box:hover {
          border-color: var(--primary);
          background: var(--bg-input-focus);
        }

        .detail-meta {
          display: flex;
          flex-direction: column;
        }

        .detail-lbl {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .detail-val {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .mb-lg {
          margin-bottom: var(--space-lg);
        }

        @media (max-width: 1024px) {
          .details-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .details-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
