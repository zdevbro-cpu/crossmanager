
import axios from 'axios'
import '../pages/Page.css'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface ReportContent {
    type?: string
    summary: string
    weather: string
    pms: { activeTasks: any[], totalActive: number }
    sms: { dris: any[], incidents: any[], safetyStatus: string }
    ems: { deployedCount: number, equipmentList: any[], utilization?: number }
    issues?: { openIncidents: any[] }
    swms?: { generations: any[], totalCount: number, revenue?: number }
}

interface ReportEditorProps {
    content: ReportContent
    title?: string
    projectId?: string
    onChange: (newContent: ReportContent) => void
}

export default function ReportEditor({ content, title, onChange, projectId }: ReportEditorProps) {
    const handleChange = (field: string, value: any) => {
        onChange({ ...content, [field]: value })
    }

    const handleImportData = async () => {
        if (!confirm('최신 모듈 데이터를 가져와서 덮어쓰시겠습니까?')) return;

        const pid = projectId || 'p1';

        try {
            // Fetch from all modules
            const [smsRes, emsRes, swmsRes] = await Promise.all([
                axios.get(`/api/sms/checklists/summary?project_id=${pid}`),
                axios.get(`/api/ems/summary?project_id=${pid}`),
                axios.get(`/api/swms/summary?project_id=${pid}`)
            ]);

            const smsData = smsRes.data;
            const emsData = emsRes.data;
            const swmsData = swmsRes.data;

            // Map to existing Content Structure
            const newContent = {
                ...content,
                sms: {
                    ...content.sms,
                    dris: new Array(smsData.checklist_summary.total).fill({}), // Mock array length
                    incidents: new Array(smsData.incident_count.accident + smsData.incident_count.near_miss).fill({}),
                    safetyStatus: smsData.safety_compliance_rate > 90 ? 'SAFE' : 'WARNING'
                },
                ems: {
                    ...content.ems,
                    deployedCount: emsData.active_equipment_count,
                    utilization: emsData.utilization_rate
                },
                swms: {
                    generations: content.swms?.generations || [],
                    totalCount: Math.round(swmsData.total_outbound_weight),
                    revenue: swmsData.revenue_estimated
                }
            };

            onChange(newContent);
            alert('데이터 동기화 완료');

        } catch (e) {
            console.error(e);
            alert('데이터 가져오기 실패');
        }
    }

    if (!content) return <div>No Data</div>

    return (
        <div className="report-paper warning-border">
            <div className="report-header-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h3 className="report-title">{title || '보고서 수정'}</h3>
                    <button className="btn-secondary small" onClick={handleImportData}>
                        <RefreshCcw size={14} style={{ marginRight: '6px' }} /> 데이터 동기화
                    </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', marginTop: '2rem', marginBottom: '1.5rem' }}>
                    {/* Weather (Editable) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>날씨</span>
                        <input
                            type="text"
                            className="input-std"
                            style={{
                                width: '140px', textAlign: 'center', height: '36px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#e2e8f0', borderRadius: '8px'
                            }}
                            value={content.weather}
                            onChange={(e) => handleChange('weather', e.target.value)}
                        />
                    </div>
                    {/* Safety Status (Display Only) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>안전등급</span>
                        {(() => {
                            const status = content.sms?.safetyStatus || '미집계'
                            let color = '#3b82f6'
                            if (status === 'SAFE') color = '#10b981'
                            else if (status === 'WARNING') color = '#f59e0b'
                            else if (status === 'ACCIDENT') color = '#ef4444'
                            return (
                                <span style={{
                                    padding: '0.2rem 0.8rem', borderRadius: '8px',
                                    border: `1px solid ${color}`, color: color,
                                    fontSize: '1rem', fontWeight: 600,
                                    background: `${color}10`,
                                    height: '36px', display: 'flex', alignItems: 'center',
                                    boxShadow: `0 0 10px ${color}20`
                                }}>
                                    {status}
                                </span>
                            )
                        })()}
                    </div>
                    {/* Date (Display Only) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>작성일</span>
                        <span style={{
                            fontSize: '1.1rem', fontWeight: 500, color: '#e2e8f0',
                            height: '36px', display: 'flex', alignItems: 'center'
                        }}>
                            {new Date().toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            <hr className="divider" />

            {/* 1. Summary */}
            <div className="report-section">
                <h4>1. 금일 작업 요약</h4>
                <textarea
                    className="input-std"
                    style={{ width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.2)' }}
                    value={content.summary}
                    onChange={(e) => handleChange('summary', e.target.value)}
                />
            </div>

            {/* 2. PMS (Read-Only) */}
            <div className="report-section">
                <h4>2. 공정 현황 (자동 집계 데이터)</h4>
                <div className="box-text muted" style={{ marginBottom: '1rem' }}>
                    공정 데이터는 PMS에서 자동 연동되므로 수정할 수 없습니다.
                </div>
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

            {/* 3. SMS & EMS */}
            <div className="grid two">
                <div className="report-section">
                    <h4>3. 안전 활동 (자동 집계)</h4>
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
                    <h4>4. 자원 및 폐기물 현황 (자동 집계)</h4>
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
                </div>
            </div>
        </div>
    )
}
