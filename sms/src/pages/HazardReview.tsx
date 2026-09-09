import { useEffect, useState } from 'react'
import { Check, X, Search, ClipboardCheck } from 'lucide-react'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'
import './Page.css'

// 위험요인 라이브러리 검수
//
// 현장 RA 파일에서 추출한 항목은 곧바로 쓰지 않는다.
// 검증되지 않은 위험요인이 법정 문서에 들어가면 되돌릴 수 없기 때문이다(설계서 12.2.3).
// 안전관리팀이 훑어보고 통과시킨 것만 현장에 노출된다.
//
// 등급이 없는 항목은 통과시킬 수 없다. 빈도·강도를 채워야 활성화된다.

interface PendingItem {
  id: number
  work_type_code: string | null
  work_type_name: string | null
  hazard_class: string | null
  hazard_desc: string
  legal_basis: string | null
  current_control: string | null
  reduction_measure: string | null
  frequency: number | null
  severity: number | null
  grade: string | null
  risk_value: number | null
  usage_count: number
  source_note: string | null
}

interface Stats {
  approved: number
  pending: number
  pending_with_grade: number
  pending_no_grade: number
}

interface WorkType { work_type_code: string; name: string }

const GRADE_BADGE: Record<string, string> = { A: 'badge-error', B: 'badge-warning', C: 'badge-primary', D: 'badge-tag' }
const HAZARD_CLASSES = ['작업환경', '화학적', '기계적', '기술적']

const gradeOf = (f: number | null, s: number | null) => {
  if (!f || !s) return null
  const v = f * s
  return v >= 20 ? 'A' : v >= 15 ? 'B' : v >= 10 ? 'C' : v >= 5 ? 'D' : 'E'
}

export default function HazardReviewPage() {
  const { show: showToast } = useToast()

  const [items, setItems] = useState<PendingItem[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [loading, setLoading] = useState(true)

  const [hasGrade, setHasGrade] = useState('Y')
  const [keyword, setKeyword] = useState('')
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const [edits, setEdits] = useState<Record<number, Partial<PendingItem>>>({})

  const fetchStats = () => apiClient.get('/master/hazard-items/stats').then(r => setStats(r.data)).catch(console.error)

  const fetchPending = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '60' }
      if (hasGrade) params.hasGrade = hasGrade
      if (keyword.trim()) params.q = keyword.trim()
      const { data } = await apiClient.get('/master/hazard-items/pending', { params })
      setItems(data.items || [])
      setTotal(data.total || 0)
      setPicked({})
      setEdits({})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    apiClient.get('/master/work-types').then(r => setWorkTypes(r.data)).catch(console.error)
  }, [])
  useEffect(() => { fetchPending(); fetchStats() }, [hasGrade])

  const pickedIds = Object.entries(picked).filter(([, v]) => v).map(([k]) => Number(k))
  const toggle = (id: number) => setPicked(p => ({ ...p, [id]: !p[id] }))
  const toggleAll = () => {
    if (pickedIds.length === items.length) return setPicked({})
    const all: Record<number, boolean> = {}
    items.forEach(i => { all[i.id] = true })
    setPicked(all)
  }

  const setEdit = (id: number, field: keyof PendingItem, value: any) =>
    setEdits(e => ({ ...e, [id]: { ...e[id], [field]: value } }))

  const saveEdit = async (item: PendingItem) => {
    const e = edits[item.id]
    if (!e) return
    try {
      await apiClient.patch(`/master/hazard-items/${item.id}`, {
        hazardClass: e.hazard_class,
        workTypeCode: e.work_type_code,
        frequency: e.frequency,
        severity: e.severity,
      })
      showToast('저장했습니다.', 'success')
      fetchPending(); fetchStats()
    } catch (err) {
      showToast('저장 실패', 'error')
    }
  }

  const approve = async () => {
    if (pickedIds.length === 0) return showToast('선택된 항목이 없습니다.', 'error')
    try {
      const { data } = await apiClient.post('/master/hazard-items/activate', { ids: pickedIds })
      showToast(
        `${data.activated}건 통과${data.skipped ? ` · ${data.skipped}건 제외(등급 없음)` : ''}`,
        data.activated ? 'success' : 'error')
      fetchPending(); fetchStats()
    } catch (err) {
      showToast('통과 처리 실패', 'error')
    }
  }

  const reject = async () => {
    if (pickedIds.length === 0) return showToast('선택된 항목이 없습니다.', 'error')
    try {
      const { data } = await apiClient.post('/master/hazard-items/reject', { ids: pickedIds })
      showToast(`${data.rejected}건 반려했습니다.`, 'success')
      fetchPending(); fetchStats()
    } catch (err) {
      showToast('반려 처리 실패', 'error')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>위험요인 검수</h1>
          <p className="muted">현장 위험성평가 파일에서 추출한 항목을 확인하고 통과시킵니다. 통과한 항목만 라이브러리에 노출됩니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn-secondary" onClick={reject} disabled={pickedIds.length === 0}>
            <X size={16} /> 반려 ({pickedIds.length})
          </button>
          <button className="btn-primary" onClick={approve} disabled={pickedIds.length === 0}>
            <Check size={16} /> 통과 ({pickedIds.length})
          </button>
        </div>
      </header>

      {stats && (
        <div className="grid three" style={{ marginBottom: '1.5rem' }}>
          <div className="dashboard-stat">
            <span className="card-label">검수 완료</span>
            <strong style={{ fontSize: '2rem', color: '#58f099' }}>{stats.approved}</strong>
            <span className="muted">라이브러리에 노출 중</span>
          </div>
          <div className="dashboard-stat">
            <span className="card-label">검수 대기 · 등급 있음</span>
            <strong style={{ fontSize: '2rem', color: '#f0c058' }}>{stats.pending_with_grade}</strong>
            <span className="muted">바로 통과 가능</span>
          </div>
          <div className="dashboard-stat">
            <span className="card-label">검수 대기 · 등급 없음</span>
            <strong style={{ fontSize: '2rem' }}>{stats.pending_no_grade}</strong>
            <span className="muted">빈도·강도 입력 필요</span>
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select className="input" value={hasGrade} onChange={e => setHasGrade(e.target.value)} style={{ width: 'auto' }}>
          <option value="Y">등급 있음 (통과 가능)</option>
          <option value="N">등급 없음 (입력 필요)</option>
          <option value="">전체</option>
        </select>
        <input
          className="input"
          placeholder="위험요인 검색"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetchPending() }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="btn-primary" onClick={fetchPending}><Search size={16} /> 검색</button>
        <button className="btn-secondary" onClick={toggleAll}>
          {pickedIds.length === items.length && items.length > 0 ? '선택 해제' : '전체 선택'}
        </button>
        <span className="muted">검수 대기 {total}건 중 {items.length}건 표시</span>
      </div>

      <div className="grid three">
        {items.map(h => {
          const e = edits[h.id] || {}
          const f = (e.frequency ?? h.frequency) as number | null
          const s = (e.severity ?? h.severity) as number | null
          const g = gradeOf(f, s)
          return (
            <div
              key={h.id}
              className="card"
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.6rem',
                outline: picked[h.id] ? '2px solid var(--accent, #58f099)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!picked[h.id]} onChange={() => toggle(h.id)} />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>선택</span>
                </label>
                {g
                  ? <span className={`badge ${GRADE_BADGE[g]}`}>{g} ({f}×{s}={(f as number) * (s as number)})</span>
                  : <span className="badge badge-tag">등급 미정</span>}
              </div>

              <h3 style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.45 }}>{h.hazard_desc}</h3>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <select
                  className="input"
                  value={(e.hazard_class ?? h.hazard_class) || ''}
                  onChange={ev => setEdit(h.id, 'hazard_class', ev.target.value)}
                  style={{ width: 'auto', fontSize: '0.85rem' }}
                >
                  <option value="">위험분류</option>
                  {HAZARD_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="input"
                  value={(e.work_type_code ?? h.work_type_code) || ''}
                  onChange={ev => setEdit(h.id, 'work_type_code', ev.target.value)}
                  style={{ width: 'auto', fontSize: '0.85rem' }}
                >
                  <option value="">공종</option>
                  {workTypes.map(w => <option key={w.work_type_code} value={w.work_type_code}>{w.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: '0.8rem' }}>빈도</span>
                <select className="input" value={f || ''} onChange={ev => setEdit(h.id, 'frequency', Number(ev.target.value))} style={{ width: 64, fontSize: '0.85rem' }}>
                  <option value="">-</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="muted" style={{ fontSize: '0.8rem' }}>강도</span>
                <select className="input" value={s || ''} onChange={ev => setEdit(h.id, 'severity', Number(ev.target.value))} style={{ width: 64, fontSize: '0.85rem' }}>
                  <option value="">-</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {edits[h.id] && (
                  <button className="btn-text" onClick={() => saveEdit(h)} style={{ marginLeft: 'auto' }}>저장</button>
                )}
              </div>

              {h.current_control && <div className="milestone-meta">현재 조치 · {h.current_control}</div>}
              {h.reduction_measure && <div className="milestone-meta">감소 대책 · {h.reduction_measure}</div>}
              {h.legal_basis && <div className="milestone-meta" style={{ fontSize: '0.78rem' }}>{h.legal_basis}</div>}

              <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {h.source_note || '출처 미상'} · {h.usage_count}회 등장
              </div>
            </div>
          )
        })}
      </div>

      {!loading && items.length === 0 && (
        <section className="empty-state">
          <ClipboardCheck size={48} className="empty-icon" />
          <h3>검수할 항목이 없습니다.</h3>
          <p>필터를 바꾸거나, 현장 RA 파일을 추가로 파싱해 항목을 채우십시오.</p>
        </section>
      )}
    </div>
  )
}
