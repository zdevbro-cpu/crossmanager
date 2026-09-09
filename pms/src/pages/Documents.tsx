import { useState } from 'react'
import { useDocuments } from '../hooks/useDocuments'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { FileText, Folder, FolderOpen, UploadCloud, CheckCircle, AlertCircle, Clock, Lock, Pencil } from 'lucide-react'
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
  securityLevel?: string
}

interface DocumentTreeProps {
  docs: PmsDocument[]
  onDelete: (id: string, type: 'FILE' | 'FOLDER', category?: string) => void
  onPrint: (id: string, name: string, path?: string) => void
  onView: (id: string) => void
  onRename: (oldCategory: string) => void
  onRenameFile: (id: string, currentName: string) => void
  onUploadVersion: (id: string) => void
  onCreateFolder: () => void
  onUploadDocument: (category: string) => void
}

function DocumentTree({ docs, onDelete, onPrint, onView, onRename, onRenameFile, onUploadVersion, onCreateFolder, onUploadDocument }: DocumentTreeProps) {
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


  /* DEBUG: Check levels */
  // console.log('Docs Levels:', docs.map(d => ({ name: d.name, level: d.security_level })))

  const renderSecurityIcon = (level?: string) => {
    const safeLevel = (level || 'NORMAL').toUpperCase()

    if (safeLevel === 'SECRET' || safeLevel === 'TOP_SECRET') {
      return <span title={`보안등급: ${safeLevel}`}><Lock size={15} style={{ color: '#ff6b6b', marginRight: 8, flexShrink: 0 }} /></span> // Red
    }
    if (safeLevel === 'CONFIDENTIAL') {
      return <span title={`보안등급: ${safeLevel}`}><Lock size={15} style={{ color: '#ff922b', marginRight: 8, flexShrink: 0 }} /></span> // Orange
    }
    // NORMAL or others -> Blue
    return <span title={`보안등급: ${safeLevel}`}><Lock size={15} style={{ color: '#339af0', marginRight: 8, flexShrink: 0 }} /></span> // Blue
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

  if (docs.length === 0) return <div className="p-4 text-center muted" onContextMenu={(e) => handleContextMenu(e, 'HEADER', {})}>등록된 문서가 없습니다. (우클릭해서 새 폴더/문서를 추가하세요)</div>

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
                (폴더에 파일 없음)
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
                  onContextMenu={(e) => handleContextMenu(e, 'FILE', {
                    id: d.id,
                    name: d.name,
                    filePath: d.filePath,
                    category: d.category,
                    version: d.currentVersion,
                    securityLevel: d.security_level
                  })}
                  onDoubleClick={() => onView(d.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={`?곹깭: ${d.status}`}
                >
                  {/* Status Icon */}
                  {renderStatusIcon(d.status)}
                  {/* Security Icon (Left of Filename) */}
                  {renderSecurityIcon(d.security_level)}

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
                <UploadCloud size={14} style={{ marginRight: 8 }} /> 문서 업로드
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
              {contextMenu.securityLevel && (
                <div className="ctx-item" style={{ cursor: 'default' }}>
                  <Lock size={14} style={{
                    marginRight: 8,
                    color: (contextMenu.securityLevel === 'SECRET' || contextMenu.securityLevel === 'TOP_SECRET') ? '#ff6b6b' :
                      (contextMenu.securityLevel === 'CONFIDENTIAL') ? '#ff922b' : '#339af0'
                  }} />
                  <span className="muted" style={{ fontSize: "0.85rem" }}>보안등급: {contextMenu.securityLevel}</span>
                </div>
              )}
              <div className="ctx-item" onClick={() => { onView(contextMenu.id!); setContextMenu(null); }}>
                <FileText size={14} style={{ marginRight: 8 }} /> 상세보기
              </div>
              <div className="ctx-item" onClick={() => { onUploadVersion(contextMenu.id!); setContextMenu(null); }}>
                <UploadCloud size={14} style={{ marginRight: 8 }} /> 새 버전 업로드
              </div>
              <div className="ctx-item" onClick={() => { onRenameFile(contextMenu.id!, contextMenu.name!); setContextMenu(null); }}>
                <Pencil size={14} style={{ marginRight: 8 }} /> 파일명 변경
              </div>
              <div className="ctx-item" onClick={() => { onPrint(contextMenu.id!, contextMenu.name!, contextMenu.filePath); setContextMenu(null); }}>
                <FileText size={14} style={{ marginRight: 8 }} /> 인쇄
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
    const name = prompt('새 폴더 이름을 입력해주세요.')
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
    const newName = prompt('변경할 폴더 이름을 입력해주세요.', oldCategory)
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
      show('폴더 이름 변경 실패', 'error')
    }
  }

  const handleDelete = async (targetId: string, type: 'FILE' | 'FOLDER', category?: string) => {
    if (type === 'FOLDER') {
      if (!confirm(`'${category}' 폴더와 포함된 모든 파일을 삭제할까요?\n계속하시겠습니까?`)) return
      try {
        await apiClient.delete(`/documents/category?projectId=${selectedId}&category=${encodeURIComponent(category!)}`)
        show('폴더가 삭제되었습니다.', 'success')
        refresh()
      } catch (e) {
        show('폴더 삭제 실패', 'error')
      }
    } else {
      if (!confirm('정말 삭제하시겠습니까? (파일은 복구되지 않습니다)')) return
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

  const handlePrint = async (docId: string, _docName: string, _filePath?: string) => {
    if (!docId) return

    try {
      // Fetch as Blob
      const response = await apiClient.get(`/docview/${docId}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)

      // Hidden iframe strategy: skip visible preview window, go straight to print dialog
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.src = blobUrl

      iframe.onload = () => {
        try {
          const win = iframe.contentWindow
          if (!win) throw new Error('iframe window not available')

          const cleanup = () => {
            URL.revokeObjectURL(blobUrl)
            iframe.remove()
          }

          // Most browsers fire afterprint when dialog closes; fallback timer added
          win.addEventListener('afterprint', cleanup)

          win.focus()
          win.print()

          // Fallback cleanup in case afterprint never fires
          setTimeout(cleanup, 15000)
        } catch (err) {
          console.error('Auto print failed:', err)
          show('Failed to open print dialog. Check popup blocker.', 'error')
        }
      }

      document.body.appendChild(iframe)

    } catch (e) {
      console.error(e)
      show('Failed to load file for printing.', 'error')
    }
  }

  const handleRenameFile = async (id: string, currentName: string) => {
    const newName = prompt('파일명을 입력해주세요.', currentName)
    if (!newName || newName === currentName) return

    try {
      await apiClient.patch(`/documents/${id}`, { name: newName })
      refresh()
      show('파일명이 변경되었습니다.', 'success')
    } catch (err: any) {
      show('파일명 변경 실패: ' + (err.response?.data?.error || err.message), 'error')
    }
  }

  // We need to trigger header context menu from the page level or pass handler to a visible element
  // The 'table-header' is in Page
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number } | null>(null)

  return (
    <div className="page" onClick={() => setHeaderContextMenu(null)}>
      <header className="section-header">
        <div>
          <p className="eyebrow">문서 종합 관리</p>
          <h2>프로젝트 문서 배포·출력 관리</h2>
          <p className="muted">프로젝트별 모든 문서를 한곳에서 관리하고 인쇄합니다.</p>
        </div>
      </header>
      <section className="card table-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {isLoading && <p className="muted p-4">문서 목록을 불러오는 중입니다.</p>}
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
              프로젝트 문서 현황
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
            onRenameFile={handleRenameFile}
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












