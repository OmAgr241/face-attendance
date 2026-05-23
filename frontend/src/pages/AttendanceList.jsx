import { useState, useEffect } from 'react';
import client from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import toast from 'react-hot-toast';
import { Filter, Search, Download, FileSpreadsheet, PercentCircle } from 'lucide-react';

export default function AttendanceList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', branch: '', section: '', search: '' });
  const [minPct, setMinPct] = useState('');
  const [downloading, setDownloading] = useState(null);

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

  // --- Status toggle handler ---
  const handleStatusChange = async (recordId, newStatus) => {
    try {
      await client.patch(`/attendance/${recordId}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      // Update local state immediately
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, status: newStatus } : r
      ));
    } catch (err) {
      toast.error('Failed to update status');
      throw err;
    }
  };

  // --- Excel download helpers ---
  const downloadExcel = async (endpoint, params, filename) => {
    setDownloading(filename);
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) query.set(k, v);
      });
      const res = await client.get(`${endpoint}?${query.toString()}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err) {
      toast.error('Download failed');
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDaily = () => {
    const params = {
      date: filters.date_from && !filters.date_to ? filters.date_from : undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      branch: filters.branch || undefined,
      section: filters.section || undefined,
    };
    const dateStr = filters.date_from || new Date().toISOString().split('T')[0];
    downloadExcel('/attendance/export/daily', params, `daily_attendance_${dateStr}.xlsx`);
  };

  const handleDownloadSummary = () => {
    const params = {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      branch: filters.branch || undefined,
      section: filters.section || undefined,
      min_percentage: minPct || undefined,
    };
    downloadExcel('/attendance/export/summary', params, `attendance_summary.xlsx`);
  };

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

      {/* Download Section */}
      <div className="glass-card mb-lg">
        <div className="section-header">
          <Download size={18} color="var(--primary)" />
          <h3>EXPORT DATA</h3>
        </div>
        <div className="export-controls">
          <div className="export-row">
            <div className="export-info">
              <FileSpreadsheet size={20} color="var(--success)" />
              <div>
                <span className="export-title">Daily Attendance Sheet</span>
                <span className="export-desc">Export all students with Present/Absent status for selected dates</span>
              </div>
            </div>
            <button
              className="btn btn-success btn-sm"
              onClick={handleDownloadDaily}
              disabled={downloading === 'daily'}
            >
              <Download size={14} />
              {downloading?.includes('daily') ? 'DOWNLOADING...' : 'DOWNLOAD .XLSX'}
            </button>
          </div>

          <div className="export-divider" />

          <div className="export-row">
            <div className="export-info">
              <PercentCircle size={20} color="var(--info)" />
              <div>
                <span className="export-title">Attendance Summary Report</span>
                <span className="export-desc">Student attendance percentage for selected period. Optionally filter by minimum %.</span>
              </div>
            </div>
            <div className="export-actions">
              <div className="min-pct-input">
                <label>MIN %</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g., 75"
                  value={minPct}
                  onChange={(e) => setMinPct(e.target.value)}
                  min="0"
                  max="100"
                  style={{ width: '90px', padding: '0.45rem 0.6rem', fontSize: 'var(--font-sm)' }}
                />
              </div>
              <button
                className="btn btn-info btn-sm"
                onClick={handleDownloadSummary}
                disabled={downloading === 'summary'}
              >
                <Download size={14} />
                {downloading?.includes('summary') ? 'DOWNLOADING...' : 'DOWNLOAD .XLSX'}
              </button>
            </div>
          </div>
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
          <AttendanceTable records={filtered} onStatusChange={handleStatusChange} />
        </>
      )}
    </div>
  );
}
