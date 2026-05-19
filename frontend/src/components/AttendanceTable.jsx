import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import ProofImageModal from './ProofImageModal';

export default function AttendanceTable({ records, showStudent = true }) {
  const [proofImage, setProofImage] = useState(null);

  if (!records || records.length === 0) {
    return (
      <div className="empty-state">
        <ClipboardList size={48} color="var(--border-hover)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <p style={{ fontFamily: 'var(--font-mono)' }}>NO RECORDS FOUND</p>
      </div>
    );
  }

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
              <th>Confidence</th>
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
                <td><span className="badge badge-success">{record.status}</span></td>
                <td>
                  {record.proof_image_path ? (
                    <div
                      className="proof-thumb"
                      onClick={() => setProofImage(record.proof_image_path)}
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

      {proofImage && (
        <ProofImageModal
          imagePath={proofImage}
          onClose={() => setProofImage(null)}
        />
      )}
    </>
  );
}
