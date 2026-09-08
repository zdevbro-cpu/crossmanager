import { useEffect, useState } from 'react'
import { Search, BookOpen, AlertCircle } from 'lucide-react'
import { apiClient } from '../lib/api'
import './Page.css'

// 위험요인 라이브러리 — 재사용 단위를 파일이 아니라 검증된 항목으로 바꾼다.
//
// 설계 개요서 3.2절
//   "문서 복사 방식을 금지하는 대신, 문서 단위 복사를 항목 단위 조립으로 전환한다."
//
// 그래서 이 화면은 문서를 통째로 가져오는 기능을 제공하지 않는다.
// 항목을 하나씩 골라 담는 것만 허용하면 불필요한 항목이 자연히 걸러진다(설계서 6.5).

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
}

const GRADE_ACTION: Record<string, string> = {
  A: '작업 중지 · 즉시 개선 후 재평가',
  B: '작업 전 개선 필수 · 관리감독자 입회',
  C: '개선 계획 수립 후 작업',
  D: '현행 조치 유지 · 주기적 확인',
}

export default function HazardLibraryPage() {
  const [items, setItems] = useState<HazardItem[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [workType, setWorkType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<number, boolean>>({})

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

  const toggle = (id: number) => setPicked(p => ({ ...p, [id]: !p[id] }))
  const pickedCount = Object.values(picked).filter(Boolean).length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>위험요인 라이브러리</h1>
          <p className="muted">현장 위험성평가에서 검증된 항목을 골라 담습니다. 문서를 통째로 복사하지 않고 항목 단위로만 가져옵니다.</p>
        </div>
        {pickedCount > 0 && (
          <span className="badge badge-primary" style={{ fontSize: '0.95rem' }}>
            {pickedCount}개 선택됨
          </span>
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
        {items.map(h => (
          <div
            key={h.id}
            className="card"
            onClick={() => toggle(h.id)}
            style={{
              display: 'flex', flexDirection: 'column', gap: '0.7rem', cursor: 'pointer',
              outline: picked[h.id] ? '2px solid var(--accent, #58f099)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span className="badge badge-tag">{h.hazard_class || h.work_type_name || '미분류'}</span>
              {h.grade
                ? <span className={`badge ${GRADE_BADGE[h.grade] || 'badge-tag'}`}>
                    {h.grade} ({h.frequency}×{h.severity}={h.risk_value})
                  </span>
                : <span className="badge badge-tag">등급 미정</span>}
            </div>

            <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.45 }}>{h.hazard_desc}</h3>

            {h.current_control && (
              <div className="milestone-meta">현재 조치 · {h.current_control}</div>
            )}
            {h.reduction_measure && (
              <div className="milestone-meta">감소 대책 · {h.reduction_measure}</div>
            )}
            {h.legal_basis && (
              <div className="milestone-meta" style={{ fontSize: '0.8rem' }}>{h.legal_basis}</div>
            )}
            {h.grade && (
              <div className="muted" style={{ fontSize: '0.8rem' }}>{GRADE_ACTION[h.grade]}</div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '0.7rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              사용 {h.usage_count}회
            </div>
          </div>
        ))}
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
          검수를 통과한 항목만 표시됩니다.
        </p>
      )}
    </div>
  )
}
