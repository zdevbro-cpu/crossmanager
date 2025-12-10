import { useState, useRef } from 'react'
import { X, Upload, FileText, Plus } from 'lucide-react'
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
        category: 'CONTRACT', // Default
        type: '계약서', // Sub-type
        name: '',
        status: 'DRAFT',
        securityLevel: 'NORMAL'
    })
    const [file, setFile] = useState<File | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Helper: auto-fill name when file selected
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0]
            setFile(f)
            if (!form.name) {
                setForm(prev => ({ ...prev, name: f.name }))
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.projectId) {
            show('프로젝트를 선택해주세요.', 'warning')
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
            formData.append('type', form.type)
            formData.append('name', form.name)
            formData.append('status', form.status)
            formData.append('securityLevel', form.securityLevel)
            formData.append('file', file)

            await apiClient.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            show('문서가 업로드되었습니다.', 'success')
            onSuccess()
            onClose()
        } catch (err: any) {
            console.error(err)
            show('업로드 실패: ' + (err.response?.data?.error || err.message), 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Create a local URL for preview if file is selected
    const filePreviewUrl = file ? URL.createObjectURL(file) : '#'

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
                    <p style={{ fontSize: '0.8rem', color: '#ff8787', marginTop: '0.5rem', lineHeight: '1.4' }}>
                        📌 <strong>유의사항</strong>: 프로젝트 공식 문서는 <strong>PDF</strong> 형식으로 업로드하는 것을 원칙으로 합니다.<br />
                        (사진 등 다중 파일은 PDF로 변환하여 등록해주세요.)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="form-grid single-col">
                    <label>
                        <span>프로젝트</span>
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
                            <span>문서 종류</span>
                            <input
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                                placeholder="예: 견적서, 도면"
                            />
                        </label>
                    </div>

                    <label>
                        <span>문서명 (파일 선택)</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {file ? (
                                <a
                                    href={filePreviewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0 1rem',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        background: 'rgba(255,255,255,0.05)',
                                        textDecoration: 'none',
                                        color: '#74c0fc',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <FileText size={16} />
                                    {form.name || file.name}
                                </a>
                            ) : (
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="우측 버튼으로 파일 선택"
                                    style={{ flex: 1 }}
                                />
                            )}

                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => fileInputRef.current?.click()}
                                title="파일 열기"
                                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </label>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        style={{ display: 'none' }}
                    />

                    {/* Bottom Action Button Removed as per request (moved to header) */}
                    {/* But wait, user said "x 버튼 좌측에 업로드 아이콘 버튼으로 업로드". Does that mean remove bottom button? Usually yes. */}
                    {/* Let's keep a hidden submit for form enter key if needed, or just rely on header button */}
                </form>
            </div>
        </div>
    )
}
