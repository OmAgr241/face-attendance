import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, Users, Calendar, Filter, BarChart3,
  ArrowLeft, Award, AlertTriangle, ChevronDown
} from 'lucide-react';

const CHART_COLORS = ['#ff5722', '#ff7a00', '#ff9800', '#ffc107', '#8bc34a', '#4caf50', '#00bcd4', '#2196f3', '#673ab7', '#e91e63'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [section, setSection] = useState('');
  const [branch, setBranch] = useState('');
  const [sections, setSections] = useState([]);
  const [branches, setBranches] = useState([]);
  const [activeChart, setActiveChart] = useState('trend');
  const navigate = useNavigate();

  useEffect(() => {
    // Set default date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchAnalytics();
    }
  }, [dateFrom, dateTo, section, branch]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (section) params.append('section', section);
      if (branch) params.append('branch', branch);

      const res = await client.get(`/attendance/analytics?${params.toString()}`);
      setData(res.data);

      // Extract unique sections and branches for filter dropdowns
      if (res.data.student_rates) {
        const uniqueSections = [...new Set(res.data.student_rates.map(s => s.section).filter(s => s && s !== 'N/A'))];
        const uniqueBranches = [...new Set(res.data.student_rates.map(s => s.branch).filter(b => b && b !== 'N/A'))];
        setSections(uniqueSections);
        setBranches(uniqueBranches);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="tooltip-value" style={{ color: entry.color }}>
            {entry.name}: {entry.value}{entry.name.includes('%') || entry.name === 'Rate' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', paddingTop: '8rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const daily = data?.daily_trend || [];
  const students = data?.student_rates || [];
  const sectionData = data?.section_breakdown || [];
  const branchData = data?.branch_breakdown || [];
  const summary = data?.summary || {};

  return (
    <div className="analytics-page page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{
            fontSize: 'var(--font-3xl)', fontWeight: 700,
            fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
            letterSpacing: '0.03em'
          }}>ANALYTICS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
            {data?.date_range?.from} → {data?.date_range?.to} &nbsp;·&nbsp; {data?.total_students || 0} students &nbsp;·&nbsp; {data?.total_days || 0} days recorded
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> DASHBOARD
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-lg)' }}>
          <Filter size={16} color="var(--primary)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            FILTERS
          </span>
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>FROM</label>
            <input type="date" className="form-input" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>TO</label>
            <input type="date" className="form-input" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          {sections.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label>SECTION</label>
              <select className="form-select" value={section} onChange={e => setSection(e.target.value)}>
                <option value="">All</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {branches.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label>BRANCH</label>
              <select className="form-select" value={branch} onChange={e => setBranch(e.target.value)}>
                <option value="">All</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.4rem' }}>
            <button className="btn btn-primary btn-sm" onClick={fetchAnalytics}>APPLY</button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setSection(''); setBranch('');
              const today = new Date();
              const ago = new Date(today); ago.setDate(ago.getDate() - 30);
              setDateFrom(ago.toISOString().split('T')[0]);
              setDateTo(today.toISOString().split('T')[0]);
            }}>RESET</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div className="stat-value">{summary.average_percentage || 0}%</div>
          <div className="stat-label">AVG ATTENDANCE</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Award size={20} /></div>
          <div className="stat-value">{summary.best_day?.percentage || 0}%</div>
          <div className="stat-label">BEST DAY ({summary.best_day?.date || '—'})</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><AlertTriangle size={20} /></div>
          <div className="stat-value">{summary.worst_day?.percentage || 0}%</div>
          <div className="stat-label">WORST DAY ({summary.worst_day?.date || '—'})</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}><Calendar size={20} /></div>
          <div className="stat-value">{data?.total_days || 0}</div>
          <div className="stat-label">DAYS RECORDED</div>
        </div>
      </div>

      {/* Chart Tabs */}
      <div className="chart-tabs">
        {[
          { key: 'trend', label: 'Daily Trend' },
          { key: 'students', label: 'Student Rates' },
          { key: 'sections', label: 'Sections' },
          { key: 'branches', label: 'Branches' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`chart-tab ${activeChart === tab.key ? 'chart-tab-active' : ''}`}
            onClick={() => setActiveChart(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
        {/* Daily Trend Line Chart */}
        {activeChart === 'trend' && (
          <div>
            <h3 className="chart-title">Daily Attendance Trend</h3>
            {daily.length === 0 ? (
              <div className="empty-state"><p>No attendance data in this date range</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={daily} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d36" />
                  <XAxis dataKey="date" stroke="#8e939e" fontSize={12} fontFamily="'Fira Code', monospace"
                    tickFormatter={v => v.slice(5)} />
                  <YAxis stroke="#8e939e" fontSize={12} fontFamily="'Fira Code', monospace"
                    domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="percentage" name="Rate"
                    stroke="#ff5722" strokeWidth={2.5} dot={{ fill: '#ff5722', r: 4 }}
                    activeDot={{ r: 6, fill: '#ff7a00', stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="present" name="Present"
                    stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Student Rates Bar Chart */}
        {activeChart === 'students' && (
          <div>
            <h3 className="chart-title">Student Attendance Rates</h3>
            {students.length === 0 ? (
              <div className="empty-state"><p>No student data available</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(380, students.length * 42)}>
                <BarChart data={students} layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d36" />
                  <XAxis type="number" domain={[0, 100]} stroke="#8e939e" fontSize={12}
                    fontFamily="'Fira Code', monospace" tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="#8e939e" fontSize={12}
                    fontFamily="'Fira Code', monospace" width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" name="Rate" radius={[0, 6, 6, 0]} barSize={24}>
                    {students.map((entry, idx) => (
                      <Cell key={idx} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Section Pie Chart */}
        {activeChart === 'sections' && (
          <div>
            <h3 className="chart-title">Section-wise Distribution</h3>
            {sectionData.length === 0 ? (
              <div className="empty-state"><p>No section data available</p></div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
                <ResponsiveContainer width="100%" height={380}>
                  <PieChart>
                    <Pie data={sectionData} dataKey="students" nameKey="section"
                      cx="50%" cy="50%" outerRadius={140} innerRadius={70}
                      paddingAngle={3} label={({ section, students }) => `${section} (${students})`}
                      labelLine={{ stroke: '#8e939e' }}>
                      {sectionData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="breakdown-table">
                  <table className="data-table">
                    <thead><tr><th>Section</th><th>Students</th><th>Records</th></tr></thead>
                    <tbody>
                      {sectionData.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.section}</td>
                          <td>{row.students}</td>
                          <td>{row.records}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Branch Pie Chart */}
        {activeChart === 'branches' && (
          <div>
            <h3 className="chart-title">Branch-wise Distribution</h3>
            {branchData.length === 0 ? (
              <div className="empty-state"><p>No branch data available</p></div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
                <ResponsiveContainer width="100%" height={380}>
                  <PieChart>
                    <Pie data={branchData} dataKey="students" nameKey="branch"
                      cx="50%" cy="50%" outerRadius={140} innerRadius={70}
                      paddingAngle={3} label={({ branch, students }) => `${branch} (${students})`}
                      labelLine={{ stroke: '#8e939e' }}>
                      {branchData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="breakdown-table">
                  <table className="data-table">
                    <thead><tr><th>Branch</th><th>Students</th><th>Records</th></tr></thead>
                    <tbody>
                      {branchData.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.branch}</td>
                          <td>{row.students}</td>
                          <td>{row.records}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Student Table */}
      {students.length > 0 && (
        <div className="glass-card" style={{ marginTop: 'var(--space-xl)' }}>
          <h3 className="chart-title" style={{ marginBottom: 'var(--space-lg)' }}>Student Attendance Details</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No.</th>
                  <th>Section</th>
                  <th>Branch</th>
                  <th>Days Present</th>
                  <th>Total Days</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="clickable" onClick={() => navigate(`/students/${s.id}`)}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{s.roll_number}</td>
                    <td>{s.section}</td>
                    <td>{s.branch}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{s.days_present}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{s.total_days}</td>
                    <td>
                      <span className={`badge ${s.rate >= 75 ? 'badge-success' : s.rate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {s.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .analytics-page {
          width: 100%;
        }

        .chart-tabs {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 0;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          padding: 0.5rem 0.5rem 0;
          overflow-x: auto;
        }

        .chart-tab {
          padding: 0.65rem 1.25rem;
          font-size: var(--font-sm);
          font-family: var(--font-mono);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: var(--radius-md) var(--radius-md) 0 0;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .chart-tab:hover {
          color: var(--text-primary);
          background: var(--bg-card-hover);
        }

        .chart-tab-active {
          color: var(--primary) !important;
          background: var(--bg-page) !important;
          border-bottom: 2px solid var(--primary);
          box-shadow: 0 -2px 8px rgba(255, 87, 34, 0.1);
        }

        .chart-tabs + .glass-card {
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          border-top: 1px solid var(--border);
        }

        .chart-title {
          font-size: var(--font-lg);
          font-family: var(--font-mono);
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-lg);
        }

        .chart-tooltip {
          background: #1a1c22;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          box-shadow: var(--shadow-lg);
        }

        .tooltip-label {
          font-family: var(--font-mono);
          font-size: var(--font-sm);
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .tooltip-value {
          font-family: var(--font-mono);
          font-size: var(--font-sm);
          font-weight: 600;
        }

        .breakdown-table {
          flex: 1;
          min-width: 280px;
        }

        /* Recharts overrides for dark theme */
        .recharts-legend-item-text {
          color: var(--text-secondary) !important;
          font-family: var(--font-mono) !important;
          font-size: 0.75rem !important;
        }

        .recharts-default-tooltip {
          background: #1a1c22 !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
        }

        .recharts-label {
          fill: var(--text-muted) !important;
          font-family: var(--font-mono) !important;
          font-size: 0.7rem !important;
        }

        @media (max-width: 768px) {
          .breakdown-table {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
