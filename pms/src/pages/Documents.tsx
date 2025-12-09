
import './Page.css'
import { useEffect, useState } from 'react'
import { useDocuments } from '../hooks/useDocuments'
import { mockDocuments, mockProjects } from '../data/mock'
import type { DocumentMeta } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { Trash2, Plus, Pencil, Check } from 'lucide-react'

function DocumentsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  const { data, isLoading, isError } = useDocuments()
  const [docs, setDocs] = useState<DocumentMeta[]>(mockDocuments)
  const [msg, setMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (data) setDocs(data)
  }, [data])

  const filtered = docs.filter((d) => !selectedId || d.projectId === selectedId)

  const [form, setForm] = useState({
    projectId: selectedId || 'p1',
    name: '',
    type: '도면',
    url: '',
  })

  useEffect(() => {
    if (selectedId) setForm((prev) => ({ ...prev, projectId: selectedId }))
  }, [selectedId])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name) {
      setMsg('문서명을 입력해주세요.')
      show('문서명을 입력해주세요.', 'warning')
      return
    }
    const newDoc: DocumentMeta = {
      id: editingId ?? crypto.randomUUID(),
      projectId: form.projectId,
      name: form.name,
      type: form.type as DocumentMeta['kind'],
      url: form.url || '#',
    } as DocumentMeta & { url?: string }

    // TODO: 백엔드 API 연동
    setDocs((prev) => (editingId ? prev.map((d) => (d.id === editingId ? newDoc : d)) : [newDoc, ...prev]))
    setMsg(editingId ? '화면에서 수정했습니다. (DB 저장을 위해 백엔드 구현 필요)' : '화면에만 추가했습니다. (DB 저장을 위해 백엔드 구현 필요)')
    show(editingId ? '화면에서 수정했습니다.' : '화면에만 추가했습니다.', 'info')

    setForm({ ...form, name: '', url: '' })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return

    // TODO: 백엔드 API 연동
    setDocs((prev) => prev.filter((d) => d.id !== id))
    setMsg('삭제했습니다. (DB 삭제를 위해 백엔드 구현 필요)')
    show('삭제했습니다.', 'success')
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">문서/보고 자동화</p>
          <h2>문서 구조화 저장, 고객사 보고 양식 자동 변환</h2>
          <p className="muted">도면/계약서/허가서를 프로젝트별로 정리하고, 고객사별 보고 양식을 자동 변환합니다.</p>
        </div>
        <div className="pill pill-outline">문서 구조화 · 양식 변환</div>
      </header>

      <section className="card table-card">
        <div className="table-head">
          <p className="card-label">문서 목록 (선택한 프로젝트)</p>
          <div className="table-actions">
            <button className="pill pill-outline">양식 변환 (준비 중)</button>
          </div>
        </div>
        {msg && <p className="muted">{msg}</p>}
        {isLoading && <p className="muted">불러오는 중...</p>}
        {isError && <p className="muted">불러오기 오류, 새로고침 해주세요.</p>}
        <div className="table">
          <div className="table-row table-header">
            <span>프로젝트</span>
            <span>문서명</span>
            <span>유형</span>
            <span>링크</span>
            <span>관리</span>
          </div>
          {filtered.map((d) => {
            const project = mockProjects.find((p) => p.id === d.projectId)
            return (
              <div key={d.id} className="table-row">
                <span>{project?.name ?? d.projectId}</span>
                <span>{d.name}</span>
                <span>{d.type}</span>
                <span>
                  <a href={d.url} target="_blank" rel="noreferrer">
                    열기
                  </a>
                </span>
                <span className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(d.id)
                      setForm({
                        projectId: d.projectId || 'p1',
                        name: d.name,
                        type: d.type || '',
                        url: d.url || '',
                      })
                    }}
                    aria-label="편집"
                    title="편집"
                  >
                    <Pencil size={18} />
                  </button>
                  <button className="icon-button" onClick={() => handleDelete(d.id)} aria-label="삭제" title="삭제">
                    <Trash2 size={18} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <p className="card-label">{editingId ? '문서 수정' : '문서 추가'}</p>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            <span>프로젝트</span>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {mockProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>문서명</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            <span>유형</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="도면">도면</option>
              <option value="계약서">계약서</option>
              <option value="허가서">허가서</option>
              <option value="기타">기타</option>
            </select>
          </label>
          <label>
            <span>링크</span>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit" className="icon-button" aria-label="추가">
              {editingId ? <Check size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </form>
      </section>

      <section className="grid two">
        <article className="card">
          <p className="card-label">핵심 기능</p>
          <ul className="list">
            <li>도면/계약서/허가서 구조화 저장, 링크 관리</li>
            <li>고객사 보고 양식 자동 변환 준비</li>
            <li>사진·이슈 자동 삽입 준비(보고 자동화)</li>
          </ul>
        </article>
        <article className="card">
          <p className="card-label">데이터 키</p>
          <ul className="list">
            <li>`documents`: {'{projectId, name, type, url}'}</li>
            <li>파일 스토리지 연계 시 Storage 보안 규칙 준수</li>
          </ul>
        </article>
      </section>
    </div>
  )
}

export default DocumentsPage
