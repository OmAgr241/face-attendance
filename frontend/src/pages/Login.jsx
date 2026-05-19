import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import { Activity, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // --- Redirect if already logged in ---
  if (localStorage.getItem('auth_token')) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await client.post('/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      localStorage.setItem('admin_id', res.data.admin_id);
      toast.success('AUTH.SUCCESS: Admin Identity Confirmed');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'AUTH.ERROR: Connection Refused';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Decorative background blobs */}
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Activity size={28} color="#ffffff" />
          </div>
          <h1>SYS.OP.LOGIN</h1>
          <p>AUTHORIZED PERSONNEL ONLY</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-username">ADMIN.ID</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="Enter operator ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">PASSPHRASE</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter passphrase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--primary)' }}></div> AUTHENTICATING...</>
            ) : (
              'INITIALIZE HANDSHAKE'
            )}
          </button>
        </form>

        <p className="login-hint">
          DEFAULT ACCESS: <strong>admin</strong> / <strong>admin123</strong>
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: var(--bg-page);
          position: relative;
          overflow: hidden;
        }

        .login-bg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.15;
          animation: pulse-blob 8s infinite alternate;
        }

        .login-bg-blob-1 {
          width: 500px;
          height: 500px;
          background: var(--primary);
          top: -10%;
          right: -10%;
        }

        .login-bg-blob-2 {
          width: 400px;
          height: 400px;
          background: #ff7a00;
          bottom: -10%;
          left: -10%;
          animation-delay: -4s;
        }

        @keyframes pulse-blob {
          0% { transform: scale(1) translate(0, 0); opacity: 0.1; }
          100% { transform: scale(1.2) translate(-20px, 20px); opacity: 0.25; }
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 2.5rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: scaleIn 500ms cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 1;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 1rem;
          border-radius: var(--radius-lg);
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px var(--primary-glow);
        }

        .login-logo h1 {
          font-size: 1.5rem;
          font-family: var(--font-mono);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .login-logo p {
          color: var(--primary);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          margin-top: 0.5rem;
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: var(--font-sm);
          font-family: var(--font-mono);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .login-hint {
          text-align: center;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: var(--font-xs);
          margin-top: 1.5rem;
          letter-spacing: 0.05em;
        }

        .login-hint strong {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
