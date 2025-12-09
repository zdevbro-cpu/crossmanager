
import { useEffect, useState } from 'react'
import { Plus, FileText, Download, Calendar, User, X, Upload, MessageSquare } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { useToast } from '../components/ToastProvider'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import './Page.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface DocumentType {
  id: string
  category: string
  title: string
  description: string
  content_summary: string
  file_name: string
  file_size: number
  file_url: string
  uploaded_by: string
  upload_date: string
  projectId?: string
  project_id?: string
}

interface Comment {
  id: string
  commenter_name: string
  commenter_role: string
  comment: string
  created_at: string
}

export default function ReportsPage() {
  const { show: showToast } = useToast()
  const { selectedProjectId } = useProject()

  const [documents, setDocuments] = useState<DocumentType[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentType | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)

  const [userRole] = useState<'PM' | '경영자' | '일반'>('PM')
  const [userName] = useState('김철수')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  useEffect(() => {
    fetchProjects()
    fetchDocuments()
  }, [])

  const fetchProjects = async () => apiClient.get('/projects').then(res => setProjects(res.data))
  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get('/sms/documents')
      setDocuments(res.data)
      setLoading(false)
    } catch (err) {
      showToast('문서 로드 실패', 'error')
      setLoading(false)
    }
  }

  const fetchComments = async (docId: string) => {
    try {
      const res = await apiClient.get(`/sms/documents/${docId}/comments`)
      setComments(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const onSubmit = async (data: any) => {
    try {
      await apiClient.post('/sms/documents', { ...data, file_url: uploadedFile })
      showToast('문서가 등록되었습니다.', 'success')
      setIsModalOpen(false)
      reset()
      setUploadedFile(null)
      fetchDocuments()
    } catch { showToast('등록 실패', 'error') }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedFile(reader.result as string)
      showToast(`${file.name} 업로드 완료`, 'success')
    }
    reader.readAsDataURL(file)
  }

  const handleAddComment = async () => {
    if (!selectedDoc || !newComment.trim()) return

    try {
      await apiClient.post(`/sms/documents/${selectedDoc.id}/comments`, {
        commenter_name: userName,
        commenter_role: userRole,
        comment: newComment
      })
      showToast('코멘트가 등록되었습니다.', 'success')
      setNewComment('')
      fetchComments(selectedDoc.id)
    } catch {
      showToast('코멘트 등록 실패', 'error')
    }
  }

  const openDocumentDetail = (doc: DocumentType) => {
    setSelectedDoc(doc)
    setPageNumber(1)
    fetchComments(doc.id)
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const categories = [
    { value: 'ALL', label: '전체', color: 'badge', borderColor: '#e0e0e0' },
    { value: '안전관리비', label: '안전관리비', color: 'badge-primary', borderColor: 'var(--primary)' },
    { value: '주간보고', label: '주간보고', color: 'badge-live', borderColor: '#10b981' },
    { value: '월간보고', label: '월간보고', color: 'badge-error', borderColor: '#ef4444' },
    { value: '검사보고', label: '검사보고', color: 'badge-tag', borderColor: '#6b7280' },
    { value: '기타', label: '기\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0타', color: 'badge', borderColor: '#e0e0e0' }
  ]

  const filteredDocs = documents.filter(doc => {
    const matchCategory = selectedCategory === 'ALL' || doc.category === selectedCategory
    const matchProject = selectedProjectId === 'ALL' || doc.projectId === selectedProjectId || doc.project_id === selectedProjectId
    return matchCategory && matchProject
  })

  const getCategoryBadge = (category: string) => {
    const cat = categories.find(c => c.value === category)
    const colorClass = cat?.color || 'badge'
    const borderColor = cat?.borderColor || '#e0e0e0'

    return <span className={`badge ${colorClass}`} style={{
      fontWeight: 600,
      padding: '0.4rem 0.8rem',
      fontSize: '0.85rem',
      border: `2px solid ${borderColor}`
    }}>{cat?.label || category}</span>
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const canComment = userRole === 'PM' || userRole === '경영자'
  const canUpload = userRole === '일반'

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>보고 / 문서 (Reports)</h1>
          <p className="muted">
            안전관리비 사용 내역 및 각종 안전 보고서를 관리합니다.
            {canComment && <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>● {userRole} 권한 (조회 전용)</span>}
            {canUpload && <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>● 일반 권한 (등록 가능)</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {canUpload && (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> 문서 등록
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat.value}
            className={selectedCategory === cat.value ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setSelectedCategory(cat.value)}
            style={{ minWidth: 'auto' }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid three">
        {filteredDocs.map(doc => (
          <div
            key={doc.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => openDocumentDetail(doc)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              {getCategoryBadge(doc.category)}
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                {formatFileSize(doc.file_size)}
              </span>
            </div>

            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>{doc.title}</h3>

            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {doc.content_summary || doc.description}
            </p>

            <div className="milestone-meta">
              <Calendar size={14} /> {new Date(doc.upload_date).toLocaleDateString()}
              <span style={{ margin: '0 0.5rem' }}>|</span>
              <User size={14} /> {doc.uploaded_by}
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && !loading && (
        <section className="empty-state">
          <FileText size={48} className="empty-icon" />
          <h3>등록된 문서가 없습니다.</h3>
          <p>선택한 프로젝트/카테고리에 해당하는 문서가 없습니다.</p>
        </section>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="modal-header">
              <h2>문서 등록</h2>
              <button className="btn-text" onClick={() => { setIsModalOpen(false); setUploadedFile(null); }}><X size={24} /></button>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="modal-body">
              <div className="form-group">
                <label>프로젝트</label>
                <select className="input" {...register('projectId', { required: true })}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>카테고리</label>
                  <select className="input" {...register('category', { required: true })}>
                    <option value="안전관리비">안전관리비</option>
                    <option value="주간보고">주간보고</option>
                    <option value="월간보고">월간보고</option>
                    <option value="검사보고">검사보고</option>
                    <option value="기타">기{'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}타</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>작성자</label>
                  <input className="input" {...register('uploaded_by', { required: true })} placeholder="홍길동" />
                </div>
              </div>

              <div className="form-group">
                <label>제목</label>
                <input className="input" {...register('title', { required: true })} placeholder="2023년 12월 안전관리비 사용 내역" />
              </div>

              <div className="form-group">
                <label>보고 내용 (요약)</label>
                <textarea className="input" rows={4} {...register('content_summary', { required: true })} placeholder="보고서의 핵심 내용을 3-5줄로 요약하여 입력하세요." />
              </div>

              <div className="form-group">
                <label>파일 첨부 (PDF)</label>
                <div style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', background: 'var(--bg-surface-hover)' }}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={32} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 600 }}>클릭하여 PDF 파일 업로드</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>PDF 파일만 지원됩니다</p>
                  </label>
                  {uploadedFile && (
                    <p style={{ marginTop: '1rem', color: 'var(--primary)', fontWeight: 600 }}>✓ 파일 업로드 완료</p>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setUploadedFile(null); }}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || !uploadedFile}>
                  {isSubmitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '95%', height: '75vh', maxHeight: 'none', display: 'flex', flexDirection: 'column' }}>
            <header className="modal-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  {getCategoryBadge(selectedDoc.category)}
                  <span className="task-id" style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                    {(selectedDoc.projectId && projects.find(p => p.id === selectedDoc.projectId)?.name)
                      || (selectedDoc.project_id && projects.find(p => p.id === selectedDoc.project_id)?.name)
                      || (selectedProjectId !== 'ALL' && projects.find(p => p.id === selectedProjectId)?.name)
                      || '프로젝트 정보 없음'}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', wordBreak: 'break-all' }}>제목: {selectedDoc.title}</h2>
              </div>
              <button className="btn-text" onClick={() => setSelectedDoc(null)}><X size={24} /></button>
            </header>

            <div className="modal-body" style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* PDF Viewer (Expanded) */}
              <div style={{ background: '#525252', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <FileText size={16} /> 문서 뷰어
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    >
                      ◀
                    </button>
                    <span style={{ color: '#fff', fontSize: '0.75rem' }}>
                      {pageNumber} / {numPages || '?'}
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: '4px', overflow: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0.5rem' }}>
                  {selectedDoc.file_url ? (
                    <PDFDocument
                      file={selectedDoc.file_url}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<div style={{ padding: '2rem', textAlign: 'center' }}>PDF 로딩 중...</div>}
                      error={<div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>PDF를 불러올 수 없습니다.</div>}
                    >
                      <Page pageNumber={pageNumber} width={450} />
                    </PDFDocument>
                  ) : (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                      <FileText size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.9rem' }}>미리보기 불가</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Info (Compact) */}
              <div style={{ flexShrink: 0 }}>
                <button className="btn-primary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}>
                  <Download size={16} style={{ marginRight: '0.5rem' }} /> 파일 다운로드
                </button>

                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', justifyContent: 'center' }}>
                  <span style={{ color: '#93c5fd' }}>작성자 :</span>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{selectedDoc.uploaded_by}</strong>
                  <span style={{ width: '1px', height: '12px', background: '#525252' }}></span>
                  <span style={{ color: '#93c5fd' }}>작성일자 :</span>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{new Date(selectedDoc.upload_date).toLocaleDateString()}</strong>
                </div>
              </div>

              {/* Comments (Very Compact) */}
              <div className="panel" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', height: '150px', minHeight: '100px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <MessageSquare size={14} />
                  검토 의견 ({comments.length})
                </h3>

                <div className="list-group" style={{ flex: 1, overflowY: 'auto', marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem' }}>
                  {comments.map(comment => (
                    <div key={comment.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '0.4rem', borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.1rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.75rem' }}>{comment.commenter_name}</strong>
                          <span className={`badge ${comment.commenter_role === 'PM' ? 'badge-primary' : 'badge-error'}`} style={{ marginLeft: '0.3rem', fontSize: '0.6rem', padding: '0 0.2rem' }}>
                            {comment.commenter_role}
                          </span>
                        </div>
                        <span className="muted" style={{ fontSize: '0.65rem' }}>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>{comment.comment}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                      <p style={{ fontSize: '0.75rem', margin: 0 }}>의견 없음</p>
                    </div>
                  )}
                </div>

                {canComment && (
                  <div style={{ flexShrink: 0, display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input"
                      placeholder="의견 입력..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{ flex: 1, marginBottom: 0, fontSize: '0.8rem', padding: '0.3rem' }}
                    />
                    <button className="btn-primary" onClick={handleAddComment} disabled={!newComment.trim()} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                      등록
                    </button>
                  </div>
                )}

                {!canComment && (
                  <div style={{ padding: '0.3rem', background: 'var(--bg-surface-hover)', textAlign: 'center', borderRadius: '4px' }}>
                    <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>작성 권한 없음</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
