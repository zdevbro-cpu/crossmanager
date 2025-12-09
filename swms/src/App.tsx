import { Routes, Route, NavLink } from 'react-router-dom'
import { Package, Scale, TrendingUp, TrendingDown, Warehouse, Wallet, BarChart3, FileText, LogOut, MapPin } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { SiteProvider, useSite } from './contexts/SiteContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ToastProvider, ToastViewport } from './components/ToastProvider'
import RequireAuth from './components/RequireAuth'
import Spinner from './components/Spinner'

// Pages
import DashboardPage from './pages/Dashboard'
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

function AppShell() {
    const { user, loading, signOut } = useAuth()
    const { currentSite, sites, setCurrentSite, loading: siteLoading } = useSite()

    if (loading || siteLoading) return <Spinner />

    const navItems = [
        { path: '/', icon: BarChart3, label: '대시보드' },
        { path: '/generation', icon: Package, label: '발생 관리' },
        { path: '/weighing', icon: Scale, label: '계근 관리' },
        { path: '/inbound', icon: TrendingDown, label: '입고 관리' },
        { path: '/outbound', icon: TrendingUp, label: '출고 관리' },
        { path: '/inventory', icon: Warehouse, label: '재고 관리' },
        { path: '/sales', icon: Wallet, label: '매각 관리' },
        { path: '/settlement', icon: FileText, label: '정산 관리' },
        { path: '/reports', icon: BarChart3, label: '분석·리포트' }
    ]

    return (
        <ToastProvider>
            <div className="app-shell">
                <header className="topbar">
                    <div className="brand-group">
                        <div className="brand">
                            <img src="images/cross-logo.png" alt="Cross 로고" className="brand-logo" />
                            <div className="brand-text">
                                <p className="brand-label">Cross Specialness Inc.</p>
                                <strong className="brand-title">스크랩·폐기물 관리시스템(SWMS)</strong>
                            </div>
                        </div>
                    </div>

                    {user && (
                        <div className="nav-container">
                            <nav className="main-nav">
                                {navItems.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                        >
                                            <Icon size={18} /> <span>{item.label}</span>
                                        </NavLink>
                                    )
                                })}
                            </nav>
                        </div>
                    )}

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
                                            {s.company_name ? `${s.company_name} - ${s.name}` : s.name}
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
                        <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
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

