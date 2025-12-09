import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/ToastProvider'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/Login'
import EquipmentListPage from './pages/EquipmentList'
import EquipmentDetailPage from './pages/EquipmentDetail'
import { LogOut } from 'lucide-react'
import './App.css'
import './index.css'

function AppContent() {
  const { user, signOut } = useAuth()

  const navItems = [
    { path: '/equipment', label: '장비 목록' },
    { path: '/maintenance', label: '정비 이력' },
    { path: '/inspection', label: '검사 관리' },
    { path: '/analytics', label: '분석' }
  ]

  return (
    <div className="app">
      {user && (
        <header className="topbar">
          <div className="brand-group">
            <div className="brand">
              <img src="images/cross-logo.png" alt="Cross 로고" className="brand-logo" />
              <div className="brand-text">
                <p className="brand-label">Cross Specialness Inc.</p>
                <strong className="brand-title">장비 관리시스템(EMS)</strong>
              </div>
            </div>
          </div>

          <div className="nav-container">
            <nav className="main-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="header-actions">
            {user && (
              <div className="auth-pill">
                <span>{user.email}</span>
                <button
                  className="pill pill-outline"
                  onClick={() => signOut()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/equipment"
            element={
              <RequireAuth>
                <EquipmentListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/equipment/:id"
            element={
              <RequireAuth>
                <EquipmentDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/maintenance"
            element={
              <RequireAuth>
                <div className="page">
                  <h2>정비 이력</h2>
                  <p className="muted">준비 중입니다.</p>
                </div>
              </RequireAuth>
            }
          />
          <Route
            path="/inspection"
            element={
              <RequireAuth>
                <div className="page">
                  <h2>검사 관리</h2>
                  <p className="muted">준비 중입니다.</p>
                </div>
              </RequireAuth>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAuth>
                <div className="page">
                  <h2>분석</h2>
                  <p className="muted">준비 중입니다.</p>
                </div>
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/equipment" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
