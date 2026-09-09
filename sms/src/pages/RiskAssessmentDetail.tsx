
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Calendar, User, FileSpreadsheet } from 'lucide-react'
import './Page.css'
import { apiClient } from '../lib/api'
import type { RiskAssessment, RiskItem } from '../types/sms'
import Spinner from '../components/Spinner'

// Extended type to include items
interface RiskAssessmentDetail extends RiskAssessment {
    items: RiskItem[]
}

// 등급 배지 — 점수를 등급으로 치환한 결과를 색으로 구분한다.
const GRADE_BADGE: Record<string, string> = {
    A: 'badge-error', B: 'badge-warning', C: 'badge-primary', D: 'badge-tag', E: 'badge',
}

export default function RiskAssessmentDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [ra, setRa] = useState<RiskAssessmentDetail | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) fetchDetail()
    }, [id])

    const fetchDetail = async () => {
        try {
            const { data } = await apiClient.get<RiskAssessmentDetail>(`/sms/risk-assessments/${id}`)
            setRa(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <Spinner />
    if (!ra) return <div className="page">데이터를 찾을 수 없습니다.</div>

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <button className="btn-text" onClick={() => navigate('/sms/ra')}>
                        <ArrowLeft size={16} /> 목록으로
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <h1 style={{ margin: 0 }}>{ra.process_name}</h1>
                        <span className={`badge ${ra.status === 'APPROVED' ? 'badge-live' : 'badge-tag'}`}>
                            {ra.status === 'APPROVED' ? '승인완료' : '작성중'}
                        </span>
                    </div>
                </div>
                {/*
                    화면 인쇄는 두지 않는다. 22열·병합셀 338개인 현장 서식을
                    브라우저 인쇄로 재현할 수 없어 실무에 쓸 수 없다(설계서 6.4).
                    현장 양식 xlsx 에 값을 채워 내려받는 것만 제공한다.
                */}
                <div style={{ marginLeft: 'auto' }}>
                    <button
                        className="btn-primary"
                        onClick={() => { window.location.href = `/api/sms/risk-assessments/${id}/export` }}
                    >
                        <FileSpreadsheet size={18} />
                        엑셀 다운로드
                    </button>
                </div>
            </header>

            <div className="grid two" style={{ marginBottom: '2rem' }}>
                <div className="card">
                    <p className="card-label">기본 정보</p>
                    <ul className="list">
                        <li className="milestone-meta">
                            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Calendar size={14} /> 작성일
                            </span>
                            <span>{new Date(ra.created_at).toLocaleDateString()}</span>
                        </li>
                        <li className="milestone-meta">
                            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <User size={14} /> 작성자
                            </span>
                            <span>{ra.assessor_name || '-'}</span>
                        </li>
                        <li className="milestone-meta">
                            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <CheckCircle size={14} /> 관리자
                            </span>
                            <span>{ra.approver_name || '미지정'}</span>
                        </li>
                    </ul>
                </div>
                <div className="card">
                    <p className="card-label">위험성 요약</p>
                    <div className="hero-card">
                        <div className="hero-metric">
                            <strong>{ra.items.length}</strong>
                            <span>총 위험요소</span>
                        </div>
                        <div className="hero-metric">
                            <strong style={{ color: '#ffc2c2' }}>
                                {ra.items.filter(i => (i.frequency * i.severity) >= 9).length}
                            </strong>
                            <span>고위험 항목</span>
                        </div>
                    </div>
                </div>
            </div>

            <section className="panel">
                <div className="section-header">
                    <h3>상세 위험요소 및 대책</h3>
                </div>

                {/*
                    현장 RA 양식과 같은 표 형태로 보여준다.
                    카드로 펼치면 항목당 화면을 많이 먹어 한눈에 안 들어온다.
                    열 구성은 현장 양식을 따랐다 — 세부공정·위험분류·위험발생 상황·재해형태·
                    관련근거·현재조치·현재위험성·감소대책·개선 후 위험성.
                */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="ra-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', width: 34 }}>#</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', width: 72 }}>위험분류</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', minWidth: 200 }}>위험발생 상황 및 결과</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', width: 80 }}>재해형태</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', minWidth: 130 }}>관련근거</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', minWidth: 140 }}>현재의 안전보건조치</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: 96 }}>현재위험성</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'left', minWidth: 180 }}>위험성 감소대책</th>
                                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: 96 }}>개선 후</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ra.items.map((item: any, idx: number) => {
                                const v = (item.frequency || 0) * (item.severity || 0)
                                const rv = (item.residual_frequency || 0) * (item.residual_severity || 0)
                                const cell = { padding: '0.55rem 0.4rem', verticalAlign: 'top' as const, borderBottom: '1px solid var(--border)' }
                                return (
                                    <tr key={item.id}>
                                        <td style={{ ...cell, color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                                        <td style={cell}>{item.hazard_class || '-'}</td>
                                        <td style={{ ...cell, lineHeight: 1.5 }}>{item.risk_factor}</td>
                                        <td style={cell}>{item.risk_type || '-'}</td>
                                        <td style={{ ...cell, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{item.legal_basis || '-'}</td>
                                        <td style={{ ...cell, fontSize: '0.8rem' }}>{item.current_control || '-'}</td>
                                        <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {item.frequency}×{item.severity}={v}
                                            {item.grade && <><br /><span className={`badge ${GRADE_BADGE[item.grade] || 'badge-tag'}`}>{item.grade}</span></>}
                                        </td>
                                        <td style={{ ...cell, color: '#9cf0c8', lineHeight: 1.5 }}>{item.mitigation_measure || '-'}</td>
                                        <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {rv ? <>{item.residual_frequency}×{item.residual_severity}={rv}<br />
                                                <span className={`badge ${GRADE_BADGE[item.residual_grade] || 'badge-tag'}`}>{item.residual_grade}</span></> : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
