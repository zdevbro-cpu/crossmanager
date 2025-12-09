
import './Page.css'
import { useEffect, useState } from 'react'
import { useContracts } from '../hooks/useContracts'
import { mockContracts, mockProjects } from '../data/mock'
import type { Contract } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { validatePositiveAmount } from '../utils/validation'
import { Trash2, Plus, Pencil, Check } from 'lucide-react'
import { useRole } from '../hooks/useRole'

function ContractsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  const { data, isLoading, isError } = useContracts()
  const [contracts, setContracts] = useState<Contract[]>(mockContracts)
  const [msg, setMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { role } = useRole()
  const canEditContracts = role !== 'field'

  useEffect(() => {
    if (data) setContracts(data)
  }, [data])

  const [form, setForm] = useState({
    projectId: 'p1',
    type: '계약',
    amount: 0,
    regulation: '삼성',
    status: '진행',
  })

  const filtered = contracts.filter((c) => !selectedId || c.projectId === selectedId)

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amountError = validatePositiveAmount(Number(form.amount) || 0)
    if (amountError) {
      setMsg(amountError)
      show(amountError, 'warning')
      return
    }
    const newContract: Contract = {
      id: editingId ?? crypto.randomUUID(),
      projectId: form.projectId,
      type: form.type as Contract['type'],
      amount: Number(form.amount) || 0,
      status: form.status as Contract['status'],
      regulation: form.regulation as Contract['regulation'],
    }

    // TODO: 백엔드 API 연동
    setContracts((prev) =>
      editingId ? prev.map((c) => (c.id === editingId ? newContract : c)) : [newContract, ...prev],
    )
    setMsg(editingId ? '화면에서 수정했습니다. (DB 구현 필요)' : '화면에만 추가했습니다. (DB 구현 필요)')
    show(editingId ? '화면에서 수정했습니다.' : '화면에만 추가했습니다.', 'info')

    setForm({ ...form, amount: 0 })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!canEditContracts) {
      show('현장근무 역할은 계약/견적 삭제 권한이 없습니다.', 'warning')
      return
    }
    if (!confirm('삭제하시겠습니까?')) return

    // TODO: 백엔드 API 연동
    setContracts((prev) => prev.filter((c) => c.id !== id))
    setMsg('삭제했습니다. (DB 구현 필요)')
    show('삭제했습니다.', 'success')
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">계약 · 견적 · 변경계약</p>
          <h2>계약 금액과 고객사 규정(삼성/LG) 필드 반영</h2>
          <p className="muted">
            계약/견적/변경계약을 프로젝트에 연결하고, 고객사 규정을 선택해 관리합니다. 회계·결재 기록과 문서 링크까지
            연결합니다.
          </p>
        </div>
        <div className="pill pill-outline">회계/결재 흐름</div>
      </header>

      <section className="card table-card">
        <div className="table-head">
          <p className="card-label">계약/견적 현황 (샘플)</p>
          <div className="table-actions">
            <button className="pill pill-outline">서류 업로드 (준비 중)</button>
          </div>
        </div>
        {msg && <p className="muted">{msg}</p>}
        {isLoading && <p className="muted">불러오는 중...</p>}
        {isError && <p className="muted">불러오기 오류, 새로고침 해주세요.</p>}
        <div className="table">
          <div className="table-row table-header">
            <span>프로젝트</span>
            <span>구분</span>
            <span>금액</span>
            <span>규정</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          {filtered.map((c) => {
            const project = mockProjects.find((p) => p.id === c.projectId)
            return (
              <div key={c.id} className="table-row">
                <span>{project?.name ?? c.projectId}</span>
                <span>{c.type}</span>
                <span>{c.amount.toLocaleString()} 원</span>
                <span>{c.regulation}</span>
                <span className={`badge ${c.status === '완료' ? 'badge-live' : ''}`}>{c.status}</span>
                <span className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(c.id)
                      setForm({
                        projectId: c.projectId,
                        type: c.type,
                        amount: c.amount,
                        status: c.status,
                        regulation: c.regulation,
                      })
                    }}
                    aria-label="편집"
                    title="편집"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => handleDelete(c.id)}
                    aria-label="삭제"
                    title="삭제"
                    disabled={!canEditContracts}
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
        <p className="card-label">{editingId ? '계약 수정' : '계약 추가'}</p>
        {!canEditContracts && <p className="muted">현장근무 역할은 계약/견적 작성 권한이 없습니다.</p>}
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
            <span>구분</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="계약">계약</option>
              <option value="견적">견적</option>
              <option value="변경">변경</option>
            </select>
          </label>
          <label>
            <span>금액</span>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </label>
          <label>
            <span>규정</span>
            <select value={form.regulation} onChange={(e) => setForm({ ...form, regulation: e.target.value })}>
              <option value="삼성">삼성</option>
              <option value="LG">LG</option>
              <option value="기타">기타</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="진행">진행</option>
              <option value="검토">검토</option>
              <option value="완료">완료</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="icon-button" aria-label="추가" disabled={!canEditContracts}>
              {editingId ? <Check size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </form>
      </section>

      <section className="grid two">
        <article className="card">
          <p className="card-label">핵심 기능</p>
          <ul className="list">
            <li>계약/견적/변경계약 금액 관리, 고객사 규정 필드 포함</li>
            <li>회계/결재 기록, 문서 링크 연결</li>
            <li>상태(진행/검토/완료) 배지, 변경 이력 기록</li>
          </ul>
        </article>
        <article className="card">
          <p className="card-label">데이터 키</p>
          <ul className="list">
            <li>`contracts`: {'{projectId, type, amount, regulation, status}'}</li>
            <li>문서 링크/결재 정보 필드 확장 예정</li>
          </ul>
        </article>
      </section>
    </div>
  )
}

export default ContractsPage
