
import '../pages/Page.css'
import { AlertTriangle } from 'lucide-react'

interface ReportContent {
    type?: string
    summary: string
    weather: string
    pms: { activeTasks: any[], totalActive: number }
    sms: { dris: any[], incidents: any[], safetyStatus: string }
    ems: { deployedCount: number, equipmentList: any[] }
    issues?: { openIncidents: any[] }
    swms?: { generations: any[], totalCount: number }
}

const getTitle = (type?: string) => {
    switch (type) {
        case 'WEEKLY': return '주간 공정 보고서';
        case 'MONTHLY': return '월간 리포트';
        case 'AD_HOC': return '수시 보고서';
        case 'ISSUE': return '이슈 보고서';
        default: return '일일 작업 보고서';
    }
}

export default function ReportViewer({ data, title }: { data: any, title?: string }) {
    const content = data as ReportContent
    if (!content || !content.pms) return <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>데이터 구조가 올바르지 않습니다.</div>

    return (
        <div className="report-paper" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '2.5rem',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#e2e8f0'
        }}>
            <div className="report-header-section">
                <h3 className="report-title">{title || getTitle(content.type)}</h3>
                <div className="report-meta-grid">
                    <div className="meta-item">
                        <span className="label">날씨</span>
                        <span className="value">{content.weather || '-'}</span>
                    </div>
                    <div className="meta-item">
                        <span className="label">안전등급</span>
                        {(() => {
                            const status = content.sms?.safetyStatus || '미집계'; // Default value handling
                            let color = '#3b82f6'; // Default Blue
                            if (status === 'SAFE') color = '#10b981'; // Green
                            else if (status === 'WARNING') color = '#f59e0b'; // Orange
                            else if (status === 'ACCIDENT') color = '#ef4444'; // Red

                            return (
                                <span style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '10px',
                                    background: `${color}1a`, // 10% opacity
                                    border: `1px solid ${color}`,
                                    boxShadow: `0 0 8px ${color}33`, // 20% opacity
                                    color: color,
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}>
                                    {status}
                                </span>
                            );
                        })()}
                    </div>
                    <div className="meta-item">
                        <span className="label">작성일</span>
                        <span className="value">{new Date().toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <hr className="divider" />

            {/* 1. Summary */}
            <div className="report-section">
                <h4>1. 금일 작업 요약</h4>
                <div className="box-text">
                    {content.summary || '요약 정보 없음'}
                </div>
            </div>

            {/* 2. PMS (공정) */}
            <div className="report-section">
                <h4>2. 공정 현황 (진행 중: {content.pms?.totalActive ?? 0}건)</h4>
                <div className="simple-table-col">
                    {content.pms?.activeTasks?.map((t, i) => {
                        const isDelay = t.delay_risk === true || t.delay_risk === 'HIGH' || t.name.includes('지연');
                        const isEarly = t.name.includes('조기');

                        const status = isDelay
                            ? { label: '지연', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
                            : isEarly
                                ? { label: '조기달성', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
                                : { label: '정상', color: '#9fb2cc', bg: 'rgba(255, 255, 255, 0.05)' }

                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                padding: '0.5rem 0'
                            }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                    <span style={{
                                        fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                                        color: status.color, background: status.bg, whiteSpace: 'nowrap', fontWeight: 500
                                    }}>
                                        {status.label}
                                    </span>
                                    <span className="task-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {t.name}
                                    </span>
                                    {isDelay && <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />}
                                </div>
                                <div className="progress-track" style={{ flex: 1, margin: '0 0.5rem 0 1rem' }}>
                                    <div className="progress-fill" style={{
                                        width: `${t.progress}%`,
                                        background: status.color
                                    }}></div>
                                </div>
                                <span className="progress-text" style={{
                                    color: status.color, fontWeight: 500, minWidth: '40px', textAlign: 'right'
                                }}>{t.progress}%</span>
                            </div>
                        )
                    })}
                    {(!content.pms?.activeTasks || content.pms.activeTasks.length === 0) && <p className="muted">진행 중인 작업 없음</p>}
                </div>
            </div>

            {/* 3. SMS & EMS Grid */}
            <div className="grid two">
                <div className="report-section">
                    <h4>3. 안전 활동</h4>
                    <ul className="dot-list">
                        <li>TBM/DRI 시행: <strong>{content.sms?.dris?.length ?? 0}건</strong></li>
                        <li>사고/이슈: <strong style={{ color: content.sms?.incidents?.length > 0 ? '#ff6b6b' : '#16c482' }}>
                            {content.sms?.incidents?.length ?? 0}건
                        </strong></li>
                        {content.issues && content.issues.openIncidents && content.issues.openIncidents.length > 0 && (
                            <li style={{ color: '#ff6b6b', marginTop: '0.5rem' }}>
                                미조치 이슈: <strong>{content.issues.openIncidents.length}건</strong>
                            </li>
                        )}
                    </ul>
                </div>

                <div className="report-section">
                    <h4>4. 자원 및 폐기물 현황</h4>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="stats-box" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span className="label" style={{ display: 'block', fontSize: '0.85rem', color: '#9fb2cc', marginBottom: '0.5rem' }}>투입 장비</span>
                            <span className="value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: '#4ea1ff' }}>{content.ems?.deployedCount ?? 0} <span style={{ fontSize: '0.9rem' }}>대</span></span>
                        </div>
                        <div className="stats-box" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span className="label" style={{ display: 'block', fontSize: '0.85rem', color: '#9fb2cc', marginBottom: '0.5rem' }}>폐기물 발생</span>
                            <span className="value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{content.swms?.totalCount ?? 0} <span style={{ fontSize: '0.9rem' }}>건</span></span>
                        </div>
                    </div>

                    <div className="tag-row">
                        {content.ems?.equipmentList?.slice(0, 5).map((e: any, i: number) => (
                            <span key={i} className="badge badge-tag">{e.name}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="report-footer">
                <p>위와 같이 금일 작업을 보고합니다.</p>
                <div className="signature-box">
                    <span>현장대리인: (인)</span>
                    <span>공사감독관: (인)</span>
                </div>
            </div>
        </div>
    )
}
