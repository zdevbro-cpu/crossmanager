import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import './App.css'
import './pages/Page.css'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import { ProjectProvider, useProject } from './contexts/ProjectContext'
import RequireAuth from './components/RequireAuth'
import Spinner from './components/Spinner'
import { useAuth } from './hooks/useAuth'
import DashboardPage from './pages/Dashboard'
import RiskAssessmentPage from './pages/RiskAssessment'
import RiskAssessmentFormPage from './pages/RiskAssessmentForm'
import RiskAssessmentDetailPage from './pages/RiskAssessmentDetail'
import DriPage from './pages/Dri'
import ChecklistPage from './pages/Checklist'
import PatrolPage from './pages/Patrol'
import EducationPage from './pages/Education'
import IncidentPage from './pages/Incident'
import ReportsPage from './pages/Reports'
import LoginPage from './pages/Login'

const navItems = [
  { path: '/dashboard', label: '현장 대시보드' },
  { path: '/ra', label: '위험성평가(RA)' },
  { path: '/dri', label: 'DRI(일일 위험예지)' },
  { path: '/checklist', label: '체크리스트' },
  { path: '/patrol', label: '패트롤' },
  { path: '/education', label: '교육/자격' },
  { path: '/incidents', label: '사고/아차사고' },
  { path: '/reports', label: '보고·문서' },
]

function AppShell() {
  const { user, loading, signOut } = useAuth()
  const { projects, selectedProjectId, setSelectedProjectId, loading: projectsLoading } = useProject()

  if (loading) return <Spinner />

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-group">
            <div className="brand">
              <img src="images/cross-logo.png" alt="Cross 로고" className="brand-logo" />
              <div className="brand-text">
                <p className="brand-label">Cross Specialness Inc.</p>
                <strong className="brand-title">안전관리 시스템 (SMS)</strong>
              </div>
            </div>
          </div>

          {user && (
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
          )}

          <div className="header-actions">
            {user && !projectsLoading && projects.length > 0 && (
              <div style={{ marginRight: '1rem' }}>
                <select
                  className="input"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{
                    minWidth: '250px',
                    fontWeight: 'bold',
                    background: 'var(--bg-surface)',
                    border: '2px solid var(--primary)',
                    color: 'var(--primary)'
                  }}
                >
                  <option value="ALL">🏢 전체 프로젝트</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      📍 {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {user ? (
              <div className="auth-pill">
                <span>{user.email}</span>
                <button className="pill pill-outline" onClick={() => signOut()}>
                  <LogOut size={16} />
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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/ra"
              element={
                <RequireAuth>
                  <RiskAssessmentPage />
                </RequireAuth>
              }
            />
            <Route
              path="/ra/new"
              element={
                <RequireAuth>
                  <RiskAssessmentFormPage />
                </RequireAuth>
              }
            />
            <Route
              path="/ra/:id"
              element={
                <RequireAuth>
                  <RiskAssessmentDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dri"
              element={
                <RequireAuth>
                  <DriPage />
                </RequireAuth>
              }
            />
            <Route
              path="/checklist"
              element={
                <RequireAuth>
                  <ChecklistPage />
                </RequireAuth>
              }
            />
            <Route
              path="/patrol"
              element={
                <RequireAuth>
                  <PatrolPage />
                </RequireAuth>
              }
            />
            <Route
              path="/education"
              element={
                <RequireAuth>
                  <EducationPage />
                </RequireAuth>
              }
            />
            <Route
              path="/incidents"
              element={
                <RequireAuth>
                  <IncidentPage />
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <ReportsPage />
                </RequireAuth>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <ToastViewport />
      </div>
    </ToastProvider>
  )
}

function App() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  )
}

export default App
