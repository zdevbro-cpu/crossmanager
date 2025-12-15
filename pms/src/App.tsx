import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText
} from 'lucide-react'
import './App.css'
import Spinner from './components/Spinner'
import { ProjectProvider } from './context/ProjectContext'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import ProjectSwitcher from './components/ProjectSwitcher'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/Login'


const ContractsPage = lazy(() => import('./pages/Contracts'))
const DocumentsPage = lazy(() => import('./pages/Documents'))
const OverviewPage = lazy(() => import('./pages/Overview'))
const ProjectsPage = lazy(() => import('./pages/Projects'))
const ReportsPage = lazy(() => import('./pages/Reports'))
const ResourcesPage = lazy(() => import('./pages/Resources'))
const SchedulePage = lazy(() => import('./pages/Schedule'))
const MembersPage = lazy(() => import('./pages/Members'))
const SignupPage = lazy(() => import('./pages/Signup'))

const navItems = [
  { path: '/overview', label: '대시보드' },
  { path: '/projects', label: '프로젝트' },
  { path: '/schedule', label: '일정(WBS)' },
  { path: '/resources', label: '자원' },
  { path: '/contracts', label: '계약/견적' },

  { id: 'documents', label: '문서관리', icon: <FileText size={20} />, path: '/documents' },
  { id: 'reports', label: '보고서', icon: <LayoutDashboard size={20} />, path: '/reports' },
  { path: '/members', label: '시스템관리' },
]



function App() {
  const { user, signOut } = useAuth()
  return (
    <ToastProvider>
      <ProjectProvider>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand-group">
              <div className="brand">
                <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src="images/cross-logo.png?v=3" alt="Cross 로고" className="brand-logo" />
                  <div className="brand-text">
                    <p className="brand-label">Cross Specialness Inc.</p>
                    <strong className="brand-title">프로젝트 관리시스템(PMS)</strong>
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
              <ProjectSwitcher />
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
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/login" element={<LoginPage />} />

                <Route path="/signup" element={<SignupPage />} />
                <Route
                  path="/overview"
                  element={
                    <RequireAuth>
                      <OverviewPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <RequireAuth>
                      <ProjectsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/schedule"
                  element={
                    <RequireAuth>
                      <SchedulePage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/resources"
                  element={
                    <RequireAuth>
                      <ResourcesPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/contracts"
                  element={
                    <RequireAuth>
                      <ContractsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <RequireAuth>
                      <DocumentsPage />
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
                <Route
                  path="/members"
                  element={
                    <RequireAuth>
                      <MembersPage />
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
