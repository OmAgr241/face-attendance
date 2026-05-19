import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Video, Users, UserPlus, ClipboardList, LogOut, Menu, X, Zap, LayoutGrid, Bell } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_id');
    navigate('/login');
  };

    const navItems = [
      { path: '/dashboard', label: 'DASHBOARD' },
      { path: '/students', label: 'STUDENTS' },
      { path: '/attendance', label: 'ATTENDANCE' },
      { path: '/live', label: 'LIVE ATTENDANCE' },
    ];

  return (
    <header className="top-navbar">
      {/* Logo */}
      <div className="navbar-logo" onClick={() => navigate('/dashboard')}>
        <div className="logo-icon">
          <Zap size={20} color="#ffffff" fill="#ffffff" />
        </div>
        <span className="logo-text">FACEATTEND</span>
      </div>

      {/* Navigation Links */}
      <nav className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : ''}`
            }
            onClick={() => setMobileOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        <button className="nav-link mobile-logout" onClick={handleLogout}>
          LOGOUT
        </button>
      </nav>

      {/* Right Icons */}
      <div className="navbar-actions">
        <button className="action-btn" onClick={() => navigate('/dashboard')} title="Modules Grid">
          <LayoutGrid size={18} />
        </button>
        <button className="action-btn" onClick={handleLogout} title="Terminate Session">
           <LogOut size={18} />
        </button>
        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <style>{`
        .top-navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: #0d0e11;
          border-bottom: 1px solid #1a1c22;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 3rem;
          z-index: 1000;
        }

        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #ff5722;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(255, 87, 34, 0.4);
        }

        .logo-text {
          font-size: 1.25rem;
          font-family: var(--font-mono);
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
        }

        .navbar-links {
          display: flex;
          align-items: center;
          gap: 2.5rem;
        }

        .nav-link {
          font-size: 0.85rem;
          font-family: var(--font-mono);
          font-weight: 600;
          color: #8e939e;
          text-decoration: none;
          letter-spacing: 0.08em;
          transition: all var(--transition-fast);
          position: relative;
          padding: 0.5rem 0;
          background: none;
          border: none;
          cursor: pointer;
        }

        .nav-link:hover {
          color: #ffffff;
        }

        .nav-link-active {
          color: #ffffff !important;
          font-weight: 700;
        }

        .nav-link-active::after {
          content: '';
          position: absolute;
          bottom: -28px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--primary);
          box-shadow: 0 -2px 10px var(--primary-glow);
        }

        .mobile-logout {
          display: none;
        }

        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .action-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #1a1c22;
          border: 1px solid #2a2d36;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .action-btn:hover {
          background: #22252e;
          color: #ffffff;
          border-color: var(--primary);
          box-shadow: 0 0 12px var(--primary-glow);
        }

        .mobile-toggle {
          display: none;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #1a1c22;
          border: 1px solid #2a2d36;
          color: #ffffff;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .top-navbar {
            padding: 0 1.5rem;
          }
          .navbar-links {
            position: fixed;
            top: 80px;
            left: 0;
            right: 0;
            background: #0d0e11;
            border-bottom: 1px solid #1a1c22;
            flex-direction: column;
            padding: 2rem;
            gap: 1.5rem;
            transform: translateY(-150%);
            transition: transform 0.3s ease;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
          }
          .navbar-links.mobile-open {
            transform: translateY(0);
          }
          .nav-link-active::after {
            bottom: -5px;
          }
          .mobile-toggle {
            display: flex;
          }
          .mobile-logout {
            display: block;
            color: var(--danger-text);
          }
        }
      `}</style>
    </header>
  );
}
