import { useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    DollarSign,
    Clock,
    Activity,
    AlertCircle,
    ArrowRight
} from 'lucide-react'
import './Page.css' // Reusing existing styles where possible
import type { HealthScore, DashboardAlert, DashboardSummary } from '../types/dashboard'

// Mock Data
const MOCK_SUMMARY: DashboardSummary = {
    riskCount: 2,
    delayCount: 1,
    lossRiskCount: 1,
    totalProjects: 12,
    projectsByGrade: {
        GREEN: 5,
        YELLOW: 4,
        ORANGE: 2,
        RED: 1
    }
}

const MOCK_HEALTH_SCORES: HealthScore[] = [
    {
        projectId: 'p1',
        projectName: 'A-Project (Plant Construction)',
        calcDate: '2025-12-13',
        scoreTotal: 45,
        scoreSchedule: 60,
        scoreSafety: 40,
        scoreCost: 50,
        scoreResource: 70,
        scoreQuality: 80,
        grade: 'RED',
        forcedRed: true,
        topReasons: [
            { type: 'safety_nc', value: 3, weight: 8, message: '미조치 NC 3건' },
            { type: 'schedule_delay', value: 15, weight: 15, message: '크리티컬 공정 2주 지연' }
        ],
        dataQuality: { safety: 'ok', schedule: 'ok' }
    },
    {
        projectId: 'p2',
        projectName: 'B-Project (Decommissioning)',
        calcDate: '2025-12-13',
        scoreTotal: 72,
        scoreSchedule: 80,
        scoreSafety: 90,
        scoreCost: 60,
        scoreResource: 65,
        scoreQuality: 90,
        grade: 'YELLOW',
        forcedRed: false,
        topReasons: [
            { type: 'cost_overrun', value: 5, weight: 5, message: '원가 초과율 5%' }
        ],
        dataQuality: { cost: 'ok' }
    },
    {
        projectId: 'p3',
        projectName: 'C-Project (Maintenance)',
        calcDate: '2025-12-13',
        scoreTotal: 92,
        scoreSchedule: 95,
        scoreSafety: 95,
        scoreCost: 90,
        scoreResource: 90,
        scoreQuality: 95,
        grade: 'GREEN',
        forcedRed: false,
        topReasons: [],
        dataQuality: { all: 'ok' }
    }
]

const MOCK_ALERTS: DashboardAlert[] = [
    {
        id: 'a1',
        projectId: 'p1',
        projectName: 'A-Project',
        alertType: 'approval_pending',
        title: '실행예산 변경 승인 요청',
        detail: '총액 5% 증액 (원가 상승분 반영)',
        status: 'open',
        severity: 'warn',
        createdAt: '2025-12-13T09:00:00Z'
    },
    {
        id: 'a2',
        projectId: 'p1',
        projectName: 'A-Project',
        alertType: 'safety_nc',
        title: '중대재해 위험요인 방치',
        detail: '고소작업대 안전난간 미설치 (3일 경과)',
        status: 'open',
        severity: 'critical',
        createdAt: '2025-12-12T15:30:00Z'
    }
]

const GradeBadge = ({ grade }: { grade: string }) => {
    const colors = {
        GREEN: { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
        YELLOW: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' },
        ORANGE: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fdba74' },
        RED: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' }
    }
    const color = colors[grade as keyof typeof colors] || colors.GREEN

    return (
        <span style={{
            backgroundColor: color.bg,
            color: color.text,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600
        }}>
            {grade}
        </span>
    )
}

export default function ExecutiveDashboard({
    viewMode,
    onViewChange
}: {
    viewMode?: 'executive' | 'operations',
    onViewChange?: (mode: 'executive' | 'operations') => void
}) {
    const navigate = useNavigate()

    return (
        <div className="page fade-in">
            <header className="section-header">
                <div>
                    <p className="eyebrow">Executive View</p>
                    <h2>임원용 통합 대시보드</h2>
                    <p className="muted">전사 프로젝트 리스크 및 주요 의사결정 항목 요약</p>
                </div>

                {/* Right Controls Container */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>

                    {/* Top Row: Last Update & Refresh */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button className="btn-secondary" onClick={() => window.location.reload()}>
                            새로고침
                        </button>
                    </div>

                    {/* Bottom Row: View Toggle */}
                    {onViewChange && (
                        <div style={{
                            display: 'flex',
                            background: 'rgba(15, 23, 42, 0.8)',
                            borderRadius: '6px',
                            padding: '2px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <button
                                onClick={() => onViewChange('executive')}
                                style={{
                                    background: viewMode === 'executive' ? '#3b82f6' : 'transparent',
                                    color: viewMode === 'executive' ? 'white' : '#94a3b8',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Executive
                            </button>
                            <button
                                onClick={() => onViewChange('operations')}
                                style={{
                                    background: viewMode === 'operations' ? '#3b82f6' : 'transparent',
                                    color: viewMode === 'operations' ? 'white' : '#94a3b8',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Operations
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* 1. Top Summary Bar */}
            <section className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f87171' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="muted text-sm">위험 (Critical)</p>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{MOCK_SUMMARY.riskCount} <span className="text-sm muted" style={{ fontWeight: 400 }}>건</span></div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #fbbf24' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="muted text-sm">지연 (Delay)</p>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{MOCK_SUMMARY.delayCount} <span className="text-sm muted" style={{ fontWeight: 400 }}>건</span></div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #a855f7' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="muted text-sm">손실 예상</p>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{MOCK_SUMMARY.lossRiskCount} <span className="text-sm muted" style={{ fontWeight: 400 }}>건</span></div>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="muted text-sm">전체 프로젝트</p>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{MOCK_SUMMARY.totalProjects}</div>
                    </div>
                </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

                {/* Left Column: Health Index */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Project Health Section */}
                    <section className="card">
                        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                            <h3>Project Health Top Alerts</h3>
                            <button onClick={() => navigate('/projects')} className="text-sm text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>전체 보기 &rarr;</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {MOCK_HEALTH_SCORES.map(score => (
                                <div key={score.projectId} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.5rem',
                                    cursor: 'pointer'
                                }}
                                    onClick={() => navigate(`/projects/${score.projectId}`)}
                                >
                                    {/* Score Circle */}
                                    <div style={{
                                        width: '60px', height: '60px',
                                        borderRadius: '50%',
                                        border: `4px solid ${score.grade === 'RED' ? '#ef4444' : score.grade === 'YELLOW' ? '#fbbf24' : '#34d399'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem', fontWeight: 800,
                                        flexShrink: 0
                                    }}>
                                        {score.scoreTotal}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{score.projectName}</h4>
                                            <GradeBadge grade={score.grade} />
                                        </div>

                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', gap: '1rem' }}>
                                            <span>Schedule {score.scoreSchedule}</span>
                                            <span>Safety {score.scoreSafety}</span>
                                            <span>Cost {score.scoreCost}</span>
                                            <span>Resource {score.scoreResource}</span>
                                        </div>

                                        {/* Top Reasons */}
                                        {score.topReasons.length > 0 ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {score.topReasons.map((reason, idx) => (
                                                    <span key={idx} style={{
                                                        background: 'rgba(30, 41, 59, 0.6)',
                                                        fontSize: '0.8rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        color: '#e2e8f0',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        ⚠️ {reason.message}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.8rem', color: '#34d399' }}>✓ 특이사항 없음</div>
                                        )}
                                    </div>

                                    <button
                                        className="icon-button"
                                        style={{ color: '#94a3b8', cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/projects/${score.projectId}`);
                                        }}
                                    >
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Safety & Cost Charts Placeholder */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <section className="card">
                            <h3>안전 리스크 Top 3</h3>
                            <div style={{ marginTop: '1rem', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                <p className="muted">Chart: Safety Incidents Trend</p>
                            </div>
                        </section>
                        <section className="card">
                            <h3>원가/수익 현황</h3>
                            <div style={{ marginTop: '1rem', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                <p className="muted">Chart: Cost vs Budget</p>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Right Column: Actions & Alerts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Action Required */}
                    <section className="card" style={{ borderColor: '#f59e0b' }}>
                        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={20} color="#fbbf24" />
                            <h3 style={{ margin: 0, color: '#fbbf24' }}>의사결정 필요 (Action)</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {MOCK_ALERTS.map(alert => (
                                <div key={alert.id} className="hover-effect" style={{
                                    padding: '1rem',
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    borderRadius: '6px',
                                    borderLeft: `3px solid ${alert.severity === 'critical' ? '#ef4444' : '#fbbf24'}`,
                                    cursor: 'pointer'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <span className="text-secondary text-xs" style={{ fontWeight: 600 }}>{alert.projectName}</span>
                                        <span className="text-xs muted">{new Date(alert.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{alert.title}</div>
                                    <div className="text-sm muted">{alert.detail}</div>
                                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', height: 'auto' }}>
                                            검토
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Quick Stats or Additional Info */}
                    <section className="card">
                        <h3>Data Quality</h3>
                        <ul style={{ padding: 0, listStyle: 'none', marginTop: '1rem', fontSize: '0.9rem' }}>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                                <span className="muted">데이터 수집률</span>
                                <span style={{ color: '#34d399' }}>98%</span>
                            </li>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                                <span className="muted">스케줄 업데이트</span>
                                <span style={{ color: '#fbbf24' }}>4시간 전</span>
                            </li>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                                <span className="muted">안전 리포트</span>
                                <span style={{ color: '#34d399' }}>실시간</span>
                            </li>
                        </ul>
                    </section>

                </div>
            </div>
        </div>
    )
}
