import { Upload, FileText, Image, X, Eye } from 'lucide-react'
import { useState } from 'react'

interface UploadedFile {
    id: string
    name: string
    type: string
    size: number
    uploadDate: string
    category: string
    url?: string
}

interface DocumentUploaderProps {
    category: string
    documents: string[]
    uploadedFiles: UploadedFile[]
    onFileUpload: (files: FileList, category: string) => void
    onFileDelete: (fileId: string) => void
    onFileView: (file: UploadedFile) => void
    onCategoryChange?: (fileId: string, newCategory: string) => void
    allCategories?: string[]
}

export function DocumentUploader({
    category,
    documents,
    uploadedFiles,
    onFileUpload,
    onFileDelete,
    onFileView
}: DocumentUploaderProps) {
    const [dragActive, setDragActive] = useState(false)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileUpload(e.dataTransfer.files, category)
        }
    }

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileUpload(e.target.files, category)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <Image size={18} style={{ color: '#3b82f6' }} />
        return <FileText size={18} style={{ color: '#8b5cf6' }} />
    }

    const categoryFiles = uploadedFiles.filter(f => f.category === category)

    return (
        <div style={{ marginTop: '2rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: '#e2e8f0' }}>
                📎 필수 문서
            </h4>

            {/* 필수 문서 목록 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.5rem'
            }}>
                {documents.map((doc, idx) => (
                    <div
                        key={idx}
                        style={{
                            padding: '0.75rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            color: '#94a3b8'
                        }}
                    >
                        {doc}
                    </div>
                ))}
            </div>

            {/* 파일 업로드 영역 */}
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                    border: dragActive ? '2px dashed #3b82f6' : '2px dashed #334155',
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    background: dragActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '1.5rem'
                }}
                onClick={() => document.getElementById(`file-input-${category}`)?.click()}
            >
                <Upload size={32} style={{ color: '#3b82f6', margin: '0 auto 1rem' }} />
                <p style={{ margin: 0, color: '#e2e8f0', fontWeight: 500 }}>
                    파일을 드래그하거나 클릭하여 업로드
                </p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                    PDF, 이미지, 문서 파일 지원 (최대 10MB)
                </p>
                <input
                    id={`file-input-${category}`}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />
            </div>

            {/* 업로드된 파일 목록 */}
            {categoryFiles.length > 0 && (
                <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#94a3b8' }}>
                        업로드된 파일 ({categoryFiles.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {categoryFiles.map(file => (
                            <div
                                key={file.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '8px'
                                }}
                            >
                                {getFileIcon(file.type)}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.name}
                                        </p>
                                        {/* 카테고리 태그 */}
                                        <span style={{
                                            padding: '0.125rem 0.5rem',
                                            background: 'rgba(59, 130, 246, 0.2)',
                                            border: '1px solid rgba(59, 130, 246, 0.4)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            color: '#60a5fa',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {file.category}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {formatFileSize(file.size)} • {new Date(file.uploadDate).toLocaleDateString('ko-KR')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onFileView(file)}
                                    style={{
                                        padding: '0.5rem',
                                        background: 'transparent',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        color: '#3b82f6',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="보기"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => onFileDelete(file.id)}
                                    style={{
                                        padding: '0.5rem',
                                        background: 'transparent',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="삭제"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
