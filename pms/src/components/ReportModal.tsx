import { useState, useEffect } from 'react'
import { X, Printer, Send, Check, AlertCircle } from 'lucide-react'
import ReportViewer from './ReportViewer'
import ReportEditor from './ReportEditor'

interface ReportModalProps {
    mode: 'VIEW' | 'CREATE' | 'EDIT'
    report?: any // Report object or null for create
    isOpen: boolean
    onClose: () => void
    onSave?: (data: any) => void
    onStatusChange?: (id: string, newStatus: string, comment?: string) => void
    isApprover?: boolean // Temporary role check
}

export default function ReportModal({ mode, report, isOpen, onClose, onSave, onStatusChange, isApprover }: ReportModalProps) {
    if (!isOpen) return null

    const [isEditing, setIsEditing] = useState(mode === 'EDIT' || mode === 'CREATE')
    const [comment, setComment] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)

    const [draftContent, setDraftContent] = useState<any>(null)

    useEffect(() => {
        setIsEditing(mode === 'EDIT' || mode === 'CREATE')
        if (report) {
            setDraftContent(report.content || report)
        }
    }, [mode, report])

    const status = report?.status || 'DRAFT'
    const isDraft = status === 'DRAFT'
    const isPending = status === 'PENDING'
    const isApproved = status === 'APPROVED'

    const handlePrint = () => {
        window.print()
    }

    const handleSubmit = () => {
        if (confirm('결재를 진행하시겠습니까?')) {
            onStatusChange?.(report.id, 'PENDING')
            onClose()
        }
    }

    const handleApprove = () => {
        if (confirm('이 보고서를 승인하시겠습니까?')) {
            onStatusChange?.(report.id, 'APPROVED')
            onClose()
        }
    }

    const handleReject = () => {
        if (!comment.trim()) {
            alert('반려 사유를 입력해주세요.')
            return
        }
        onStatusChange?.(report.id, 'REJECTED', comment)
        onClose()
    }

    const handleSave = () => {
        onSave?.(draftContent)
        // setIsEditing(false) // Optional: stay in edit mode or close? Usually close edit mode.
        // Assuming parent might close modal or just update data. 
        // Let's assume onSave handles optimistic update, so we can switch back to view.
        setIsEditing(false)
    }

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.55)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content" style={{
                background: '#0b1324', // Use Theme Dark BG
                border: '1px solid rgba(255, 255, 255, 0.08)',
                width: '900px', maxWidth: '95vw', height: '90vh',
                borderRadius: '14px', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}>
                {/* Header */}
                <div className="modal-header" style={{
                    padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
                            {mode === 'CREATE' ? '새 보고서 작성' : report?.title}
                        </h3>
                        {report && (
                            <span className="badge" style={{
                                marginTop: '0.5rem', display: 'inline-block',
                                border: report.status === 'DRAFT' ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.1)',
                                color: report.status === 'DRAFT' ? '#00f0ff' : '#9fb2cc',
                                background: report.status === 'DRAFT' ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                                boxShadow: report.status === 'DRAFT' ? '0 0 8px rgba(0, 240, 255, 0.2)' : 'none'
                            }}>
                                {report.status}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="icon-button"><X /></button>
                </div>

                {/* Body (Scrollable) */}
                <div className="modal-body custom-scroll" style={{
                    flex: 1, overflowY: 'auto', padding: '2rem', background: 'transparent'
                }}>
                    {report ? (
                        isEditing ? (
                            <ReportEditor
                                content={draftContent}
                                onChange={setDraftContent}
                                title={report.title}
                            />
                        ) : (
                            <ReportViewer data={report.content || report} title={report.title} />
                        )
                    ) : (
                        <div className="muted" style={{ textAlign: 'center', marginTop: '3rem' }}>
                            데이터를 불러오는 중입니다...
                        </div>
                    )}
                </div>

                {/* Footer (Actions) */}
                <div className="modal-footer" style={{
                    padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: '#0b1324', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px'
                }}>
                    <div className="left-actions">
                        {/* Show Print only in View Mode or maybe always? View mode makes sense */}
                        {!isEditing && isApproved && (
                            <button className="btn-secondary" onClick={handlePrint} style={{ display: 'flex', gap: '0.5rem' }}>
                                <Printer size={16} /> 인쇄
                            </button>
                        )}
                    </div>

                    <div className="right-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {isEditing ? (
                            <>
                                <button className="btn-secondary" style={{
                                    height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#fff', fontSize: '1rem', fontWeight: 600
                                }} onClick={() => setIsEditing(false)}>
                                    취소
                                </button>
                                <button className="btn-primary" style={{
                                    height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#4ea1ff', fontSize: '1rem', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }} onClick={handleSave}>
                                    <Check size={16} style={{ marginRight: '8px' }} /> 저장
                                </button>
                            </>
                        ) : (
                            <>
                                {mode === 'CREATE' && (
                                    <button className="btn-primary" onClick={() => onSave?.(report)}>
                                        <Check size={16} style={{ marginRight: '8px' }} /> 작성 완료
                                    </button>
                                )}

                                {mode === 'VIEW' && isDraft && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="btn-secondary" style={{
                                            height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#fff', fontSize: '1rem', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0
                                        }} onClick={() => setIsEditing(true)}>
                                            <Check size={16} style={{ marginRight: '8px' }} /> 저장
                                        </button>
                                        <button className="btn-primary" style={{
                                            height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#4ea1ff', fontSize: '1rem', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0
                                        }} onClick={handleSubmit}>
                                            <Send size={16} style={{ marginRight: '8px' }} /> 결재
                                        </button>
                                    </div>
                                )}

                                {mode === 'VIEW' && isPending && isApprover && (
                                    <>
                                        {showRejectForm ? (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    placeholder="반려 사유 입력"
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                    className="input-sm"
                                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                                                />
                                                <button style={{
                                                    height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)',
                                                    color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
                                                }} onClick={handleReject}>확인</button>
                                                <button style={{
                                                    height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                                    color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
                                                }} onClick={() => setShowRejectForm(false)}>취소</button>
                                            </div>
                                        ) : (
                                            <button style={{
                                                height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)',
                                                color: '#fff', fontSize: '1rem', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                            }} onClick={() => setShowRejectForm(true)}>
                                                <AlertCircle size={16} style={{ marginRight: '8px' }} /> 반려
                                            </button>
                                        )}

                                        <button style={{
                                            height: '42px', padding: '0 1.5rem', borderRadius: '10px',
                                            background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#4ea1ff', fontSize: '1rem', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }} onClick={handleApprove}>
                                            <Check size={16} style={{ marginRight: '8px' }} /> 승인
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
