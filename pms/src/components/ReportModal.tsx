import { useState, useEffect } from 'react'
import { X, Send, Check, AlertCircle, Download } from 'lucide-react'
import ReportViewer from './ReportViewer'
import ReportEditor from './ReportEditor'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

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

    const handlePrintAsPDF = async () => {
        const element = document.getElementById('report-content-for-pdf')
        if (!element) {
            alert('보고서 내용을 찾을 수 없습니다.')
            return
        }

        setIsGeneratingPDF(true)

        try {
            // HTML을 Canvas로 변환
            const canvas = await html2canvas(element, {
                scale: 2, // 고해상도
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff', // PDF는 흰 배경
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            })

            const imgData = canvas.toDataURL('image/png')

            // PDF 생성 (A4)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            const imgWidth = 210 // A4 width
            const pageHeight = 297 // A4 height
            const imgHeight = (canvas.height * imgWidth) / canvas.width
            let heightLeft = imgHeight
            let position = 0

            // 첫 페이지
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
            heightLeft -= pageHeight

            // 추가 페이지
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight
                pdf.addPage()
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                heightLeft -= pageHeight
            }

            // PDF 저장
            const fileName = `${report?.title || '보고서'}_${new Date().toISOString().slice(0, 10)}.pdf`
            pdf.save(fileName)

        } catch (error) {
            console.error('PDF 생성 실패:', error)
            alert('PDF 생성에 실패했습니다.')
        } finally {
            setIsGeneratingPDF(false)
        }
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
                            <div id="report-content-for-pdf">
                                <ReportViewer data={report.content || report} title={report.title} />
                            </div>
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
                        {!isEditing && (
                            <button
                                onClick={handlePrintAsPDF}
                                disabled={isGeneratingPDF}
                                style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    height: '42px',
                                    padding: '0 1.5rem',
                                    borderRadius: '10px',
                                    background: '#1e293b',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    cursor: isGeneratingPDF ? 'wait' : 'pointer',
                                    opacity: isGeneratingPDF ? 0.6 : 1
                                }}
                            >
                                <Download size={16} /> {isGeneratingPDF ? 'PDF 생성 중...' : 'PDF 다운로드'}
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
