import { useState, useRef } from 'react'
import { X, Upload, FileText, Paperclip } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useToast } from './ToastProvider'
import { useProjectContext } from '../context/ProjectContext'
import { useProjects } from '../hooks/useProjects'

interface DocumentUploadModalProps {
    onClose: () => void
    onSuccess: () => void
}

export default function DocumentUploadModal({ onClose, onSuccess }: DocumentUploadModalProps) {
    const { selectedId } = useProjectContext()
    const { data: projects } = useProjects()
    const { show } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        projectId: selectedId || '',
        category: 'CONTRACT',
        type: '',
        name: '',
        status: 'DRAFT',
        securityLevel: 'NORMAL'
    })
    const [file, setFile] = useState<File | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Handle file selection (Do NOT auto-fill name)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.projectId) {
            show('프로젝트를 선택해주세요.', 'warning')
            return
        }
        if (!form.name) {
            show('문서명을 입력해주세요.', 'warning')
            return
        }
        if (!file) {
            show('파일을 업로드해주세요.', 'warning')
            return
        }

        try {
            setIsSubmitting(true)
            const formData = new FormData()
            formData.append('projectId', form.projectId)
            formData.append('category', form.category)
            formData.append('type', form.type || '')
            formData.append('name', form.name) // Official Document Name
            formData.append('status', form.status)
            formData.append('securityLevel', form.securityLevel)
            formData.append('file', file)

            const baseURL = (apiClient.defaults.baseURL || '/api').replace(/\/$/, '')
            const response = await fetch(`${baseURL}/documents/upload`, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || `Upload failed with status ${response.status}`)
            }

            show('문서가 업로드되었습니다.', 'success')
            onSuccess()
            onClose()
        } catch (err: any) {
            console.error(err)
            show('업로드 실패: ' + (err.message || 'Unknown error'), 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
                    <button
                        className="icon-button"
                        onClick={(e) => handleSubmit(e as any)}
                        disabled={isSubmitting}
                        title="업로드 저장"
                    >
                        <Upload size={24} />
                    </button>
                    <button className="icon-button" onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-header">
                    <h3>새 문서 업로드</h3>
                    <p style={{ fontSize: '0.8rem', color: '#868e96', marginTop: '0.5rem', lineHeight: '1.4' }}>
                        문서명은 프로젝트 공식 관리 명칭을 입력해주세요.<br />
                        (예: 2024년 10월 안전점검 보고서)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="form-grid single-col">
                    <label>
                        <span>프로젝트 <span style={{ color: '#fa5252' }}>*</span></span>
                        <select
                            value={form.projectId}
                            onChange={e => setForm({ ...form, projectId: e.target.value })}
                            required
                        >
                            <option value="">선택</option>
                            {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </label>

                    <div className="grid two">
                        <label>
                            <span>카테고리</span>
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                            >
                                <option value="CONTRACT">계약</option>
                                <option value="PROCESS">공정</option>
                                <option value="SAFETY">안전</option>
                                <option value="QUALITY">품질</option>
                                <option value="EVIDENCE">증빙</option>
                                <option value="SCRAP">반출</option>
                                <option value="PHOTO">사진</option>
                            </select>
                        </label>
                        <label>
                            <span>문서 종류 (Type)</span>
                            <input
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                                placeholder="예: 견적서, 도면"
                            />
                        </label>
                    </div>

                    <label>
                        <span>문서명 (Official Title) <span style={{ color: '#fa5252' }}>*</span></span>
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="프로젝트 공식 문서명을 입력하세요"
                            required
                        />
                    </label>

                    <label>
                        <span>파일명 (File) <span style={{ color: '#fa5252' }}>*</span></span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '0 1rem',
                                    height: '42px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: file ? '#74c0fc' : '#868e96',
                                    fontSize: '0.9rem',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                {file ? (
                                    <>
                                        <FileText size={16} style={{ flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#495057', marginLeft: 'auto' }}>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ color: '#495057' }}>업로드할 파일을 선택하세요 (PDF 권장)</span>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="application/pdf, image/*"
                                style={{ display: 'none' }}
                            />

                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.1)'
                                }}
                            >
                                {file ? <X size={20} onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} /> : <Paperclip size={20} />}
                            </button>
                        </div>
                    </label>

                </form>
            </div>
        </div>
    )
}
