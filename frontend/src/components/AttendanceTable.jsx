import { useState } from 'react';
import { ClipboardList, ShieldAlert, ShieldCheck } from 'lucide-react';
import ProofImageModal from './ProofImageModal';

export default function AttendanceTable({ records, showStudent = true, onStatusChange }) {
  const [proofRecord, setProofRecord] = useState(null);

  if (!records || records.length === 0) {
    return (
      <div className="empty-state">
        <ClipboardList size={48} color="var(--border-hover)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <p style={{ fontFamily: 'var(--font-mono)' }}>NO RECORDS FOUND</p>
      </div>
    );
  }

  const handleStatusToggle = async (record) => {
    const newStatus = record.status === 'Present' ? 'Absent' : 'Present';
    if (onStatusChange) {
      await onStatusChange(record.id, newStatus);
    }
  };

  return (
    <>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {showStudent && <th>Name</th>}
              {showStudent && <th>Roll No.</th>}
              <th>Date</th>
              <th>Time</th>
              <th>Match %</th>
              <th>Status</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {showStudent && <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.name}</td>}
                {showStudent && <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)' }}>{record.roll_number}</td>}
                <td style={{ fontFamily: 'var(--font-mono)' }}>{record.date}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{record.time}</td>
                <td>
                  <span className={`badge ${
                    record.confidence >= 0.7 ? 'badge-success' :
                    record.confidence >= 0.5 ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {(record.confidence * 100).toFixed(1)}%
                  </span>
                </td>
                <td>
                  {onStatusChange ? (
                    <button
                      className={`status-toggle-btn ${record.status === 'Present' ? 'status-present' : 'status-absent'}`}
                      onClick={() => handleStatusToggle(record)}
                      title={`Click to mark ${record.status === 'Present' ? 'Absent' : 'Present'}`}
                    >
                      {record.status === 'Present' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                      {record.status}
                    </button>
                  ) : (
                    <span className={`badge ${record.status === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                      {record.status}
                    </span>
                  )}
                </td>
                <td>
                  {record.proof_image_path ? (
                    <div
                      className="proof-thumb"
                      onClick={() => setProofRecord(record)}
                    >
                      <img
                        src={`/${record.proof_image_path}`}
                        alt="Proof"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proofRecord && (
        <ProofImageModal
          record={proofRecord}
          onClose={() => setProofRecord(null)}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  );
}
