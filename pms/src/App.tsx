import { Suspense, lazy, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  CalendarRange,
  Users,
  Receipt,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import './App.css'
import Spinner from './components/Spinner'
import { ProjectProvider } from './context/ProjectContext'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import ProjectSwitcher from './components/ProjectSwitcher'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/Login'

function getPortalHomeUrl() {
  // Production hosting routes portal at root (/).
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
    } catch {
      // ignore
    }
  }

  return `${window.location.origin}/`
}


const ContractsPage = lazy(() => import('./pages/Contracts'))
const DocumentsPage = lazy(() => import('./pages/Documents'))
const OverviewPage = lazy(() => import('./pages/Overview'))
const ProjectsPage = lazy(() => import('./pages/Projects'))
const ReportsPage = lazy(() => import('./pages/Reports'))
const ResourcesPage = lazy(() => import('./pages/Resources'))
const SchedulePage = lazy(() => import('./pages/Schedule'))
const MembersPage = lazy(() => import('./pages/Members'))
const SignupPage = lazy(() => import('./pages/Signup'))

// 상단바에 메뉴가 늘어 좌측 사이드바로 옮겼다.
// 기존 메뉴는 하나도 빼지 않았고 위치와 묶음만 바뀐다.
const navGroups = [
  {
    label: '',
    items: [
      { path: '/overview', label: '대시보드', icon: LayoutDashboard },
    ],
  },
  {
    label: '프로젝트',
    items: [
      { path: '/projects', label: '프로젝트', icon: FolderKanban },
      { path: '/schedule', label: '일정(WBS)', icon: CalendarRange },
      { path: '/resources', label: '자원', icon: Users },
      { path: '/contracts', label: '계약/견적', icon: Receipt },
    ],
  },
  {
    label: '문서·보고',
    items: [
      { path: '/documents', label: '문서관리', icon: FileText },
      { path: '/reports', label: '보고서', icon: LayoutDashboard },
    ],
  },
  {
    label: '설정',
    items: [
      { path: '/members', label: '시스템관리', icon: Settings },
    ],
  },
]

function Sidebar() {
  // 접힘 상태는 사람마다 취향이 갈려 브라우저에 남긴다.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('pms.sidebar.collapsed') === '1'
  )

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('pms.sidebar.collapsed', v ? '0' : '1')
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



function App() {
  const { user, signOut } = useAuth()
  const logoSrc = `${import.meta.env.BASE_URL}images/cross-logo.png`
  return (
    <ToastProvider>
      <ProjectProvider>
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
                    <strong className="brand-title">프로젝트 관리시스템(PMS)</strong>
                  </div>
                </a>
              </div>
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

          {user && <Sidebar />}

          <main className={`content ${user ? '' : 'content-full'}`}>
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
