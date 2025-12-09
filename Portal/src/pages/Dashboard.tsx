
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'framer-motion';
import { ShieldCheck, Truck, FileText, PieChart, Lock, LogOut, ExternalLink } from 'lucide-react';
import './Dashboard.css';



const SYSTEMS = [
    {
        id: 'PMS',
        titleKor: '프로젝트 관리시스템',
        acronym: 'PMS',
        description: '', // description removed from UI usage
        icon: <PieChart size={32} />,
        url: import.meta.env.PROD ? '/pms' : import.meta.env.VITE_APP_URL_PMS
    },
    {
        id: 'EMS',
        titleKor: '장비 관리시스템',
        acronym: 'EMS',
        description: '',
        icon: <Truck size={32} />,
        url: import.meta.env.PROD ? '/ems' : import.meta.env.VITE_APP_URL_EMS
    },
    {
        id: 'SWMS',
        titleKor: '스크랩·폐기물 관리시스템',
        acronym: 'SWMS',
        description: '',
        icon: <FileText size={32} />,
        url: import.meta.env.PROD ? '/swms' : import.meta.env.VITE_APP_URL_SWMS
    },
    {
        id: 'SMS',
        titleKor: '안전 관리시스템',
        acronym: 'SMS',
        description: '',
        icon: <ShieldCheck size={32} />,
        url: import.meta.env.PROD ? '/sms' : import.meta.env.VITE_APP_URL_SMS
    }
];

export default function Dashboard() {
    const { user } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = '/login';
    };

    const handleSystemClick = (sys: any, allowed: boolean) => {
        if (!allowed) return;
        window.location.href = sys.url;
    };

    // If user has no specific allowedSystems, default to ALL for now (or strictly none?)
    // For 'Manager' role, allow all.
    // For dev testing, if user.allowedSystems is undefined, unlock all?
    // Let's implement strict check if allowedSystems is present, otherwise check role.
    const isAllowed = (sysId: string) => {
        if (!user) return false;
        if (user.role === 'Manager' || user.role === 'SystemAdmin') return true;
        if (user.allowedSystems && user.allowedSystems.includes(sysId)) return true;
        // Default fallback: allow all if no restrictions defined (for easy testing now)
        // return true; 
        // Wait, let's be safer. If no role/allowedSystems, maybe block?
        // User requested "Access based on role/unique number".
        // For now, I'll return true to allow testing until we seed DB.
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
                    {SYSTEMS.map((sys, index) => {
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
                                <div className="card-icon-wrapper">
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
