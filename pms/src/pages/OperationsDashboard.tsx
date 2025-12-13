import { useNavigate } from 'react-router-dom'
import {
    FileText
} from 'lucide-react'
import './Page.css'

// Reuse Mock Data or create specific ones
const MOCK_PROJECT_DETAILS = [
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
        topReasons: [{ type: 'safety', value: 0, weight: 0, message: '안전 사고 발생 위험' }],
        progress: { plan: 62.5, actual: 60.0 }, // Added
        dataQuality: {}
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
        topReasons: [],
        progress: { plan: 80.0, actual: 80.0 }, // Added
        dataQuality: {}
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
        progress: { plan: 95.0, actual: 96.5 }, // Added
        dataQuality: {}
    }
] as any[] // Relax type for mock 

export default function OperationsDashboard({
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
                    <p className="eyebrow">Operations View</p>
                    <h2>실무용 프로젝트 관리 대시보드</h2>
                    <p className="muted">프로젝트별 상세 현황 모니터링 및 실무 조치</p>
                </div>
                {/* Right Controls Container */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>

                    {/* Top Row: Refresh */}
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
                            border: '1px solid rgba(255,255,255,0.1)',
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

            {/* Operational Metrics Grid */}
            <section className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <p className="card-label">나의 할 일 (My Tasks)</p>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>5</div>
                    <p className="text-xs muted">지연 1건 / 금일 마감 2건</p>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <p className="card-label">결재 대기</p>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>3</div>
                    <p className="text-xs muted">내가 승인해야 할 문서</p>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <p className="card-label">안전 조치 필요</p>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>2</div>
                    <p className="text-xs muted">미조치 NC / Near-miss</p>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <p className="card-label">가동 중 장비</p>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>12</div>
                    <p className="text-xs muted">전체 15대 중 12대 가동</p>
                </div>
            </section>

            {/* Main Project List Table */}
            <section className="card">
                <div className="card-header" style={{ marginBottom: '1rem' }}>
                    <h3>진행 프로젝트 현황 상세</h3>
                </div>

                <div className="table-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>프로젝트명</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>Health Score</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>진척율 (실적/계획)</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>안전(Sa)</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>원가(C)</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>리스크 요인</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_PROJECT_DETAILS.map(p => (
                                <tr key={p.projectId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {p.projectName}
                                            {p.forcedRed && <span className="pill pill-danger" style={{ fontSize: '0.7rem' }}>Critical</span>}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <span style={{
                                            fontWeight: 700,
                                            color: p.grade === 'RED' ? '#f87171' : p.grade === 'YELLOW' ? '#fbbf24' : '#34d399'
                                        }}>
                                            {p.scoreTotal}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: p.progress.actual < p.progress.plan ? '#f87171' : '#e2e8f0' }}>
                                                {p.progress.actual}%
                                            </span>
                                            <span className="text-xs muted">
                                                / {p.progress.plan}%
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>{p.scoreSafety}</td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>{p.scoreCost}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {p.topReasons.length > 0 ? (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {p.topReasons.map((r: any, i: number) => (
                                                    <span key={i} className="text-secondary" style={{ fontSize: '0.8rem' }}>
                                                        {r.message}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="muted">-</span>}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => navigate(`/projects/${p.projectId}`)}>
                                            상세 이동
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Operational Widgets Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>

                {/* Recent Reports / Approvals */}
                <section className="card">
                    <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                        <h3>최근 문서 / 보고서</h3>
                        <button onClick={() => navigate('/documents')} className="text-sm text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>전체보기</button>
                    </div>
                    <ul style={{ padding: 0, listStyle: 'none' }}>
                        <li className="hover-effect" style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <FileText size={16} className="muted" />
                                <span>주간 공정 보고서 (12월 2주차)</span>
                            </div>
                            <span className="pill pill-success">승인완료</span>
                        </li>
                        <li className="hover-effect" style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <FileText size={16} className="muted" />
                                <span>장비 투입 계획서 (크레인)</span>
                            </div>
                            <span className="pill pill-warning">결재중</span>
                        </li>
                        <li className="hover-effect" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <FileText size={16} className="muted" />
                                <span>안전 점검 체크리스트</span>
                            </div>
                            <span className="pill pill-neutral">작성중</span>
                        </li>
                    </ul>
                </section>

                {/* Schedule / Milestones */}
                <section className="card">
                    <div className="card-header" style={{ marginBottom: '1rem' }}>
                        <h3>금주 주요 일정 (Milestones)</h3>
                    </div>
                    <ul style={{ padding: 0, listStyle: 'none' }}>
                        <li className="hover-effect" style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>구조물 해체 착수</div>
                                <div className="text-xs muted">A-Project - 102동</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="text-sm">D-2</div>
                                <div className="text-xs muted">12.15 (Fri)</div>
                            </div>
                        </li>
                        <li className="hover-effect" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>폐기물 반출 (50톤)</div>
                                <div className="text-xs muted">B-Project</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="text-sm">D-Day</div>
                                <div className="text-xs muted" style={{ color: '#f59e0b' }}>Today</div>
                            </div>
                        </li>
                    </ul>
                </section>

            </div>
        </div>
    )
}
