import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Package, Scale, TrendingUp, TrendingDown, Warehouse, Wallet, BarChart3, FileText, LogOut, MapPin, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { SiteProvider, useSite } from './contexts/SiteContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import RequireAuth from './components/RequireAuth'
import Spinner from './components/Spinner'

// Pages
import DashboardOperations from './pages/DashboardOperations'
import DashboardExecutive from './pages/DashboardExecutive'
import GenerationPage from './pages/Generation'
import WeighingPage from './pages/Weighing'
import InboundPage from './pages/Inbound'
import OutboundPage from './pages/Outbound'
import InventoryPage from './pages/Inventory'
import SettlementPage from './pages/Settlement'
import ReportsPage from './pages/Reports'
import SalesPage from './pages/Sales'
import LoginPage from './pages/Login'

import './index.css'
import './App.css'

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

// 상단 메뉴를 좌측 사이드바로 옮겼다. 메뉴는 그대로이고 위치와 묶음만 바뀐다.
const navGroups = [
    {
        label: '',
        items: [
            { path: '/', icon: BarChart3, label: '대시보드' },
        ],
    },
    {
        label: '물류',
        items: [
            { path: '/generation', icon: Package, label: '발생 관리' },
            { path: '/weighing', icon: Scale, label: '계근 관리' },
            { path: '/inbound', icon: TrendingDown, label: '입고 관리' },
            { path: '/outbound', icon: TrendingUp, label: '출고 관리' },
            { path: '/inventory', icon: Warehouse, label: '재고 관리' },
        ],
    },
    {
        label: '정산',
        items: [
            { path: '/sales', icon: Wallet, label: '매각 관리' },
            { path: '/settlement', icon: FileText, label: '정산 관리' },
        ],
    },
    {
        label: '분석',
        items: [
            { path: '/reports', icon: BarChart3, label: '분석·리포트' },
        ],
    },
]

function Sidebar() {
    // 접힘 상태는 사람마다 취향이 갈려 브라우저에 남긴다.
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem('swms.sidebar.collapsed') === '1'
    )

    const toggle = () => {
        setCollapsed((v) => {
            localStorage.setItem('swms.sidebar.collapsed', v ? '0' : '1')
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
    const { currentSite, sites, setCurrentSite, loading: siteLoading } = useSite()
    const logoSrc = `${import.meta.env.BASE_URL}images/cross-logo.png`

    if (loading || siteLoading) return <Spinner />

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
                                    <strong className="brand-title">스크랩·폐기물 관리시스템(SWMS)</strong>
                                </div>
                            </a>
                        </div>
                    </div>

                    <div className="header-actions">
                        {user && currentSite && (
                            <div style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={18} className="text-primary" />
                                <select
                                    className="input"
                                    value={currentSite.id}
                                    onChange={(e) => {
                                        const site = sites.find(s => s.id === e.target.value)
                                        if (site) setCurrentSite(site)
                                    }}
                                    style={{
                                        minWidth: '240px',
                                        fontWeight: 'bold',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        color: '#60a5fa'
                                    }}
                                >
                                    {sites.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
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
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/" element={<RequireAuth><DashboardOperations /></RequireAuth>} />
                        <Route path="/dashboard/executive" element={<RequireAuth><DashboardExecutive /></RequireAuth>} />
                        <Route path="/generation" element={<RequireAuth><GenerationPage /></RequireAuth>} />
                        <Route path="/weighing" element={<RequireAuth><WeighingPage /></RequireAuth>} />
                        <Route path="/inbound" element={<RequireAuth><InboundPage /></RequireAuth>} />
                        <Route path="/outbound" element={<RequireAuth><OutboundPage /></RequireAuth>} />
                        <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
                        <Route path="/sales" element={<RequireAuth><SalesPage /></RequireAuth>} />
                        <Route path="/settlement" element={<RequireAuth><SettlementPage /></RequireAuth>} />
                        <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
                    </Routes>
                </main>
                <ToastViewport />
            </div>
        </ToastProvider>
    )
}

export default function App() {
    return (
        <ProjectProvider>
            <SiteProvider>
                <AppShell />
            </SiteProvider>
        </ProjectProvider>
    )
}
