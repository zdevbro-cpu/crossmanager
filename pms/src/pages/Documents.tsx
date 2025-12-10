import './Page.css'
import { useState } from 'react'
import { useDocuments } from '../hooks/useDocuments'
import { useProjects } from '../hooks/useProjects'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { Trash2, Plus, Printer, FileText, Eye, Download } from 'lucide-react'
import DocumentUploadModal from '../components/DocumentUploadModal'
import DocumentDetailModal from '../components/DocumentDetailModal'

const getDownloadUrl = (path?: string) => {
  if (!path) return '#'
  return `http://localhost:3005/${path}`
}

function DocumentsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  const { data: docs, isLoading, isError, deleteDocument, refresh } = useDocuments(selectedId || undefined)
  const { data: projects } = useProjects()

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? (파일은 보존됩니다)')) return
    try {
      await deleteDocument(id)
      show('문서가 삭제되었습니다.', 'success')
    } catch (err) {
      show('삭제 실패', 'error')
    }
  }

  const handlePrint = async (path: string) => {
    if (!path) return
    const url = `http://localhost:3005/${path}`

    try {
      show('인쇄 준비 중...', 'info')
      const response = await fetch(url)
      const blob = await response.blob()

      // Allow PDF and Images
      if (!blob.type.includes('pdf') && !blob.type.includes('image')) {
        // For other files, just download/open? Or alert?
        // User requested "System Print Dialog".
        alert('인쇄는 PDF 또는 이미지 파일만 지원합니다.')
        return
      }

      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = blobUrl
      document.body.appendChild(iframe)

      iframe.onload = () => {
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(blobUrl)
        }, 5000) // Extended timeout to ensure print dialog doesn't break if removed too soon
      }
    } catch (e) {
      console.error(e)
      show('파일을 불러오는데 실패했습니다.', 'error')
    }
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">문서 통합 관리</p>
          <h2>프로젝트 문서 및 산출물 관리</h2>
          <p className="muted">계약서, 도면, 보고서 등 프로젝트의 모든 문서를 버전별로 관리합니다.</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsUploadOpen(true)}
            title="새 문서 업로드"
            style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>
      <section className="card table-card">
        {isLoading && <p className="muted p-4">문서 목록을 불러오는 중...</p>}
        {isError && <p className="muted p-4">오류가 발생했습니다.</p>}

        <div className="table">
          <div className="table-row table-header" style={{ gridTemplateColumns: 'minmax(150px, 1.2fr) 90px minmax(200px, 3fr) 80px 110px 100px 120px', gap: '8px' }}>
            <span>프로젝트</span>
            <span>구분</span>
            <span>문서명</span>
            <span style={{ textAlign: 'center' }}>버전</span>
            <span style={{ textAlign: 'center' }}>상태</span>
            <span style={{ textAlign: 'center' }}>크기</span>
            <span style={{ textAlign: 'center' }}>관리</span>
          </div>
          {docs?.length === 0 && !isLoading && (
            <div className="p-4 text-center muted">등록된 문서가 없습니다.</div>
          )}
          {docs?.map((d) => {
            const project = projects?.find((p) => p.id === d.projectId)
            return (
              <div key={d.id} className="table-row" style={{ gridTemplateColumns: 'minmax(150px, 1.2fr) 90px minmax(200px, 3fr) 80px 110px 100px 120px', gap: '8px' }}>
                <span className="truncate" title={project?.name}>{project?.name || '-'}</span>
                <span>
                  <span className="badge">{d.category}</span>
                </span>
                <span style={{ fontWeight: 500, color: '#e8ecf7', display: 'flex', alignItems: 'center' }} className="truncate">
                  <FileText size={16} style={{ marginRight: '8px', minWidth: '16px' }} />
                  <span className="truncate" title={d.name}>{d.name}</span>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <span className="badge badge-neutral">{d.currentVersion}</span>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <span className={`badge ${d.status === 'APPROVED' ? 'badge-live' : 'badge-neutral'}`}>
                    {d.status}
                  </span>
                </span>
                <span className="muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                  {d.fileSize ? (d.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                </span>
                <span className="row-actions" style={{ justifyContent: 'center', gap: '4px' }}>
                  <button
                    className="icon-button"
                    title="상세보기"
                    onClick={() => { setSelectedDocId(d.id); setIsDetailOpen(true); }}
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => handlePrint(d.filePath)}
                    title="인쇄"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}
                  >
                    <Printer size={16} />
                  </button>
                  {d.status !== 'APPROVED' && (
                    <button
                      className="icon-button"
                      onClick={() => handleDelete(d.id)}
                      aria-label="삭제"
                      title="삭제"
                      style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {isUploadOpen && (
        <DocumentUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={refresh}
        />
      )}

      {isDetailOpen && selectedDocId && (
        <DocumentDetailModal
          documentId={selectedDocId}
          onClose={() => setIsDetailOpen(false)}
          onUpdate={refresh}
        />
      )}
    </div>
  )
}

export default DocumentsPage

