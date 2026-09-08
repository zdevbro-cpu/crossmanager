import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import './Page.css'

// 만료 알림 — 자격증·건강검진·장비 검사증의 유효기간을 한 곳에서 본다.
// 만료는 곧 현장 반입 거부다. 설계 개요서 5.2절이 "RA 자동화보다 현장 체감
// 가치가 클 수 있다"고 꼽은 항목이다.

interface ExpiryRow {
  target_type: string
  target_id: string
  owner_type: string | null
  owner_id: string | null
  title: string
  expire_date: string
  status: 'WARNING' | 'EXPIRED'
  days_left: number
}

const TYPE_LABEL: Record<string, string> = {
  WORKER_QUAL: '근로자 자격',
  WORKER_HEALTH: '건강검진',
  EQUIP_DOC: '장비 서류',
  COMPANY_INSURANCE: '업체 보험',
}

export default function ExpiryPage() {
  const { selectedProjectId } = useProject()

  const [expired, setExpired] = useState<ExpiryRow[]>([])
  const [warning, setWarning] = useState<ExpiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchExpiries = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { days: String(days) }
      if (selectedProjectId && selectedProjectId !== 'ALL') params.projectId = selectedProjectId
      const { data } = await apiClient.get('/master/expiries', { params })
      setExpired(data.expired || [])
      setWarning(data.warning || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExpiries() }, [selectedProjectId, days])

  const byType = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of [...expired, ...warning]) {
      const k = TYPE_LABEL[r.target_type] || r.target_type
      m[k] = (m[k] || 0) + 1
    }
    return Object.entries(m)
  }, [expired, warning])

  const renderRow = (r: ExpiryRow) => (
    <div key={`${r.target_type}-${r.target_id}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="badge badge-tag">{TYPE_LABEL[r.target_type] || r.target_type}</span>
        {r.status === 'EXPIRED'
          ? <span className="badge badge-error">만료 (D+{Math.abs(r.days_left)})</span>
          : <span className="badge badge-warning">D-{r.days_left}</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.4 }}>{r.title}</h3>

      <div className="milestone-meta">
        <AlertTriangle size={14} color={r.status === 'EXPIRED' ? '#ff6f6f' : '#f0c058'} />
        만료일 {r.expire_date?.slice(0, 10)}
      </div>

      {r.status === 'EXPIRED' && r.owner_type === 'WORKER' && (
        <div className="milestone-meta">
          <ShieldAlert size={14} color="#ff6f6f" /> 현장 반입 차단 상태
        </div>
      )}
    </div>
  )

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>만료 알림</h1>
          <p className="muted">자격증·건강검진·장비 검사증의 유효기간을 감시합니다. 만료된 인원은 현장 반입이 자동으로 차단됩니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <select className="input" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={7}>7일 이내</option>
            <option value={30}>30일 이내</option>
            <option value={60}>60일 이내</option>
            <option value={90}>90일 이내</option>
          </select>
          <button className="btn-secondary" onClick={fetchExpiries}>
            <RefreshCw size={16} /> 새로고침
          </button>
        </div>
      </header>

      <div className="grid three" style={{ marginBottom: '1.5rem' }}>
        <div className="dashboard-stat">
          <span className="card-label">만료</span>
          <strong style={{ fontSize: '2rem', color: '#ff6f6f' }}>{expired.length}</strong>
          <span className="muted">즉시 조치 필요</span>
        </div>
        <div className="dashboard-stat">
          <span className="card-label">임박</span>
          <strong style={{ fontSize: '2rem', color: '#f0c058' }}>{warning.length}</strong>
          <span className="muted">{days}일 이내 만료</span>
        </div>
        <div className="dashboard-stat">
          <span className="card-label">구분별</span>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {byType.length === 0
              ? <span className="muted">해당 없음</span>
              : byType.map(([k, v]) => <span key={k} className="muted">{k} {v}건</span>)}
          </div>
        </div>
      </div>

      {expired.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.8rem' }}>만료됨 — 반입 차단</h2>
          <div className="grid three" style={{ marginBottom: '2rem' }}>{expired.map(renderRow)}</div>
        </>
      )}

      {warning.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.8rem' }}>만료 임박</h2>
          <div className="grid three">{warning.map(renderRow)}</div>
        </>
      )}

      {!loading && expired.length === 0 && warning.length === 0 && (
        <section className="empty-state">
          <CheckCircle size={48} className="empty-icon" />
          <h3>만료 예정 항목이 없습니다.</h3>
          <p>자격증·검사증이 모두 유효한 상태입니다.</p>
        </section>
      )}
    </div>
  )
}
