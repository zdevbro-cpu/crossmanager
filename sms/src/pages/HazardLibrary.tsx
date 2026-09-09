import { useEffect, useState } from 'react'
import { Search, BookOpen, AlertCircle, Pencil, Check, X, FilePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'
import './Page.css'

// 위험요인 라이브러리 — 재사용 단위를 파일이 아니라 검증된 항목으로 바꾼다.
//
// 설계 개요서 3.2절
//   "문서 복사 방식을 금지하는 대신, 문서 단위 복사를 항목 단위 조립으로 전환한다."
//
// 그래서 이 화면은 문서를 통째로 가져오는 기능을 제공하지 않는다.
// 항목을 하나씩 골라 담는 것만 허용하면 불필요한 항목이 자연히 걸러진다(설계서 6.5).
//
// 담은 항목은 위험성평가(RA) 작성 화면으로 넘긴다.

interface HazardItem {
  id: number
  work_type_code: string | null
  work_type_name: string | null
  hazard_class: string | null
  hazard_desc: string
  accident_type_code: string | null
  legal_basis: string | null
  current_control: string | null
  reduction_measure: string | null
  frequency: number | null
  severity: number | null
  grade: string | null
  risk_value: number | null
  usage_count: number
}

interface WorkType {
  work_type_code: string
  name: string
}

const GRADE_BADGE: Record<string, string> = {
  A: 'badge-error',
  B: 'badge-warning',
  C: 'badge-primary',
  D: 'badge-tag',
  E: 'badge',
}

const GRADE_ACTION: Record<string, string> = {
  A: '작업 중지 · 즉시 개선 후 재평가',
  B: '작업 전 개선 필수 · 관리감독자 입회',
  C: '개선 계획 수립 후 작업',
  D: '현행 조치 유지 · 주기적 확인',
  E: '허용 가능 · 관리 불필요',
}

const HAZARD_CLASSES = ['작업환경', '화학적', '기계적', '기술적']

// 빈도 x 강도 → 등급. 부록 A.4 매트릭스이며 현장 파일 실측값과 일치한다.
const gradeOf = (f: number | null, s: number | null) => {
  if (!f || !s) return null
  const v = f * s
  return v >= 20 ? 'A' : v >= 15 ? 'B' : v >= 10 ? 'C' : v >= 5 ? 'D' : 'E'
}

export default function HazardLibraryPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToast()

  const [items, setItems] = useState<HazardItem[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [workType, setWorkType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<number, boolean>>({})

  // 편집 중인 항목. 등급은 빈도·강도에서 다시 계산하므로 직접 고르지 않는다.
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<HazardItem>>({})

  useEffect(() => {
    apiClient.get('/master/work-types')
      .then(res => setWorkTypes(res.data))
      .catch(err => console.error(err))
  }, [])

  const search = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '60' }
      if (workType) params.workType = workType
      if (keyword.trim()) params.q = keyword.trim()
      const { data } = await apiClient.get('/master/hazard-items', { params })
      setItems(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { search() }, [workType])

  const toggle = (id: number) => {
    if (editing === id) return          // 편집 중에는 선택 토글이 걸리지 않게 한다
    setPicked(p => ({ ...p, [id]: !p[id] }))
  }
  const pickedIds = Object.entries(picked).filter(([, v]) => v).map(([k]) => Number(k))

  const startEdit = (h: HazardItem) => {
    setEditing(h.id)
    setDraft({
      hazard_desc: h.hazard_desc,
      hazard_class: h.hazard_class,
      work_type_code: h.work_type_code,
      frequency: h.frequency,
      severity: h.severity,
      current_control: h.current_control,
      reduction_measure: h.reduction_measure,
      legal_basis: h.legal_basis,
    })
  }

  const cancelEdit = () => { setEditing(null); setDraft({}) }

  const saveEdit = async (id: number) => {
    try {
      await apiClient.patch(`/master/hazard-items/${id}`, {
        hazardDesc: draft.hazard_desc,
        hazardClass: draft.hazard_class,
        workTypeCode: draft.work_type_code,
        frequency: draft.frequency,
        severity: draft.severity,
        currentControl: draft.current_control,
        reductionMeasure: draft.reduction_measure,
        legalBasis: draft.legal_basis,
      })
      showToast('수정했습니다.', 'success')
      cancelEdit()
      search()
    } catch (err) {
      showToast('수정 실패', 'error')
    }
  }

  // 고른 항목을 평가서 작성 화면으로 넘긴다.
  // 문서 통째 복사가 아니라 항목 단위 조립이라는 점이 핵심이다.
  const toAssessment = () => {
    if (pickedIds.length === 0) return showToast('담을 항목을 선택하세요.', 'error')
    const chosen = items.filter(h => picked[h.id])
    sessionStorage.setItem('ra_picked_hazards', JSON.stringify(chosen))
    navigate('/sms/ra/new?from=library')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>위험요인 라이브러리</h1>
          <p className="muted">현장 위험성평가에서 검증된 항목을 골라 담습니다. 문서를 통째로 복사하지 않고 항목 단위로만 가져옵니다.</p>
        </div>
        {pickedIds.length > 0 && (
          <button className="btn-primary" onClick={toAssessment}>
            <FilePlus size={16} /> 평가서에 담기 ({pickedIds.length})
          </button>
        )}
      </header>

      <div className="card" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select className="input" value={workType} onChange={e => setWorkType(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
          <option value="">공종 전체</option>
          {workTypes.map(w => <option key={w.work_type_code} value={w.work_type_code}>{w.name}</option>)}
        </select>
        <input
          className="input"
          placeholder="위험요인 검색 (예: 낙하, 협착, 중장비)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-primary" onClick={search}>
          <Search size={16} /> 검색
        </button>
      </div>

      <div className="grid three">
        {items.map(h => {
          const isEdit = editing === h.id
          const f = (isEdit ? draft.frequency : h.frequency) ?? null
          const s = (isEdit ? draft.severity : h.severity) ?? null
          const g = isEdit ? gradeOf(f, s) : h.grade

          return (
            <div
              key={h.id}
              className="card"
              onClick={() => !isEdit && toggle(h.id)}
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.7rem',
                cursor: isEdit ? 'default' : 'pointer',
                outline: picked[h.id] ? '2px solid var(--accent, #58f099)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="badge badge-tag">{h.hazard_class || h.work_type_name || '미분류'}</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {g
                    ? <span className={`badge ${GRADE_BADGE[g] || 'badge-tag'}`}>
                        {g} ({f}×{s}={(f as number) * (s as number)})
                      </span>
                    : <span className="badge badge-tag">등급 미정</span>}
                  {!isEdit && (
                    <button
                      className="btn-text"
                      title="수정"
                      onClick={(e) => { e.stopPropagation(); startEdit(h) }}
                      style={{ padding: '0.1rem 0.3rem' }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>

              {isEdit ? (
                <>
                  <textarea
                    className="input"
                    rows={2}
                    value={draft.hazard_desc || ''}
                    onChange={e => setDraft(d => ({ ...d, hazard_desc: e.target.value }))}
                    style={{ fontSize: '0.95rem' }}
                  />

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <select
                      className="input"
                      value={draft.hazard_class || ''}
                      onChange={e => setDraft(d => ({ ...d, hazard_class: e.target.value }))}
                      style={{ width: 'auto', fontSize: '0.85rem' }}
                    >
                      <option value="">위험분류</option>
                      {HAZARD_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      className="input"
                      value={draft.work_type_code || ''}
                      onChange={e => setDraft(d => ({ ...d, work_type_code: e.target.value }))}
                      style={{ width: 'auto', fontSize: '0.85rem' }}
                    >
                      <option value="">공종</option>
                      {workTypes.map(w => <option key={w.work_type_code} value={w.work_type_code}>{w.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>빈도</span>
                    <select className="input" value={f || ''} style={{ width: 64, fontSize: '0.85rem' }}
                      onChange={e => setDraft(d => ({ ...d, frequency: Number(e.target.value) }))}>
                      <option value="">-</option>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>강도</span>
                    <select className="input" value={s || ''} style={{ width: 64, fontSize: '0.85rem' }}
                      onChange={e => setDraft(d => ({ ...d, severity: Number(e.target.value) }))}>
                      <option value="">-</option>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <input className="input" placeholder="현재 조치" style={{ fontSize: '0.85rem' }}
                    value={draft.current_control || ''}
                    onChange={e => setDraft(d => ({ ...d, current_control: e.target.value }))} />
                  <input className="input" placeholder="감소 대책" style={{ fontSize: '0.85rem' }}
                    value={draft.reduction_measure || ''}
                    onChange={e => setDraft(d => ({ ...d, reduction_measure: e.target.value }))} />
                  <input className="input" placeholder="법적 근거" style={{ fontSize: '0.85rem' }}
                    value={draft.legal_basis || ''}
                    onChange={e => setDraft(d => ({ ...d, legal_basis: e.target.value }))} />

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.6rem' }}>
                    <button className="btn-primary" onClick={() => saveEdit(h.id)} style={{ flex: 1 }}>
                      <Check size={14} /> 저장
                    </button>
                    <button className="btn-secondary" onClick={cancelEdit} style={{ flex: 1 }}>
                      <X size={14} /> 취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.45 }}>{h.hazard_desc}</h3>

                  {h.current_control && <div className="milestone-meta">현재 조치 · {h.current_control}</div>}
                  {h.reduction_measure && <div className="milestone-meta">감소 대책 · {h.reduction_measure}</div>}
                  {h.legal_basis && <div className="milestone-meta" style={{ fontSize: '0.8rem' }}>{h.legal_basis}</div>}
                  {h.grade && <div className="muted" style={{ fontSize: '0.8rem' }}>{GRADE_ACTION[h.grade]}</div>}

                  <div style={{ marginTop: 'auto', paddingTop: '0.7rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    사용 {h.usage_count}회
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!loading && items.length === 0 && (
        <section className="empty-state">
          <BookOpen size={48} className="empty-icon" />
          <h3>표시할 위험요인이 없습니다.</h3>
          <p>
            현장 위험성평가 파일에서 추출한 항목은 안전관리팀 검수를 통과해야 노출됩니다.
            검증되지 않은 위험요인이 법정 문서에 들어가는 것을 막기 위함입니다.
          </p>
        </section>
      )}

      {!loading && items.length > 0 && (
        <p className="muted" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <AlertCircle size={14} />
          검수를 통과한 항목만 표시됩니다. 카드를 눌러 고르고, 연필 아이콘으로 내용을 고칠 수 있습니다.
        </p>
      )}
    </div>
  )
}
