
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'framer-motion';
import { ShieldCheck, Truck, FileText, PieChart, Lock, LogOut, ExternalLink, Folder } from 'lucide-react';
import './Dashboard.css';



// 화면에 나오는 순서는 이 배열 순서를 따른다. PMS → DMS → SMS → EMS.
// SWMS 는 접근 제한이라 화면에 나오지 않으므로 맨 뒤에 둔다.
const SYSTEMS = [
    {
        id: 'PMS',
        titleKor: '프로젝트 관리시스템',
        acronym: 'PMS',
        description: '', // description removed from UI usage
        icon: <PieChart size={32} />,
        accent: '#fb923c',        // 밝은 주황 — 프로젝트
        url: import.meta.env.PROD ? '/pms' : import.meta.env.VITE_APP_URL_PMS
    },
    {
        id: 'DMS',
        titleKor: '통합 문서관리시스템',
        acronym: 'DMS',
        description: '',
        icon: <Folder size={32} />,
        accent: '#34d399',        // 초록 — 문서
        url: import.meta.env.PROD ? '/dms' : import.meta.env.VITE_APP_URL_DMS
    },
    {
        id: 'SMS',
        titleKor: '안전 관리시스템',
        acronym: 'SMS',
        description: '',
        icon: <ShieldCheck size={32} />,
        accent: '#fbbf24',        // 주황 — 안전
        url: import.meta.env.PROD ? '/sms' : import.meta.env.VITE_APP_URL_SMS
    },
    {
        id: 'EMS',
        titleKor: '장비 관리시스템',
        acronym: 'EMS',
        description: '',
        icon: <Truck size={32} />,
        accent: '#a78bfa',        // 보라 — 장비
        url: import.meta.env.PROD ? '/ems' : import.meta.env.VITE_APP_URL_EMS
    },
    {
        id: 'SWMS',
        titleKor: '스크랩·폐기물 관리시스템',
        acronym: 'SWMS',
        description: '',
        icon: <FileText size={32} />,
        accent: '#22d3ee',        // 청록 — 스크랩·폐기물
        url: import.meta.env.PROD ? '/swms' : import.meta.env.VITE_APP_URL_SWMS
    }
];

// 결정이 날 때까지 화면에 내보내지 않는 모듈.
// SWMS 는 원방업무관리를 그대로 쓸지 통합할지 정해지지 않았다.
// 정해지면 이 배열을 비우면 바로 되살아난다. 카드 정의는 그대로 남겨 둔다.
const RESTRICTED_SYSTEMS: string[] = ['SWMS'];

export default function Dashboard() {
    const { user } = useAuth();
    const visibleSystems = SYSTEMS.filter((s) => !RESTRICTED_SYSTEMS.includes(s.id));

    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = '/login';
    };

    const handleSystemClick = (sys: any, allowed: boolean) => {
        if (!allowed) return;

        let targetUrl = sys.url;
        // Simple SSO mechanism: pass user info via query param
        // In production, use shared cookies or a proper SSO token exchange
        if (user) {
            const userInfo = encodeURIComponent(JSON.stringify({
                uid: user.uid,
                email: user.email,
                name: user.name, // ensure these fields exist on user object
                role: user.role
            }));
            const separator = targetUrl.includes('?') ? '&' : '?';
            targetUrl += `${separator}sso_user=${userInfo}`;
        }

        window.location.href = targetUrl;
    };

    // If user has no specific allowedSystems, default to ALL for now (or strictly none?)
    // For 'Manager' role, allow all.
    // For dev testing, if user.allowedSystems is undefined, unlock all?
    // Let's implement strict check if allowedSystems is present, otherwise check role.
    const isAllowed = (sysId: string) => {
        // 결정이 날 때까지 막아 두는 모듈.
        // SWMS 는 원방업무관리를 그대로 쓸지 통합할지 정해지지 않았다.
        // 정해지면 이 목록에서 빼면 바로 열린다.
        if (RESTRICTED_SYSTEMS.includes(sysId)) return false;

        // ALWAYS ALLOW DMS FOR EVERYONE (DEBUGGING / TEMP FIX)
        if (sysId === 'DMS') return true;

        if (!user) return false;
        if (user.role === 'Manager' || user.role === 'SystemAdmin') return true;
        if (user.allowedSystems && user.allowedSystems.includes(sysId)) return true;

        // Default allow for now to prevent lockout during dev
        return true;
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>Cross Manager Portal</h1>
                    <span className="user-badge">
                        {user?.name || user?.email} <span className="role-tag">{user?.role || 'User'}</span>
                    </span>
                </div>
                <button onClick={handleLogout} className="logout-button">
                    <LogOut size={18} />
                    Sign Out
                </button>
            </header>

            <main className="dashboard-content">
                <div className="welcome-banner">
                    <h2>
                        {(() => {
                            const displayName = (user?.name || '').trim() || '사용자'
                            return `Welcome back, ${displayName} 님`
                        })()}
                    </h2>
                    <p>Select a system to continue your work.</p>
                </div>

                <div className="system-grid">
                    {visibleSystems.map((sys, index) => {
                        const allowed = isAllowed(sys.id);
                        return (
                            <motion.div
                                key={sys.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`system-card ${allowed ? 'allowed' : 'locked'}`}
                                onClick={() => handleSystemClick(sys, allowed)}
                            >
                                <div
                                    className="card-icon-wrapper"
                                    style={allowed ? {
                                        color: sys.accent,
                                        // 배경은 같은 색을 옅게 깔아 아이콘만 튀지 않게 한다.
                                        background: `${sys.accent}1f`,
                                    } : undefined}
                                >
                                    {sys.icon}
                                </div>
                                <div className="card-info">
                                    <h3>{sys.titleKor}</h3>
                                    <p className="sys-acronym">{sys.acronym}</p>
                                </div>
                                <div className="card-status">
                                    {allowed ? <ExternalLink size={20} /> : <Lock size={20} />}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
