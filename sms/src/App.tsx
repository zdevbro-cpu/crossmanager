import { useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import {
  LogOut, LayoutDashboard, ShieldAlert, Sun, ListChecks, Footprints,
  GraduationCap, Siren, FileText, BellRing, Library, ClipboardCheck,
  Database, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
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
import RiskAssessmentEditor from './pages/RiskAssessmentEditor'
import DriPage from './pages/Dri'
import ChecklistPage from './pages/ChecklistPage'
import PatrolPage from './pages/Patrol'
import EducationPage from './pages/Education'
import IncidentPage from './pages/Incident'
import ReportsPage from './pages/Reports'
import LoginPage from './pages/Login'
import ExpiryPage from './pages/Expiry'
import HazardLibraryPage from './pages/HazardLibrary'
import HazardReviewPage from './pages/HazardReview'
import MasterPage from './pages/Master'

// 메뉴 11개가 상단바 한 줄에 들어가지 않아 좌측으로 옮겼다.
// 사이드바라도 평면 나열은 길어서 성격별로 묶는다.
// 기존 메뉴는 하나도 빼지 않았다. 위치만 바뀐다.
const navGroups = [
  {
    label: '',
    items: [
      { path: '/sms/dashboard', label: '현장 대시보드', icon: LayoutDashboard },
    ],
  },
  {
    label: '평가·점검',
    items: [
      { path: '/sms/ra', label: '위험성평가(RA)', icon: ShieldAlert },
      { path: '/sms/dri', label: 'DRI(일일 위험예지)', icon: Sun },
      { path: '/sms/checklist', label: '체크리스트', icon: ListChecks },
      { path: '/sms/patrol', label: '패트롤', icon: Footprints },
    ],
  },
  {
    label: '관리',
    items: [
      { path: '/sms/education', label: '교육/자격', icon: GraduationCap },
      { path: '/sms/incidents', label: '사고/아차사고', icon: Siren },
      { path: '/sms/reports', label: '보고·문서', icon: FileText },
      { path: '/sms/expiry', label: '만료 알림', icon: BellRing },
    ],
  },
  {
    label: '마스터',
    items: [
      { path: '/sms/master', label: '기준정보', icon: Database },
      { path: '/sms/hazard-library', label: '위험요인 라이브러리', icon: Library },
      { path: '/sms/hazard-review', label: '위험요인 검수', icon: ClipboardCheck },
    ],
  },
]

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

function Sidebar() {
  // 접힘 상태는 사람마다 취향이 갈려 브라우저에 남긴다.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sms.sidebar.collapsed') === '1'
  )

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('sms.sidebar.collapsed', v ? '0' : '1')
      return !v
    })
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={toggle}
        title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {navGroups.map((group, gi) => (
        <div className="sidebar-group" key={group.label || `g${gi}`}>
          {group.label && <p className="sidebar-group-label">{group.label}</p>}
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.label}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span className="sidebar-link-text">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

function AppShell() {
  const { user, loading, signOut } = useAuth()
  const { projects, selectedProjectId, setSelectedProjectId, loading: projectsLoading } = useProject()
  const logoSrc = `${import.meta.env.BASE_URL}images/cross-logo.png`

  if (loading) return <Spinner />

  return (
    <ToastProvider>
      <div className="app-shell">
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
                  <strong className="brand-title">안전관리 시스템 (SMS)</strong>
                </div>
              </a>
            </div>
          </div>

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

        {user && <Sidebar />}

        <main className={`content ${user ? '' : 'content-full'}`}>
          <Routes>
            <Route path="/sms/login" element={<LoginPage />} />
            <Route
              path="/sms/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/ra"
              element={
                <RequireAuth>
                  <RiskAssessmentPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/ra/new"
              element={
                <RequireAuth>
                  <RiskAssessmentFormPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/ra/:id"
              element={
                <RequireAuth>
                  <RiskAssessmentDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/ra/form-editor"
              element={
                <RequireAuth>
                  <RiskAssessmentEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/dri"
              element={
                <RequireAuth>
                  <DriPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/checklist"
              element={
                <RequireAuth>
                  <ChecklistPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/patrol"
              element={
                <RequireAuth>
                  <PatrolPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/education"
              element={
                <RequireAuth>
                  <EducationPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/incidents"
              element={
                <RequireAuth>
                  <IncidentPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/reports"
              element={
                <RequireAuth>
                  <ReportsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/expiry"
              element={
                <RequireAuth>
                  <ExpiryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/hazard-library"
              element={
                <RequireAuth>
                  <HazardLibraryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/hazard-review"
              element={
                <RequireAuth>
                  <HazardReviewPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sms/master"
              element={
                <RequireAuth>
                  <MasterPage />
                </RequireAuth>
              }
            />
            {/* Catch-all for /sms root to dashboard */}
            <Route path="/sms" element={<Navigate to="/sms/dashboard" replace />} />
            {/* General Fallback */}
            <Route path="*" element={<Navigate to="/sms/dashboard" replace />} />
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
