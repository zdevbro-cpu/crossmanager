import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/ToastProvider'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/Login'
import EquipmentListPage from './pages/EquipmentList'
import EquipmentDetailPage from './pages/EquipmentDetail'
import { useState } from 'react'
import {
  LogOut, Wrench, ClipboardList, ShieldCheck, BarChart3,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import './App.css'
import './index.css'

// 상단 메뉴를 좌측 사이드바로 옮겼다. 메뉴는 그대로이고 위치만 바뀐다.
const navGroups = [
  {
    label: '',
    items: [
      { path: '/equipment', label: '장비 목록', icon: Wrench },
    ],
  },
  {
    label: '이력·점검',
    items: [
      { path: '/maintenance', label: '정비 이력', icon: ClipboardList },
      { path: '/inspection', label: '검사 관리', icon: ShieldCheck },
    ],
  },
  {
    label: '분석',
    items: [
      { path: '/analytics', label: '분석', icon: BarChart3 },
    ],
  },
]

function Sidebar() {
  // 접힘 상태는 사람마다 취향이 갈려 브라우저에 남긴다.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('ems.sidebar.collapsed') === '1'
  )

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('ems.sidebar.collapsed', v ? '0' : '1')
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

      {user && <Sidebar />}

      <main className={`content ${user ? '' : 'content-full'}`}>
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
