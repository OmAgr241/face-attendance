import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import RegisterStudent from './pages/RegisterStudent';
import StudentDetail from './pages/StudentDetail';
import LiveAttendance from './pages/LiveAttendance';
import AttendanceList from './pages/AttendanceList';
const Analytics = lazy(() => import('./pages/Analytics'));
import './index.css';

// --- Protected Route Wrapper (Admin pages only) ---
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3000,
          style: {
            background: '#1a1c22',
            color: '#ffffff',
            border: '1px solid #ff5722',
            borderRadius: '12px',
            fontFamily: "'Fira Code', monospace",
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 87, 34, 0.15)',
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LiveAttendance />} />
        <Route path="/live" element={<LiveAttendance />} />
        <Route path="/login" element={<Login />} />

        {/* Admin-only routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="/students/new" element={<ProtectedRoute><RegisterStudent /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><AttendanceList /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<div style={{display:'flex',justifyContent:'center',paddingTop:'8rem'}}><div className="spinner"></div></div>}><Analytics /></Suspense></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
