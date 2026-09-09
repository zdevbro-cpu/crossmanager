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

function getPortalHomeUrl() {
  const envUrl = import.meta.env.VITE_PORTAL_HOME_URL as string | undefined
  if (envUrl) return envUrl

  const loginUrl = import.meta.env.VITE_PORTAL_LOGIN_URL as string | undefined
  if (loginUrl) {
    try {
      const u = new URL(loginUrl, window.location.origin)
      u.pathname = u.pathname.replace(/\/login\/?$/, '/')
      u.search = ''
      u.hash = ''
      return u.toString()
    } catch {
      // ignore
    }
  }

  return `${window.location.origin}/`
}

function AppContent() {
  const { user, signOut } = useAuth()
  const logoSrc = `${import.meta.env.BASE_URL}images/cross-logo.png`

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
              <a
                href={getPortalHomeUrl()}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}
              >
                <img src={logoSrc} alt="Cross 로고" className="brand-logo" />
                <div className="brand-text">
                  <p className="brand-label">Cross Specialness Inc.</p>
                  <strong className="brand-title">장비 관리시스템(EMS)</strong>
                </div>
              </a>
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
