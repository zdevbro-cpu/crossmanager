
import './Page.css'
import { useReports } from '../hooks/useReports'
import { mockProjects, mockReports } from '../data/mock'
import { useEffect, useState } from 'react'
import type { ReportMeta } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { validateDateRange } from '../utils/validation'
import { Trash2, Plus, Pencil, Check } from 'lucide-react'
import { useRole } from '../hooks/useRole'

function ReportsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  const { data, isLoading, isError } = useReports()
  const [reports, setReports] = useState<ReportMeta[]>(mockReports)
  const [msg, setMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { role } = useRole()
  const canDeleteReports = role !== 'field'

  useEffect(() => {
    if (data) setReports(data)
  }, [data])

  const filtered = reports.filter((r) => !selectedId || r.projectId === selectedId)

  const [form, setForm] = useState({
    projectId: selectedId || 'p1',
    type: '주간',
    period: '',
    format: '삼성',
    createdAt: '',
  })

  useEffect(() => {
    if (selectedId) setForm((prev) => ({ ...prev, projectId: selectedId }))
  }, [selectedId])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.period) {
      setMsg('기간은 필수입니다.')
      show('기간은 필수입니다.', 'warning')
      return
    }
    if (form.createdAt && validateDateRange(form.createdAt, form.createdAt)) {
      // 단일 날짜는 추가 검증 불필요
    }
    const newReport: ReportMeta = {
      id: editingId ?? crypto.randomUUID(),
      projectId: form.projectId,
      type: form.type as ReportMeta['type'],
      period: form.period,
      format: form.format as ReportMeta['format'],
      createdAt: form.createdAt || new Date().toISOString().slice(0, 10),
    }

    // TODO: 백엔드 API 연동
    setReports((prev) => (editingId ? prev.map((r) => (r.id === editingId ? newReport : r)) : [newReport, ...prev]))
    setMsg(editingId ? '화면에서 수정했습니다. (DB 구현 필요)' : '화면에만 추가했습니다. (DB 구현 필요)')
    show(editingId ? '화면에서 수정했습니다.' : '화면에만 추가했습니다.', 'info')

    setForm({ ...form, period: '', createdAt: '' })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!canDeleteReports) {
      show('현장근무 역할은 보고 삭제 권한이 없습니다.', 'warning')
      return
    }
    if (!confirm('삭제하시겠습니까?')) return

    // TODO: 백엔드 API 연동
    setReports((prev) => prev.filter((r) => r.id !== id))
    setMsg('삭제했습니다. (DB 구현 필요)')
    show('삭제했습니다.', 'success')
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">문서/보고 자동화</p>
          <h2>일일·주간·월간 보고서 자동 생성 + 고객사 양식 변환</h2>
          <p className="muted">선택한 프로젝트의 보고서를 관리하고, 고객사별 템플릿을 적용합니다.</p>
        </div>
        <div className="pill pill-outline">Cloud Functions · 템플릿 변환</div>
      </header>

      <section className="card table-card">
        <div className="table-head">
          <p className="card-label">보고서 (선택한 프로젝트)</p>
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
            <span>유형</span>
            <span>기간</span>
            <span>양식</span>
            <span>작성일</span>
            <span>관리</span>
          </div>
          {filtered.map((r) => {
            const project = mockProjects.find((p) => p.id === r.projectId)
            return (
              <div key={r.id} className="table-row">
                <span>{project?.name ?? r.projectId}</span>
                <span>{r.type}</span>
                <span>{r.period}</span>
                <span>{r.format}</span>
                <span>{r.createdAt}</span>
                <span className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(r.id)
                      setForm({
                        projectId: r.projectId,
                        type: r.type,
                        period: r.period,
                        format: r.format,
                        createdAt: r.createdAt,
                      })
                    }}
                    aria-label="편집"
                    title="편집"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => handleDelete(r.id)}
                    aria-label="삭제"
                    title="삭제"
                    disabled={!canDeleteReports}
                  >
                    <Trash2 size={18} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <p className="card-label">{editingId ? '보고서 수정' : '보고서 추가'}</p>
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
            <span>유형</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="일일">일일</option>
              <option value="주간">주간</option>
              <option value="월간">월간</option>
            </select>
          </label>
          <label>
            <span>기간</span>
            <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2025-W49" />
          </label>
          <label>
            <span>양식</span>
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="삼성">삼성</option>
              <option value="LG">LG</option>
              <option value="기타">기타</option>
            </select>
          </label>
          <label>
            <span>작성일</span>
            <input type="date" value={form.createdAt} onChange={(e) => setForm({ ...form, createdAt: e.target.value })} />
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
            <li>일일/주간/월간 보고서 자동 생성, 사진·이슈 삽입 준비</li>
            <li>고객사 템플릿(삼성/LG) 선택 적용</li>
            <li>보고서 생성 이력과 작성자 기록</li>
          </ul>
        </article>
        <article className="card">
          <p className="card-label">데이터 키</p>
          <ul className="list">
            <li>`reports`: {'{projectId, type, period, format, createdAt}'}</li>
            <li>보고서 파일 링크/이미지 첨부 필드 확장 예정</li>
          </ul>
        </article>
      </section>
    </div>
  )
}

export default ReportsPage
