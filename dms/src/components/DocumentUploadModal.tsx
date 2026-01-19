import { useState, useRef } from 'react'
import { X, UploadCloud, FileText, CheckCircle2, Calendar, Tag } from 'lucide-react'
import './DocumentUploadModal.css'

interface DocumentUploadModalProps {
    isOpen?: boolean
    onClose: () => void
    initialProject?: string
    initialCategory?: string
    onSuccess?: () => void
}

export default function DocumentUploadModal({ isOpen = true, onClose, initialProject, initialCategory, onSuccess }: DocumentUploadModalProps) {
    if (!isOpen) return null

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [dragActive, setDragActive] = useState(false)

    // Metadata States
    const [project, setProject] = useState(initialProject || '서초동 사옥')
    const [category, setCategory] = useState(initialCategory || '00_공무_행정')
    const [docType, setDocType] = useState('보고서')
    const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0])
    const [isClientSubmit, setIsClientSubmit] = useState(false)
    const [clientName, setClientName] = useState('삼성물산') // Default linked to project usually
    const [docTitle, setDocTitle] = useState('')
    interface AttachmentItem {
        file: File
        description: string
    }
    const [attachments, setAttachments] = useState<AttachmentItem[]>([])

    // Handlers
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0])
        }
    }

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile)
        // Auto-fill title from filename
        setDocTitle(selectedFile.name.split('.').slice(0, -1).join('.'))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // Logic to send FormData to Backend would go here
        console.log({
            file,
            attachments: attachments.map(a => ({ name: a.file.name, desc: a.description, size: a.file.size })),
            metadata: {
                project, category, docType, refDate, isClientSubmit, clientName, docTitle
            }
        })
        alert('문서가 등록되었습니다. (Metadata Tagging Complete)')
        if (onSuccess) onSuccess()
        onClose()
    }

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <div className="header-title-group">
                        <h2>새 문서 등록</h2>
                        <span className="header-sub">메타데이터 태깅 및 저장소 업로드</span>
                    </div>
                    <button onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="upload-split">
                        {/* Left: File Area */}
                        <div
                            className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                hidden
                                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                            />

                            {file ? (
                                <div className="file-preview">
                                    <FileText size={48} className="icon-preview" />
                                    <div className="file-name">{file.name}</div>
                                    <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                    <button className="btn-reselect">파일 다시 선택</button>
                                </div>
                            ) : (
                                <div className="drop-prompt">
                                    <UploadCloud size={48} strokeWidth={1.5} />
                                    <p>이곳에 파일을 드래그하거나 클릭하여 업로드하세요</p>
                                    <span>지원 형식: PDF, XLSX, DWG, HWPX</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Metadata Form */}
                        <form className="meta-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>프로젝트 (Project)</label>
                                <select value={project} onChange={e => setProject(e.target.value)} className="input-std">
                                    <option value="서초동 사옥">서초동 사옥 (PJ-001)</option>
                                    <option value="평택 P4">평택 P4 (PJ-002)</option>
                                </select>
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>대분류 (Category)</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="input-std">
                                        <option value="00_공무_행정">00_공무_행정</option>
                                        <option value="01_안전_보건">01_안전_보건</option>
                                        <option value="02_공사_작업">02_공사_작업</option>
                                        <option value="03_장비_공도구">03_장비_공도구</option>
                                        <option value="04_기록_자료">04_기록_자료</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>문서 유형 (Doc Type)</label>
                                    <select value={docType} onChange={e => setDocType(e.target.value)} className="input-std">
                                        <option>보고서</option>
                                        <option>계획서</option>
                                        <option>도면</option>
                                        <option>공문</option>
                                        <option>회의록</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>문서 제목 (Title)</label>
                                <input
                                    type="text"
                                    className="input-std"
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                    placeholder="파일 업로드 시 자동 입력됨"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>기준 날짜 (Ref Date)</label>
                                <div className="input-with-icon">
                                    <Calendar size={16} />
                                    <input
                                        type="date"
                                        className="input-std"
                                        value={refDate}
                                        onChange={e => setRefDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>문서 버전 (Revision)</label>
                                    <input type="text" className="input-std" placeholder="예: Rev. 0" defaultValue="Rev. 0" />
                                </div>
                                <div className="form-group">
                                    <label>보안 등급 (Access Level)</label>
                                    <select className="input-std">
                                        <option>일반 (Internal)</option>
                                        <option>대외비 (Confidential)</option>
                                        <option>제한 (Restricted)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>검색 태그 (Tags)</label>
                                <div className="input-with-icon">
                                    <Tag size={16} />
                                    <input
                                        type="text"
                                        className="input-std"
                                        placeholder="#키워드 입력 (예: #착공계 #안전관리비)"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>문서 설명 (Description)</label>
                                <textarea
                                    className="input-std"
                                    rows={2}
                                    placeholder="문서에 대한 간략한 설명이나 비고 사항을 입력하세요."
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    부속 서류 (Attachments)
                                    <label htmlFor="att-upload" className="btn-icon-tiny" style={{ cursor: 'pointer', color: '#4dabf7' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                            <UploadCloud size={14} /> 추가
                                        </div>
                                    </label>
                                </label>
                                <input
                                    id="att-upload"
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            const newFiles = Array.from(e.target.files).map(f => ({ file: f, description: '' }))
                                            setAttachments(prev => [...prev, ...newFiles])
                                        }
                                    }}
                                />
                                {attachments.length > 0 ? (
                                    <div className="attachment-preview-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                        {attachments.map((att, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                                padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                        <FileText size={14} color="#868e96" />
                                                        <span style={{ fontSize: '0.8rem', color: '#dee2e6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                            {att.file.name}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: '#868e96' }}>
                                                            ({(att.file.size / 1024 / 1024).toFixed(2)} MB)
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        style={{ background: 'none', border: 'none', color: '#fa5252', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="부속서류 설명 입력 (검색용)"
                                                    value={att.description}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setAttachments(prev => prev.map((item, i) => i === idx ? { ...item, description: val } : item))
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: '#e9ecef', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '3px',
                                                        width: '100%'
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '8px', border: '1px dashed #495057', borderRadius: '4px', fontSize: '0.8rem', color: '#868e96', textAlign: 'center' }}>
                                        부속 서류 없음
                                    </div>
                                )}
                            </div>

                            {/* Critical Section: Client Submission */}
                            <div className={`client-section ${isClientSubmit ? 'active' : ''}`}>
                                <div
                                    className="checkbox-wrap"
                                    onClick={() => setIsClientSubmit(!isClientSubmit)}
                                >
                                    <div className={`checkbox ${isClientSubmit ? 'checked' : ''}`}>
                                        {isClientSubmit && <CheckCircle2 size={14} />}
                                    </div>
                                    <div className="label-group">
                                        <span className="main-label">발주처 제출용 문서 (Client Submission)</span>
                                        <span className="sub-label">체크 시 '제출용 바인더'에 자동 포함됩니다.</span>
                                    </div>
                                </div>

                                {isClientSubmit && (
                                    <div className="client-detail animation-slide-down">
                                        <label>제출 대상 (Client)</label>
                                        <select className="input-std" value={clientName} onChange={e => setClientName(e.target.value)}>
                                            <option>삼성물산</option>
                                            <option>현대건설</option>
                                            <option>발주처 공통</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button type="button" onClick={onClose} className="btn-cancel">취소</button>
                                <button type="submit" className="btn-submit" disabled={!file}>등록하기</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
