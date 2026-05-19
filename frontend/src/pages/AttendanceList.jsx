import { useState, useEffect } from 'react';
import client from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import { Filter, Search } from 'lucide-react';

export default function AttendanceList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', branch: '', section: '', search: '' });

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async (params = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params.date_from) query.set('date_from', params.date_from);
      if (params.date_to) query.set('date_to', params.date_to);
      if (params.branch) query.set('branch', params.branch);
      if (params.section) query.set('section', params.section);
      const res = await client.get(`/attendance?${query.toString()}`);
      setRecords(res.data);
    } catch (err) {
      console.error('Fetch attendance error:', err);
    } finally { setLoading(false); }
  };

  const handleFilterChange = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    if (key !== 'search') fetchRecords(updated);
  };

  const handleApply = () => fetchRecords(filters);

  // --- Client-side name search ---
  const filtered = filters.search
    ? records.filter((r) =>
        r.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.roll_number?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : records;

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>ACCESS LOGS</h1>
        <p>System attendance records and history</p>
      </div>

      {/* Filters */}
      <div className="glass-card mb-lg">
        <div className="section-header">
          <Filter size={18} color="var(--primary)" />
          <h3>DATA FILTERS</h3>
        </div>
        <div className="filter-bar">
          <div className="form-group">
            <label>FROM DATE</label>
            <input type="date" className="form-input" value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)} />
          </div>
          <div className="form-group">
            <label>TO DATE</label>
            <input type="date" className="form-input" value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)} />
          </div>
          <div className="form-group">
            <label>BRANCH</label>
            <input className="form-input" placeholder="e.g., CSE" value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)} />
          </div>
          <div className="form-group">
            <label>SECTION</label>
            <input className="form-input" placeholder="e.g., A" value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)} />
          </div>
          <div className="form-group">
            <label>QUERY DB</label>
            <input className="form-input" placeholder="Name or ID..." value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleApply} style={{ marginTop: '1.4rem' }}>
            <Search size={16} />
            EXECUTE
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: '3rem' }}><div className="spinner"></div></div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-md">
            <p className="text-sm" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              <span className="badge badge-primary" style={{ marginRight: '0.5rem' }}>{filtered.length}</span>
              RESULTS ACQUIRED
            </p>
          </div>
          <AttendanceTable records={filtered} />
        </>
      )}
    </div>
  );
}
