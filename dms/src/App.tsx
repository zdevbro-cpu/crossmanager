import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import './App.css'
import Spinner from './components/Spinner'
import { ProjectProvider } from './context/ProjectContext'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/Login'

const RootRedirect = () => {
  const location = useLocation()
  return <Navigate to={`/dashboard${location.search}`} replace />
}

function getPortalHomeUrl() {
  if (import.meta.env.PROD) return '/'
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
    } catch { }
  }
  return `${window.location.origin}/`
}

const DMSDashboard = lazy(() => import('./pages/DMSDashboard'))
const SignupPage = lazy(() => import('./pages/Signup'))

const navItems: any[] = [
  // { path: '/dashboard', label: '대시보드', icon: <LayoutDashboard size={18} /> },
  // { path: '/binder', label: '발주처 제출', icon: <FileText size={18} /> },
  // { path: '/templates', label: '템플릿', icon: <FileText size={18} /> },
  // { path: '/admin', label: '설정', icon: <FileText size={18} /> },
]

function App() {
  const { user, signOut } = useAuth()
  const logoSrc = `${import.meta.env.BASE_URL}images/cross-logo.png`

  // Modal State in App Level

  return (
    <ToastProvider>
      <ProjectProvider>
        <div className="app-shell">
          <header className="topbar">
            {/* Brand Group ... */}
            <div className="brand-group">
              <div className="brand">
                <a
                  href={getPortalHomeUrl()}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                  <img src={logoSrc} alt="Cross 로고" className="brand-logo" />
                  <div className="brand-text">
                    <p className="brand-label">Cross Specialness Inc.</p>
                    <strong className="brand-title">통합 문서관리시스템(DMS)</strong>
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
                    <span style={{ marginLeft: '8px' }}>{item.icon}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="header-actions">
              {/* Force Project Register Button Here */}
              <button
                onClick={() => (window as any).openGlobalSearch?.()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#adb5bd',
                  border: '1px solid #2d3139',
                  padding: '0.42rem 0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  marginRight: '0.5rem',
                  height: '36px',
                  boxSizing: 'border-box',
                  transition: '0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#adb5bd'; }}
              >
                <Search size={16} /> 통합 문서 검색
              </button>


              {user ? (
                <div className="auth-pill">
                  <span>{user.email}</span>
                  <button className="pill pill-outline" onClick={() => signOut()}>
                    로그아웃
                  </button>
                </div>
              ) : (
                <NavLink to="/login" className="pill pill-outline">
                  로그인
                </NavLink>
              )}
            </div>
          </header>

          <main className="content">
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <DMSDashboard />
                    </RequireAuth>
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <ToastViewport />

        </div>
      </ProjectProvider>
    </ToastProvider>
  )
}

export default App
