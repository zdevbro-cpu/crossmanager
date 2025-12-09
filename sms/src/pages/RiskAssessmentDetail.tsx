
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, CheckCircle, Calendar, User } from 'lucide-react'
import './Page.css'
import { apiClient } from '../lib/api'
import type { RiskAssessment, RiskItem } from '../types/sms'
import Spinner from '../components/Spinner'

// Extended type to include items
interface RiskAssessmentDetail extends RiskAssessment {
    items: RiskItem[]
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
                    <button className="btn-text" onClick={() => navigate('/ra')}>
                        <ArrowLeft size={16} /> 목록으로
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <h1 style={{ margin: 0 }}>{ra.process_name}</h1>
                        <span className={`badge ${ra.status === 'APPROVED' ? 'badge-live' : 'badge-tag'}`}>
                            {ra.status === 'APPROVED' ? '승인완료' : '작성중'}
                        </span>
                    </div>
                </div>
                <button className="btn-secondary" onClick={() => window.print()}>
                    <Printer size={18} />
                    인쇄
                </button>
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

                <div className="risk-items-container">
                    {ra.items.map((item, idx) => {
                        const riskLevel = item.frequency * item.severity
                        return (
                            <div key={item.id} className="risk-item-card">
                                <div className="risk-item-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span className="badge">{idx + 1}</span>
                                        <h4 style={{ margin: 0 }}>{item.risk_factor}</h4>
                                    </div>
                                    <span className={`badge ${riskLevel >= 9 ? 'badge-alert' : riskLevel >= 4 ? 'badge-tag' : 'badge'}`}>
                                        위험도 {riskLevel} ({riskLevel >= 9 ? '상' : riskLevel >= 4 ? '중' : '하'})
                                    </span>
                                </div>

                                <div className="grid two">
                                    <div>
                                        <p className="task-id">발생 형태</p>
                                        <p>{item.risk_type}</p>
                                    </div>
                                    <div>
                                        <p className="task-id">빈도 × 강도</p>
                                        <p>{item.frequency} × {item.severity} = <strong>{riskLevel}</strong></p>
                                    </div>
                                    <div className="full">
                                        <p className="task-id">감소 대책</p>
                                        <p style={{ color: '#9cf0c8' }}>{item.mitigation_measure}</p>
                                    </div>
                                    <div>
                                        <p className="task-id">조치 담당자</p>
                                        <p>{item.action_manager || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="task-id">조치 기한</p>
                                        <p>{item.action_deadline ? new Date(item.action_deadline).toLocaleDateString() : '-'}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
