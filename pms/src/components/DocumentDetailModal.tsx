import { useState, useEffect, useRef } from 'react'
import { X, FileText, Upload, ExternalLink, RefreshCw, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { apiClient } from '../lib/api'
import { openPrintWindow } from '../utils/printWindow'
import { useToast } from './ToastProvider'

interface DocumentDetailModalProps {
    documentId: string
    onClose: () => void
    onUpdate: () => void
    initialTab?: 'info' | 'history'
}

const formatDateTime = (dateInput: any) => {
    if (!dateInput) return '-'
    let dateStr = dateInput
    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
        dateStr += 'Z'
    }
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul'
    }).format(date)
}



export default function DocumentDetailModal({ documentId, onClose, onUpdate, initialTab = 'info' }: DocumentDetailModalProps) {
    const { show } = useToast()
    const [activeTab, setActiveTab] = useState<'info' | 'history'>(initialTab)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [isUploadingVersion, setIsUploadingVersion] = useState(false)
    // Version Upload State
    const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
    const [newVersionDesc, setNewVersionDesc] = useState('')
    const [newVersionString, setNewVersionString] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Rename State
    const [isEditingName, setIsEditingName] = useState(false)
    const [editName, setEditName] = useState('')

    useEffect(() => {
        fetchDetails()
    }, [documentId])

    const fetchDetails = async () => {
        try {
            setLoading(true)
            const res = await apiClient.get(`/documents/${documentId}`)
            setData(res.data)
            setEditName(res.data.name)
        } catch (err) {
            console.error(err)
            show('문서 정보를 불러오지 못했습니다.', 'error')
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm(`상태를 ${newStatus}(으)로 변경하시겠습니까?`)) return
        try {
            setUpdatingStatus(true)
            await apiClient.patch(`/documents/${documentId}`, { status: newStatus })
            show('상태가 변경되었습니다.', 'success')
            fetchDetails()
            onUpdate()
        } catch (err) {
            show('상태 변경 실패', 'error')
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleSecurityChange = async (newLevel: string) => {
        if (!confirm(`보안 등급을 ${newLevel}(으)로 변경하시겠습니까?`)) return
        try {
            await apiClient.patch(`/documents/${documentId}`, { securityLevel: newLevel })
            show('보안 등급이 변경되었습니다.', 'success')
            fetchDetails()
            onUpdate()
        } catch (err) {
            show('보안 등급 변경 실패', 'error')
        }
    }

    const handleNameUpdate = async () => {
        if (!editName.trim()) return
        if (editName === data.name) {
            setIsEditingName(false)
            return
        }

        try {
            await apiClient.patch(`/documents/${documentId}`, { name: editName })
            show('문서명이 변경되었습니다.', 'success')
            setIsEditingName(false)
            fetchDetails()
            onUpdate()
        } catch (err) {
            show('문서명 변경 실패', 'error')
        }
    }

    const handleDeleteVersion = async (versionId: string) => {
        if (data.status === 'APPROVED') {
            show('승인된 문서는 버전을 삭제할 수 없습니다.', 'error')
            return
        }

        const latestVersion = data.versions && data.versions[0]
        if (latestVersion && latestVersion.id !== versionId) {
            show('최신 버전만 삭제할 수 있습니다.', 'error')
            return
        }

        if (!confirm('이 버전을 삭제하시겠습니까?')) return
        try {
            await apiClient.delete(`/documents/${documentId}/versions/${versionId}`)
            show('버전이 삭제되었습니다.', 'success')
            fetchDetails()
            onUpdate()
        } catch (err) {
            console.error(err)
            show('버전 삭제 실패', 'error')
        }
    }

    // Consolidated File Open Handler
    const handlePrint = (fileUrl?: string, versionId?: string) => {
        let baseURL = apiClient.defaults.baseURL || '/api'
        if (typeof baseURL === 'string' && !baseURL.startsWith('http')) {
            baseURL = `${window.location.origin}${baseURL.startsWith('/') ? '' : '/'}${baseURL}`
        }
        if (typeof baseURL === 'string') {
            baseURL = baseURL.replace(/\/$/, '')
        }

        const ext = fileUrl ? fileUrl.split('.').pop() : 'pdf'
        const safeName = data.name.replace(/[^a-zA-Z0-9가-힣\s\-_.]/g, '').trim()

        // CASE 1: Specific Version -> Use Version View Route
        if (versionId) {
            const finalName = `${safeName}_ver.${ext}`
            const targetUrl = `${baseURL}/docview/versions/${versionId}/${encodeURIComponent(finalName)}`
            if (!openPrintWindow(targetUrl, finalName)) {
                show('브라우저에서 새 탭을 열 수 없어 인쇄창을 띄울 수 없습니다.', 'error')
            }
            return
        }

        // CASE 2: Current Document (Default) -> Use Document View Route
        // This is used for the main "File View" / "Print" buttons
        const finalName = `${safeName}.${ext}`
        const targetUrl = `${baseURL}/docview/${documentId}/${encodeURIComponent(finalName)}`
        if (!openPrintWindow(targetUrl, finalName)) {
            show('브라우저에서 새 탭을 열 수 없어 인쇄창을 띄울 수 없습니다.', 'error')
        }
    }

    const handleVersionUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newVersionFile) {
            show('파일을 선택해주세요.', 'error')
            return
        }

        try {
            setIsUploadingVersion(true)
            const formData = new FormData()
            formData.append('file', newVersionFile)
            formData.append('changeLog', newVersionDesc)

            // Manual Version String (e.g. v1.1)
            if (newVersionString) {
                formData.append('version', newVersionString)
            }

            const baseURL = (apiClient.defaults.baseURL || '/api').replace(/\/$/, '')
            const response = await fetch(`${baseURL}/documents/${documentId}/versions`, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || `Upload failed with status ${response.status}`)
            }

            show('새 버전이 업로드되었습니다.', 'success')

            // Reset Form
            setNewVersionFile(null)
            setNewVersionDesc('')
            setNewVersionString('')
            if (fileInputRef.current) fileInputRef.current.value = ''
            setIsUploadingVersion(false)

            fetchDetails()
            onUpdate()
        } catch (err: any) {
            console.error(err)
            show('업로드 실패: ' + (err.message || 'Unknown error'), 'error')
        } finally {
            setIsUploadingVersion(false)
        }
    }

    if (!data && loading) return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '400px', textAlign: 'center', padding: '2rem' }}>
                <RefreshCw className="spin" size={24} style={{ margin: '0 auto 1rem' }} />
                <p>로딩 중...</p>
            </div>
        </div>
    )

    if (!data) return null

    const currentVersionObj = data.versions?.find((v: any) => v.version === data.current_version)
    const displayFilePath = currentVersionObj ? currentVersionObj.file_path : data.file_path
    // Remove timestamp/random prefix
    const fileName = displayFilePath ? displayFilePath.split('/').pop()?.replace(/^(\d+-)+/, '') : '파일 없음'
    const displayFileSize = currentVersionObj ? currentVersionObj.file_size : data.file_size

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '90vw' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px', height: '48px',
                            background: '#0b1324',
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.12)'
                        }}>
                            <FileText size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                            {isEditingName ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        style={{
                                            background: '#333', border: '1px solid #555', color: 'white',
                                            fontSize: '1.25rem', padding: '4px 8px', borderRadius: '4px', width: '100%'
                                        }}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleNameUpdate()
                                            if (e.key === 'Escape') {
                                                setEditName(data.name)
                                                setIsEditingName(false)
                                            }
                                        }}
                                    />
                                    <button
                                        className="icon-button"
                                        onClick={handleNameUpdate}
                                        title="저장"
                                        style={{ color: '#4c6ef5' }}
                                    >
                                        <Check size={20} />
                                    </button>
                                    <button
                                        className="icon-button"
                                        onClick={() => {
                                            setEditName(data.name)
                                            setIsEditingName(false)
                                        }}
                                        title="취소"
                                        style={{ color: '#fa5252' }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{data.name}</h3>
                                    <button
                                        className="icon-button"
                                        onClick={() => setIsEditingName(true)}
                                        title="문서명 변경"
                                        style={{ opacity: 0.5, padding: '4px' }}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                </div>
                            )}
                            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Ver. {data.current_version}
                            </p>
                        </div>
                    </div>
                    <button className="icon-button" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="tabs" style={{ padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
                    <button
                        className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                        style={{ padding: '1rem', background: 'none', border: 'none', color: activeTab === 'info' ? 'white' : '#868e96', cursor: 'pointer', borderBottom: activeTab === 'info' ? '2px solid #4c6ef5' : '2px solid transparent', fontSize: '1.1rem' }}
                    >
                        기본 정보
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                        style={{ padding: '1rem', background: 'none', border: 'none', color: activeTab === 'history' ? 'white' : '#868e96', cursor: 'pointer', borderBottom: activeTab === 'history' ? '2px solid #4c6ef5' : '2px solid transparent', fontSize: '1.1rem' }}
                    >
                        버전 이력
                    </button>
                </div>

                <div className="modal-body" style={{ minHeight: '300px' }}>
                    {activeTab === 'info' && (
                        <div>
                            <h4 className="section-title" style={{ color: '#e8ecf7', marginBottom: '1rem' }}>메타데이터</h4>

                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>첨부 파일</span>
                                <span
                                    style={{ color: '#74c0fc', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => handlePrint()}
                                >
                                    <FileText size={16} />
                                    <span style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>{fileName}</span>
                                    <span className="muted" style={{ fontSize: '0.9rem', textDecoration: 'none' }}>
                                        ({displayFileSize ? (displayFileSize / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'})
                                    </span>
                                </span>
                            </div>

                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>카테고리</span>
                                <span className="badge">{data.category}</span>
                            </div>
                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>문서 종류</span>
                                <span>{data.type}</span>
                            </div>
                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>상태</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={`badge ${data.status === 'APPROVED' ? 'badge-live' : 'badge-neutral'}`}>
                                        {data.status}
                                    </span>
                                    <select
                                        value={data.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        disabled={updatingStatus || data.status === 'APPROVED'}
                                        style={{
                                            padding: '2px 8px', borderRadius: '4px',
                                            background: data.status === 'APPROVED' ? '#222' : '#333',
                                            color: data.status === 'APPROVED' ? '#888' : 'white',
                                            border: '1px solid #555',
                                            fontSize: '0.8rem',
                                            cursor: data.status === 'APPROVED' ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="PENDING">PENDING</option>
                                        <option value="APPROVED">APPROVED</option>
                                        <option value="REJECTED">REJECTED</option>
                                    </select>
                                </div>
                            </div>
                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>보안 등급</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={`badge ${data.security_level === 'SECRET' ? 'badge-danger' : 'badge-neutral'}`}>
                                        {data.security_level}
                                    </span>
                                    <select
                                        value={data.security_level}
                                        onChange={(e) => handleSecurityChange(e.target.value)}
                                        style={{
                                            padding: '2px 8px', borderRadius: '4px',
                                            background: '#333',
                                            color: 'white',
                                            border: '1px solid #555',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="NORMAL">NORMAL</option>
                                        <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                                        <option value="SECRET">SECRET</option>
                                    </select>
                                </div>
                            </div>
                            <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                <span className="muted" style={{ width: '100px', display: 'inline-block' }}>생성일</span>
                                <span>{new Date(data.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 className="section-title" style={{ margin: 0, color: '#e8ecf7' }}>버전 히스토리</h4>
                                <button
                                    className="icon-button"
                                    onClick={() => {
                                        setIsUploadingVersion(!isUploadingVersion)
                                        setNewVersionFile(null)
                                        setNewVersionDesc('')
                                    }}
                                    title={isUploadingVersion ? "취소" : "새 버전 업로드"}
                                >
                                    {isUploadingVersion ? <X size={20} /> : <Plus size={20} color="white" />}
                                </button>
                            </div>

                            {isUploadingVersion && (
                                <form onSubmit={handleVersionUpload} style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={e => setNewVersionFile(e.target.files ? e.target.files[0] : null)}
                                            style={{ display: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="파일 선택"
                                            style={{
                                                background: newVersionFile ? 'rgba(76, 110, 245, 0.2)' : undefined,
                                                color: 'white',
                                                border: '1px solid rgba(255,255,255,0.2)'
                                            }}
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {newVersionFile ? (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#8bd3ff', paddingLeft: '4px' }}>
                                                    {newVersionFile.name}
                                                </span>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={newVersionString}
                                                        onChange={e => setNewVersionString(e.target.value)}
                                                        placeholder="버전 (예: v1.1)"
                                                        style={{
                                                            width: '120px',
                                                            padding: '0.4rem',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: 'none',
                                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '0',
                                                            color: 'white',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={newVersionDesc}
                                                        onChange={e => setNewVersionDesc(e.target.value)}
                                                        placeholder="개정 사유 (선택)"
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.4rem',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: 'none',
                                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '0',
                                                            color: 'white',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="muted" style={{ paddingLeft: '8px', fontSize: '0.9rem' }}>
                                                파일을 선택해주세요
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="icon-button"
                                        title="업로드"
                                        disabled={!newVersionFile}
                                        style={{
                                            color: 'white',
                                            opacity: newVersionFile ? 1 : 0.3,
                                            cursor: newVersionFile ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        <Upload size={18} />
                                    </button>
                                </form>
                            )}

                            <div className="history-list">
                                {data.versions && data.versions.map((ver: any) => (
                                    <div key={ver.id} className="history-item" style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '8px',
                                        marginBottom: '0.5rem',
                                        border: ver.version === data.current_version ? '1px solid #4c6ef5' : '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div className="version-badge" style={{
                                            background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: 'white',
                                            padding: '0.2rem 0.6rem', borderRadius: '4px',
                                        }}>{ver.version}</div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 500 }}>
                                                {ver.change_log || (ver.version === 'v1' ? '최초 업로드' : '버전 업데이트')}
                                            </p>
                                            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                                                {formatDateTime(ver.created_at)} • {(ver.file_size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {/* Open file using handlePrint logic if possible, or direct link */}
                                            <button
                                                className="icon-button"
                                                title="파일 보기"
                                                onClick={() => handlePrint(ver.file_path, ver.id)}
                                                style={{ color: '#8bd3ff' }}
                                            >
                                                <ExternalLink size={16} />
                                            </button>

                                            {data.status !== 'APPROVED' && data.versions && data.versions[0] && data.versions[0].id === ver.id && (
                                                <button
                                                    className="icon-button"
                                                    title="버전 삭제"
                                                    onClick={() => handleDeleteVersion(ver.id)}
                                                    style={{ color: '#fa5252' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!data.versions || data.versions.length === 0) && (
                                    <p className="muted text-center p-4">이력이 없습니다.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
