import { useState, useRef, useEffect } from 'react'
import { X, Upload, FileText, Paperclip } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useToast } from './ToastProvider'
import { useProjectContext } from '../context/ProjectContext'
import { useProjects } from '../hooks/useProjects'

interface DocumentUploadModalProps {
    onClose: () => void
    onSuccess: () => void
    initialCategory?: string
}

export default function DocumentUploadModal({ onClose, onSuccess, initialCategory }: DocumentUploadModalProps) {
    const { selectedId } = useProjectContext()
    const { data: projects } = useProjects()
    const { show } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        projectId: selectedId || '',
        category: initialCategory || '계약서류',
        type: '',
        name: '',
        status: 'DRAFT',
        securityLevel: 'NORMAL'
    })
    const [file, setFile] = useState<File | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [existingCategories, setExistingCategories] = useState<string[]>([
        '계약서류', '설계도면', '안전관리', '품질관리', '준공서류', '현장사진', '반출증빙'
    ])

    // Fetch existing categories when projectId changes
    useEffect(() => {
        if (!form.projectId) return

        async function fetchCategories() {
            try {
                // Fetch all docs for project to extract categories
                // Optimization: In real world, use a dedicated endpoint like /api/documents/categories
                const { data } = await apiClient.get(`/documents?projectId=${form.projectId}`)
                if (Array.isArray(data)) {
                    const cats = new Set<string>(['계약서류', '설계도면', '안전관리', '품질관리', '준공서류'])
                    data.forEach((d: any) => {
                        if (d.category) cats.add(d.category)
                    })
                    setExistingCategories(Array.from(cats).sort())
                }
            } catch (e) {
                console.error('Failed to fetch categories', e)
            }
        }
        fetchCategories()
    }, [form.projectId])

    // Handle file selection (Auto-fill name if empty)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            setFile(selectedFile)

            // Auto-fill document name if empty
            if (!form.name.trim()) {
                const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "")
                setForm(prev => ({ ...prev, name: fileNameWithoutExt }))
            }
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

            // If new category was created, refresh
            onSuccess()
            show('문서가 업로드되었습니다.', 'success')
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

                    <label>
                        <span>프로젝트 산출물 (폴더명)</span>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                list="category-options"
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                placeholder="폴더명을 입력하거나 선택하세요"
                                required
                                style={{ width: '100%' }}
                            />
                            <datalist id="category-options">
                                {existingCategories.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <label>
                            <span>문서 종류 (Type)</span>
                            <input
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                                placeholder="예: 견적서, 도면, 보고서"
                                style={{ width: '100%' }}
                            />
                        </label>
                        <label>
                            <span>보안 등급</span>
                            <select
                                value={form.securityLevel}
                                onChange={e => setForm({ ...form, securityLevel: e.target.value })}
                                style={{ background: '#333', color: 'white', border: '1px solid #555', height: '42px', width: '100%' }}
                            >
                                <option value="NORMAL">NORMAL</option>
                                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                                <option value="SECRET">SECRET</option>
                            </select>
                        </label>
                    </div>

                    <label>
                        <span>문서명 (파일 엔티티) <span style={{ color: '#fa5252' }}>*</span></span>
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="문서명을 입력하세요 (예: 1차 설계도면)"
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
