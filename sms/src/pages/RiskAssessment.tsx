import { useEffect, useState, useMemo } from 'react'
import { Plus, FileText, CheckCircle, AlertTriangle, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './Page.css'
import { apiClient } from '../lib/api'
import { useProject } from '../contexts/ProjectContext'
import type { RiskAssessment } from '../types/sms'
import Spinner from '../components/Spinner'

function RiskAssessmentPage() {
  const navigate = useNavigate()
  const { selectedProjectId } = useProject()
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    Promise.all([
      fetchAssessments(),
      fetchProjects()
    ]).finally(() => setLoading(false))
  }, [])

  const fetchAssessments = async () => {
    try {
      const { data } = await apiClient.get<RiskAssessment[]>('/sms/risk-assessments')
      setAssessments(data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchProjects = async () => {
    try {
      const { data } = await apiClient.get('/projects')
      setProjects(data)
    } catch (err) {
      console.error(err)
    }
  }

  const filteredAssessments = useMemo(() => {
    return assessments.filter(ra => {
      const matchesSearch = ra.process_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ra.assessor_name && ra.assessor_name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesProject = selectedProjectId === 'ALL' || ra.project_id === selectedProjectId

      return matchesSearch && matchesProject
    })
  }, [assessments, searchTerm, selectedProjectId])

  if (loading) return <Spinner />

  return (
    <div className="page">
      <header className="page-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>위험성 평가 (RA)</h1>
          <p className="muted">
            현장 공정별 위험요소를 식별하고 감소 대책을 수립합니다.
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/ra/new')}>
          <Plus size={18} />
          평가 생성
        </button>
      </header>

      {/* Search Toolbar */}
      <section className="panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="input"
            placeholder="공정명 또는 작성자 검색..."
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      {filteredAssessments.length === 0 ? (
        <section className="empty-state">
          <FileText size={48} className="empty-icon" />
          <h3>검색 결과가 없습니다.</h3>
          <p>조건을 변경하거나 새로운 위험성 평가를 등록해주세요.</p>
        </section>
      ) : (
        <section className="ra-list">
          {filteredAssessments.map((ra) => {
            const project = projects.find(p => p.id === ra.project_id)
            return (
              <div key={ra.id} className="ra-card" onClick={() => navigate(`/ra/${ra.id}`)}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <span className="task-id" style={{ display: 'block', marginBottom: '0.25rem' }}>
                    {project ? project.name : '미지정 현장'}
                  </span>
                  <div className="ra-header" style={{ marginBottom: 0 }}>
                    <h3>{ra.process_name}</h3>
                    <span className={`badge ${ra.status === 'APPROVED' ? 'badge-live' : 'badge-tag'}`}>
                      {ra.status === 'APPROVED' ? '승인' : '작성'}
                    </span>
                  </div>
                </div>

                <div className="ra-meta">
                  <span>{new Date(ra.created_at).toLocaleDateString()}</span>
                  <span className="dot">·</span>
                  <span>{ra.assessor_name || '-'}</span>
                  <span className="dot">·</span>
                  <span>위험요소 {ra.item_count || 0}</span>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="panel" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <div>
            <p className="eyebrow">가이드</p>
            <h3>위험성 평가 프로세스</h3>
          </div>
        </div>
        <div className="grid three">
          <div className="card">
            <div className="card-icon"><Plus size={24} /></div>
            <p className="card-label">1. 공정 등록</p>
            <p className="card-text">PMS 공정 계획을 불러와 작업 단위를 설정합니다.</p>
          </div>
          <div className="card">
            <div className="card-icon"><AlertTriangle size={24} /></div>
            <p className="card-label">2. 위험요인 식별</p>
            <p className="card-text">작업별 유해위험요인을 파악하고 빈도/강도를 산출합니다.</p>
          </div>
          <div className="card">
            <div className="card-icon"><CheckCircle size={24} /></div>
            <p className="card-label">3. 대책 수립 및 승인</p>
            <p className="card-text">예방 대책을 수립하고 관리자 승인을 통해 확정합니다.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RiskAssessmentPage
