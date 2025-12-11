import { useState } from 'react'
import { useDocuments } from '../hooks/useDocuments'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { FileText, Folder, FolderOpen, UploadCloud, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import DocumentUploadModal from '../components/DocumentUploadModal'
import DocumentDetailModal from '../components/DocumentDetailModal'
import { apiClient } from '../lib/api'
import type { PmsDocument } from '../types/pms'

interface ContextMenuState {
  x: number
  y: number
  type: 'HEADER' | 'FOLDER' | 'FILE'
  id?: string        // File ID
  category?: string  // Folder Category Name
  name?: string      // File Name
  filePath?: string  // File Path
  version?: string   // Current Version for display
}

interface DocumentTreeProps {
  docs: PmsDocument[]
  onDelete: (id: string, type: 'FILE' | 'FOLDER', category?: string) => void
  onPrint: (id: string, name: string, path?: string) => void
  onView: (id: string) => void
  onRename: (oldCategory: string) => void
  onUploadVersion: (id: string) => void
  onCreateFolder: () => void
  onUploadDocument: (category: string) => void
}

function DocumentTree({ docs, onDelete, onPrint, onView, onRename, onUploadVersion, onCreateFolder, onUploadDocument }: DocumentTreeProps) {
  // Group logic
  const grouped = docs.reduce((acc, doc) => {
    const cat = doc.category || '기타'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {} as Record<string, PmsDocument[]>)

  const sortedCategories = Object.keys(grouped).sort()

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const handleContextMenu = (e: React.MouseEvent, type: 'HEADER' | 'FOLDER' | 'FILE', data: any) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      ...data
    })
  }

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle size={15} style={{ color: '#40c057', marginRight: 8, flexShrink: 0 }} />
      case 'REJECTED':
        return <AlertCircle size={15} style={{ color: '#fa5252', marginRight: 8, flexShrink: 0 }} />
      case 'PENDING':
        return <Clock size={15} style={{ color: '#fab005', marginRight: 8, flexShrink: 0 }} />
      case 'DRAFT':
      default:
        // Use standard file icon for drafts, slightly dimmed
        return <FileText size={15} style={{ color: '#868e96', marginRight: 8, flexShrink: 0 }} />
    }
  }

  if (docs.length === 0) return <div className="p-4 text-center muted" onContextMenu={(e) => handleContextMenu(e, 'HEADER', {})}>등록된 문서가 없습니다. (우클릭하여 폴더 생성)</div>

  return (
    <div
      onClick={() => setContextMenu(null)}
      onScroll={() => setContextMenu(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '1rem',
        padding: '4px'
      }}
    >
      {sortedCategories.map(cat => (
        <div
          key={cat}
          className="folder-card"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '400px', // Prevent super long cards
            overflow: 'hidden'
          }}
        >
          {/* Folder Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.2)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              cursor: 'context-menu',
              userSelect: 'none'
            }}
            onContextMenu={(e) => handleContextMenu(e, 'FOLDER', { category: cat })}
          >
            <FolderOpen size={18} style={{ marginRight: 10, color: '#ffd43b' }} />
            <span style={{ fontWeight: 600, color: '#ffec99', fontSize: '1rem', flex: 1 }}>
              {cat}
              <span style={{ fontSize: '0.8em', color: '#868e96', marginLeft: '8px', fontWeight: 400 }}>
                ({grouped[cat].filter(d => d.type !== 'FOLDER').length})
              </span>
            </span>
          </div>

          {/* File List (Scrollable Content) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {grouped[cat].filter(d => d.type !== 'FOLDER').length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#868e96', fontSize: '0.9rem' }}>
                (성생된 파일 없음)
              </div>
            ) : (
              grouped[cat].filter(d => d.type !== 'FOLDER').map(d => (
                <div
                  key={d.id}
                  className="file-item-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    // gap removed to control icon spacing manually
                    padding: '6px 16px',
                    cursor: 'context-menu',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    transition: 'background 0.1s'
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'FILE', { id: d.id, name: d.name, filePath: d.filePath, category: d.category, version: d.currentVersion })}
                  onDoubleClick={() => onView(d.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={`상태: ${d.status}`}
                >
                  {/* Status Icon replaces Dot + FileText */}
                  {renderStatusIcon(d.status)}

                  <span className="truncate" style={{ fontSize: '0.9rem', color: '#e8ecf7', flex: 1 }}>
                    {d.name}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      {/* Unified Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1a1d24',
            border: '1px solid #343a40',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 9999,
            minWidth: '180px',
            padding: '4px 0',
            fontSize: '0.9rem'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'HEADER' && (
            <div className="ctx-item" onClick={() => { onCreateFolder(); setContextMenu(null); }}>
              <FolderOpen size={14} style={{ marginRight: 8 }} /> 새 폴더 만들기
            </div>
          )}
          {contextMenu.type === 'FOLDER' && (
            <>
              <div className="ctx-item" onClick={() => { onUploadDocument(contextMenu.category!); setContextMenu(null); }}>
                <UploadCloud size={14} style={{ marginRight: 8 }} /> 새 문서 업로드
              </div>
              <div className="ctx-separator" style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
              <div className="ctx-item" onClick={() => { onRename(contextMenu.category!); setContextMenu(null); }}>
                <Folder size={14} style={{ marginRight: 8 }} /> 이름 변경
              </div>
              <div className="ctx-item delete" onClick={() => { onDelete(contextMenu.category!, 'FOLDER', contextMenu.category); setContextMenu(null); }}>
                <Folder size={14} style={{ marginRight: 8 }} /> 폴더 삭제
              </div>
            </>
          )}
          {contextMenu.type === 'FILE' && (
            <>
              <div className="ctx-item" onClick={() => { onView(contextMenu.id!); setContextMenu(null); }}>
                <FileText size={14} style={{ marginRight: 8 }} /> 상세보기
              </div>
              <div className="ctx-item" onClick={() => { onUploadVersion(contextMenu.id!); setContextMenu(null); }}>
                <UploadCloud size={14} style={{ marginRight: 8 }} /> 새 버전 업로드 <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#868e96' }}>({contextMenu.version})</span>
              </div>
              <div className="ctx-item" onClick={() => { onPrint(contextMenu.id!, contextMenu.name!, contextMenu.filePath); setContextMenu(null); }}>
                <FileText size={14} style={{ marginRight: 8 }} /> 인쇄 / 다운로드
              </div>
              <div className="ctx-separator" style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
              <div className="ctx-item delete" onClick={() => { onDelete(contextMenu.id!, 'FILE'); setContextMenu(null); }}>
                <FileText size={14} style={{ marginRight: 8 }} /> 삭제
              </div>
            </>
          )}
        </div>
      )}
      <style>{`
        .ctx-item { padding: 8px 16px; cursor: pointer; color: #e8ecf7; display: flex; align-items: center; transition: background 0.1s; }
        .ctx-item:hover { background: rgba(255,255,255,0.1); }
        .ctx-item.delete { color: #ff8787; }
        .ctx-item.delete:hover { background: rgba(255,100,100,0.1); }
      `}</style>
    </div>
  )
}

function DocumentsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: docs, isLoading, isError, deleteDocument, refresh } = useDocuments(selectedId || undefined)

  const [uploadModalState, setUploadModalState] = useState<{ open: boolean, category?: string }>({ open: false })
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailInitialTab, setDetailInitialTab] = useState<'info' | 'history'>('info')

  // API Actions
  const handleCreateFolder = async () => {
    const name = prompt('새 폴더 이름을 입력하세요:')
    if (!name || !name.trim()) return
    if (!selectedId) {
      show('프로젝트를 선택해주세요.', 'error')
      return
    }

    try {
      await apiClient.post('/documents/folder', { projectId: selectedId, category: name.trim() })
      show('폴더가 생성되었습니다.', 'success')
      refresh()
    } catch (e) {
      console.error(e)
      show('폴더 생성 실패', 'error')
    }
  }

  const handleRenameCategory = async (oldCategory: string) => {
    const newName = prompt('변경할 폴더 이름을 입력하세요:', oldCategory)
    if (!newName || !newName.trim() || newName === oldCategory) return

    try {
      await apiClient.patch('/documents/category', {
        projectId: selectedId,
        oldCategory,
        newCategory: newName.trim()
      })
      show('폴더 이름이 변경되었습니다.', 'success')
      refresh()
    } catch (e) {
      show('이름 변경 실패', 'error')
    }
  }

  const handleDelete = async (targetId: string, type: 'FILE' | 'FOLDER', category?: string) => {
    if (type === 'FOLDER') {
      if (!confirm(`'${category}' 폴더와 포함된 모든 파일이 삭제됩니다.\n계속하시겠습니까?`)) return
      try {
        await apiClient.delete(`/documents/category?projectId=${selectedId}&category=${encodeURIComponent(category!)}`)
        show('폴더가 삭제되었습니다.', 'success')
        refresh()
      } catch (e) {
        show('폴더 삭제 실패', 'error')
      }
    } else {
      if (!confirm('정말 삭제하시겠습니까? (파일은 보존됩니다)')) return
      try {
        await deleteDocument(targetId)
        show('문서가 삭제되었습니다.', 'success')
      } catch (err) {
        show('삭제 실패', 'error')
      }
    }
  }

  const handleUploadVersion = async (docId: string) => {
    setSelectedDocId(docId)
    setDetailInitialTab('history')
    setIsDetailOpen(true)
  }

  const handleUploadDocument = (category: string) => {
    setUploadModalState({ open: true, category })
  }

  const handlePrint = async (docId: string, docName: string, filePath?: string) => {
    if (!docId) return

    try {
      const ext = filePath ? filePath.split('.').pop() : 'pdf'
      const safeName = docName.replace(/[^a-zA-Z0-9가-힣\s\-_.]/g, '').trim()
      const finalName = `${safeName}.${ext}`

      // Build Absolute URL
      let baseURL = apiClient.defaults.baseURL || '/api'
      if (typeof baseURL === 'string' && !baseURL.startsWith('http')) {
        baseURL = `${window.location.origin}${baseURL.startsWith('/') ? '' : '/'}${baseURL}`
      }
      if (typeof baseURL === 'string') {
        baseURL = baseURL.replace(/\/$/, '')
      }

      // Open directly in new tab
      // Server sets Content-Disposition: inline, so browser will preview it.
      const targetUrl = `${baseURL}/docview/${docId}/${encodeURIComponent(finalName)}`
      window.open(targetUrl, '_blank')

    } catch (e) {
      console.error(e)
      show('파일을 여는 중 오류가 발생했습니다.', 'error')
    }
  }

  // We need to trigger header context menu from the page level or pass handler to a visible element
  // The 'table-header' is in Page
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number } | null>(null)

  return (
    <div className="page" onClick={() => setHeaderContextMenu(null)}>
      <header className="section-header">
        <div>
          <p className="eyebrow">문서 통합 관리</p>
          <h2>프로젝트 문서 및 산출물 관리</h2>
          <p className="muted">우클릭으로 폴더 및 문서를 관리할 수 있습니다.</p>
        </div>
      </header>
      <section className="card table-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {isLoading && <p className="muted p-4">문서 목록을 불러오는 중...</p>}
        {isError && <p className="muted p-4">오류가 발생했습니다.</p>}

        <div className="folder-grid-container" style={{ width: '100%', minHeight: '500px' }}>
          {/* Header Area (Optional, for creating folder via right click on empty space) */}
          <div
            className="table-header-context-area"
            style={{
              marginBottom: '1rem',
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: 'context-menu',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setHeaderContextMenu({ x: e.clientX, y: e.clientY })
            }}
          >
            <span style={{ fontWeight: 500, color: '#e8ecf7' }}>
              프로젝트 산출물 (폴더 생성 : 우클릭)
            </span>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              <FolderOpen size={14} style={{ display: 'inline', marginRight: 4 }} />
              총 {docs ? docs.length : 0}개 파일
            </span>
          </div>

          <DocumentTree
            docs={docs || []}
            onDelete={handleDelete}
            onPrint={handlePrint}
            onView={(id) => { setSelectedDocId(id); setDetailInitialTab('info'); setIsDetailOpen(true); }}
            onRename={handleRenameCategory}
            onUploadVersion={handleUploadVersion}
            onCreateFolder={handleCreateFolder}
            onUploadDocument={handleUploadDocument}
          />

        </div>
      </section>

      {/* Header Context Menu (Page Level) */}
      {headerContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: headerContextMenu.y,
            left: headerContextMenu.x,
            background: '#1a1d24',
            border: '1px solid #343a40',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 9999,
            minWidth: '160px',
            padding: '4px 0',
            fontSize: '0.9rem'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ctx-item" onClick={() => { handleCreateFolder(); setHeaderContextMenu(null); }}>
            <FolderOpen size={14} style={{ marginRight: 8 }} /> 새 폴더 만들기
          </div>
          <style>{`
            .ctx-item { padding: 8px 16px; cursor: pointer; color: #e8ecf7; display: flex; align-items: center; transition: background 0.1s; }
            .ctx-item:hover { background: rgba(255,255,255,0.1); }
          `}</style>
        </div>
      )}

      {uploadModalState.open && (
        <DocumentUploadModal
          initialCategory={uploadModalState.category}
          onClose={() => setUploadModalState({ open: false })}
          onSuccess={refresh}
        />
      )}

      {isDetailOpen && selectedDocId && (
        <DocumentDetailModal
          documentId={selectedDocId}
          onClose={() => setIsDetailOpen(false)}
          onUpdate={refresh}
          initialTab={detailInitialTab}
        />
      )}
    </div>
  )
}

export default DocumentsPage
