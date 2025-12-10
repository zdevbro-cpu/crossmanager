import { useState, useEffect } from 'react'
import { X, FileText, Upload, ExternalLink, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useToast } from './ToastProvider'

interface DocumentDetailModalProps {
    documentId: string
    onClose: () => void
    onUpdate: () => void
}

const getDownloadUrl = (path?: string) => {
    if (!path) return '#'
    return `http://localhost:3005/${path}`
}

const formatDate = (dateInput: any) => {
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
        timeZone: 'Asia/Seoul'
    }).format(date)
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

export default function DocumentDetailModal({ documentId, onClose, onUpdate }: DocumentDetailModalProps) {
    const { show } = useToast()
    const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [isUploadingVersion, setIsUploadingVersion] = useState(false)
    const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
    const [newVersionDesc, setNewVersionDesc] = useState('')
    const [newVersionString, setNewVersionString] = useState('')

    useEffect(() => {
        fetchDetails()
    }, [documentId])

    const fetchDetails = async () => {
        try {
            setLoading(true)
            const res = await apiClient.get(`/documents/${documentId}`)
            setData(res.data)
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
            await apiClient.patch(`/documents/${documentId}/status`, { status: newStatus })
            show('상태가 변경되었습니다.', 'success')
            fetchDetails()
            onUpdate()
        } catch (err) {
            show('상태 변경 실패', 'error')
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleDeleteVersion = async (versionId: string) => {
        if (data.status === 'APPROVED') {
            show('승인된 문서는 버전을 삭제할 수 없습니다.', 'error')
            return
        }

        // Check if it is the latest version
        // Assuming versions are sorted by created_at DESC (backend does this)
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

    const handleVersionUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newVersionFile) {
            show('파일을 선택해주세요.', 'error')
            return
        }

        try {
            const formData = new FormData()
            formData.append('file', newVersionFile)
            formData.append('change_log', newVersionDesc)
            formData.append('version', newVersionString) // Send manual version

            await apiClient.post(`/documents/${documentId}/versions`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            show('새 버전이 업로드되었습니다.', 'success')
            setIsUploadingVersion(false)
            setNewVersionFile(null)
            setNewVersionDesc('')
            setNewVersionString('') // Reset version string
            fetchDetails()
            onUpdate()
        } catch (err) {
            console.error(err)
            show('버전 업로드 실패', 'error')
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
    // Use current version's file info if available, otherwise document's base info
    const displayFilePath = currentVersionObj ? currentVersionObj.file_path : data.file_path
    const fileName = displayFilePath ? displayFilePath.split('/').pop()?.replace(/^\d+-\d+-/, '') : '파일 없음'
    const fileExt = fileName !== '파일 없음' ? fileName.split('.').pop()?.toUpperCase() : '-'
    const displayFileSize = currentVersionObj ? currentVersionObj.file_size : data.file_size
    const displayDate = currentVersionObj ? currentVersionObj.created_at : data.created_at

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '90vw' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px', height: '48px',
                            background: '#0b1324', // Deep Navy from Design System
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.12)'
                        }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{fileName}</h3>
                            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Ver. {data.current_version}
                            </p>
                        </div>
                    </div>
                    <button
                        className="icon-button"
                        onClick={onClose}
                        title="닫기"
                    >
                        <X size={24} />
                    </button>
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
                        <div className="grid two">
                            <div>
                                <h4 className="section-title" style={{ color: '#e8ecf7', marginBottom: '1rem' }}>메타데이터</h4>
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
                                    <span>{data.security_level}</span>
                                </div>
                                <div className="detail-row" style={{ marginBottom: '0.8rem' }}>
                                    <span className="muted" style={{ width: '100px', display: 'inline-block' }}>생성일</span>
                                    <span>{new Date(data.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="section-title" style={{ color: '#e8ecf7', marginBottom: '1rem' }}>파일 정보</h4>
                                <div className="file-preview-placeholder" style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '8px',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    border: '1px dashed rgba(255,255,255,0.1)'
                                }}>
                                    <FileText size={48} className="muted" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                    <a
                                        href={getDownloadUrl(displayFilePath)}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="파일 보기"
                                        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                                    >
                                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px', color: '#8bd3ff' }}>
                                            {fileName}
                                        </p>
                                    </a>
                                    <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                        {displayFileSize ? (displayFileSize / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'} • {fileExt}
                                    </p>
                                    <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                                        업로드: {formatDate(displayDate)}
                                    </p>

                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                        {data.file_path && (
                                            <a
                                                href={getDownloadUrl(data.file_path)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-primary"
                                                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                                            >
                                                <ExternalLink size={16} style={{ marginRight: '6px' }} /> 파일 보기
                                            </a>
                                        )}
                                    </div>
                                </div>
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
                                        if (isUploadingVersion) {
                                            setNewVersionFile(null);
                                            setNewVersionDesc('');
                                            setIsUploadingVersion(false);
                                        } else {
                                            setIsUploadingVersion(true);
                                        }
                                    }}
                                    title={isUploadingVersion ? "취소" : "새 버전 업로드"}
                                    style={!isUploadingVersion ? {
                                        background: '#0b1324',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    } : {}}
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
                                    {/* File Select */}
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="version-file-input"
                                            type="file"
                                            onChange={e => setNewVersionFile(e.target.files ? e.target.files[0] : null)}
                                            style={{ display: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => document.getElementById('version-file-input')?.click()}
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

                                    {/* Content Area */}
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
                                                        placeholder="개정 사유 입력 (선택)"
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
                                                왼쪽 버튼을 눌러 파일을 선택하세요 (여러 파일은 .zip 권장)
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                                    </div>
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
                                            <a href={getDownloadUrl(ver.file_path)} target="_blank" rel="noreferrer" className="icon-button" title="다운로드" style={{ color: '#8bd3ff' }}>
                                                <ExternalLink size={16} />
                                            </a>
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
