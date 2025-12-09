import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Shield, CheckCircle, FileText, ArrowRight, Activity, MapPin } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/ToastProvider'
import './Page.css'

export default function DashboardPage() {
  const { selectedProjectId } = useProject()
  const { show: showToast } = useToast()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    raCount: 0,
    driCount: 0,
    patrolCount: 0,
    openRisks: 0
  })

  const [recentDris, setRecentDris] = useState<any[]>([])
  const [recentPatrols, setRecentPatrols] = useState<any[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.get('/sms/risk-assessments'),
      apiClient.get('/sms/dris'),
      apiClient.get('/sms/patrols')
    ]).then(([raRes, driRes, patrolRes]) => {
      let ras = raRes.data
      let dris = driRes.data
      let patrols = patrolRes.data

      // Filter by project if not 'ALL'
      if (selectedProjectId !== 'ALL') {
        ras = ras.filter((ra: any) => ra.project_id === selectedProjectId)
        dris = dris.filter((dri: any) => dri.project_id === selectedProjectId)
        patrols = patrols.filter((p: any) => p.project_id === selectedProjectId)
      }

      setStats({
        raCount: ras.length,
        driCount: dris.length,
        patrolCount: patrols.length,
        openRisks: patrols.filter((p: any) => p.status === 'OPEN').length
      })

      setRecentDris(dris.slice(0, 3))
      setRecentPatrols(patrols.slice(0, 3))
    }).finally(() => setLoading(false))
  }, [selectedProjectId])

  const handleQuickAction = (path: string) => (e: React.MouseEvent) => {
    if (selectedProjectId === 'ALL') {
      e.preventDefault()
      showToast('개별 프로젝트를 선택해주세요', 'error')
    } else {
      navigate(path)
    }
  }

  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Dashboard</p>
          <h1>안전 관리 현황</h1>
          <p className="muted">
            {new Date().toLocaleDateString()} 기준 실시간 현장 안전 지표입니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-live">Live</span>
        </div>
      </header>

      {/* Top Stats Cards */}
      <div className="grid four">
        <div className="card dashboard-stat">
          <Activity className="stat-icon-absolute" size={24} color="var(--primary)" />
          <div className="stat-header">
            <span className="stat-label">오늘의 TBM</span>
          </div>
          <p className="stat-value">{stats.driCount}<span className="stat-unit">건</span></p>
          <p className="stat-desc">일일 위험예지 활동</p>
        </div>

        <div className="card dashboard-stat">
          <FileText className="stat-icon-absolute" size={24} color="var(--text-secondary)" />
          <div className="stat-header">
            <span className="stat-label">위험성평가</span>
          </div>
          <p className="stat-value">{stats.raCount}<span className="stat-unit">건</span></p>
          <p className="stat-desc">진행 중인 공정 평가</p>
        </div>

        <div className="card dashboard-stat">
          <Shield className="stat-icon-absolute" size={24} color="#58f099" />
          <div className="stat-header">
            <span className="stat-label">안전 순찰</span>
          </div>
          <p className="stat-value">{stats.patrolCount}<span className="stat-unit">회</span></p>
          <p className="stat-desc">누적 순찰 횟수</p>
        </div>

        <div className="card dashboard-stat">
          <AlertTriangle className="stat-icon-absolute" size={24} color={stats.openRisks > 0 ? '#ff6f6f' : 'var(--text-tertiary)'} />
          <div className="stat-header">
            <span className="stat-label">조치 필요</span>
          </div>
          <p className="stat-value" style={{ color: stats.openRisks > 0 ? '#ff6f6f' : 'inherit' }}>
            {stats.openRisks}<span className="stat-unit">건</span>
          </p>
          <p className="stat-desc">미조치 부적합 사항</p>
        </div>
      </div>

      <div className="dashboard-grid-split">
        {/* Recent TBM Activity */}
        <section className="panel">
          <div className="section-header">
            <h3>최근 TBM 활동</h3>
            <Link to="/dri" className="btn-text">전체보기 <ArrowRight size={14} /></Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentDris.map(dri => (
              <div key={dri.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '1rem' }}>{dri.work_content}</p>
                  <div className="milestone-meta" style={{ marginTop: '0.25rem' }}>
                    <MapPin size={12} /> {dri.location} · {dri.attendees_count}명 참석
                  </div>
                </div>
                <span className="badge badge-tag">{new Date(dri.date || dri.created_at).toLocaleDateString().slice(5)}</span>
              </div>
            ))}
            {recentDris.length === 0 && <p className="muted" style={{ padding: '1rem', textAlign: 'center' }}>데이터가 없습니다.</p>}
          </div>
        </section>

        {/* Recent Patrol Issues */}
        <section className="panel">
          <div className="section-header">
            <h3>순찰 지적 사항</h3>
            <Link to="/patrol" className="btn-text">전체보기 <ArrowRight size={14} /></Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentPatrols.map(p => (
              <div key={p.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className={`badge ${p.severity === 'HIGH' ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: '0.75rem', padding: '2px 6px' }}>{p.severity}</span>
                    <span style={{ fontWeight: 600 }}>{p.issue_type}</span>
                  </div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{p.description}</p>
                </div>
                <div>
                  {p.status === 'OPEN' ? (
                    <span className="status-dot error" title="조치 필요" />
                  ) : (
                    <CheckCircle size={16} color="#58f099" />
                  )}
                </div>
              </div>
            ))}
            {recentPatrols.length === 0 && <p className="muted" style={{ padding: '1rem', textAlign: 'center' }}>데이터가 없습니다.</p>}
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <p className="eyebrow">바로가기</p>
        {selectedProjectId === 'ALL' && (
          <div className="panel" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-surface-hover)', border: '2px dashed var(--border)' }}>
            <p style={{ margin: 0, textAlign: 'center', color: 'var(--text-secondary)' }}>
              ⚠️ 개별 프로젝트를 선택하면 바로가기를 사용할 수 있습니다
            </p>
          </div>
        )}
        <div className="grid four">
          <a
            href="/ra/new"
            className={`card action-card ${selectedProjectId === 'ALL' ? 'disabled' : ''}`}
            onClick={handleQuickAction('/ra/new')}
            style={{ opacity: selectedProjectId === 'ALL' ? 0.5 : 1, cursor: selectedProjectId === 'ALL' ? 'not-allowed' : 'pointer' }}
          >
            <FileText className="action-icon" />
            <span>새 위험성평가</span>
          </a>
          <a
            href="/dri"
            className={`card action-card ${selectedProjectId === 'ALL' ? 'disabled' : ''}`}
            onClick={handleQuickAction('/dri')}
            style={{ opacity: selectedProjectId === 'ALL' ? 0.5 : 1, cursor: selectedProjectId === 'ALL' ? 'not-allowed' : 'pointer' }}
          >
            <Activity className="action-icon" />
            <span>TBM 등록</span>
          </a>
          <a
            href="/checklist"
            className={`card action-card ${selectedProjectId === 'ALL' ? 'disabled' : ''}`}
            onClick={handleQuickAction('/checklist')}
            style={{ opacity: selectedProjectId === 'ALL' ? 0.5 : 1, cursor: selectedProjectId === 'ALL' ? 'not-allowed' : 'pointer' }}
          >
            <CheckCircle className="action-icon" />
            <span>체크리스트</span>
          </a>
          <a
            href="/patrol"
            className={`card action-card ${selectedProjectId === 'ALL' ? 'disabled' : ''}`}
            onClick={handleQuickAction('/patrol')}
            style={{ opacity: selectedProjectId === 'ALL' ? 0.5 : 1, cursor: selectedProjectId === 'ALL' ? 'not-allowed' : 'pointer' }}
          >
            <Shield className="action-icon" />
            <span>순찰 기록</span>
          </a>
        </div>
      </section>
    </div>
  )
}
