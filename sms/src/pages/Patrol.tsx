import { useEffect, useState, useMemo } from 'react'
import { Plus, MapPin, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useToast } from '../components/ToastProvider'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import './Page.css'

interface Patrol {
  id: number
  project_id: string
  location: string
  issue_type: string
  severity: string
  description: string
  status: string
  created_at: string
  created_by: string
}

interface PatrolForm {
  projectId: string
  location: string
  issueType: string
  severity: string
  description: string
  actionRequired: string
}

export default function PatrolPage() {
  const { show: showToast } = useToast()
  const { selectedProjectId } = useProject()

  const [patrols, setPatrols] = useState<Patrol[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<PatrolForm>()

  useEffect(() => {
    Promise.all([fetchPatrols(), fetchProjects()]).finally(() => setLoading(false))
  }, [])

  const fetchPatrols = async () => {
    try {
      const { data } = await apiClient.get('/sms/patrols')
      setPatrols(data)
    } catch (err) { console.error(err) }
  }
  const fetchProjects = async () => apiClient.get('/projects').then(res => setProjects(res.data))

  const filteredPatrols = useMemo(() => {
    if (selectedProjectId === 'ALL') return patrols
    return patrols.filter(p => p.project_id === selectedProjectId)
  }, [patrols, selectedProjectId])

  const onSubmit = async (data: PatrolForm) => {
    try {
      await apiClient.post('/sms/patrols', data)
      showToast('순찰 기록이 등록되었습니다.', 'success')
      setIsModalOpen(false)
      reset()
      fetchPatrols()
    } catch (err) {
      showToast('등록 실패', 'error')
    }
  }

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH': return <span className="badge badge-error">위험 (High)</span>
      case 'MEDIUM': return <span className="badge badge-warning">주의 (Mid)</span>
      default: return <span className="badge badge-primary">양호 (Low)</span>
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>안전 순찰 (Patrol)</h1>
          <p className="muted">현장 순찰 중 발견된 부적합 사항 및 우수 사례를 기록합니다.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> 순찰 기록
        </button>
      </header>

      {/* Patrol List */}
      <div className="grid three">
        {filteredPatrols.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="badge badge-tag">{p.issue_type}</span>
              {getSeverityBadge(p.severity)}
            </div>

            <h3 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.4 }}>{p.description}</h3>

            <div className="milestone-meta">
              <MapPin size={14} /> {p.location}
            </div>
            <div className="milestone-meta">
              <AlertTriangle size={14} color={p.status === 'OPEN' ? '#ff6f6f' : '#58f099'} />
              {p.status === 'OPEN' ? '조치 필요' : '조치 완료'}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              {new Date(p.created_at).toLocaleString()} · {p.created_by}
            </div>
          </div>
        ))}
      </div>

      {filteredPatrols.length === 0 && !loading && (
        <section className="empty-state">
          <CheckCircle size={48} className="empty-icon" />
          <h3>등록된 순찰 기록이 없습니다.</h3>
          <p>현장 순찰을 시작하고 안전 위험 요소를 기록해주세요.</p>
        </section>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="modal-header">
              <h2>새 순찰 기록</h2>
              <button className="btn-text" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="modal-body">
              <div className="form-group">
                <label>관련 프로젝트</label>
                <select className="input" {...register('projectId', { required: true })}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>위치 (구역/층)</label>
                  <input className="input" placeholder="예: 101동 3층" {...register('location', { required: true })} />
                </div>
                <div className="form-group">
                  <label>발견 유형</label>
                  <select className="input" {...register('issueType')}>
                    <option value="부적합">부적합 사항</option>
                    <option value="아차사고">아차사고</option>
                    <option value="우수사례">우수사례</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>위험도 및 내용</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select className="input" style={{ width: '120px' }} {...register('severity')}>
                    <option value="LOW">양호 (Low)</option>
                    <option value="MEDIUM">주의 (Mid)</option>
                    <option value="HIGH">위험 (High)</option>
                  </select>
                  <input className="input" style={{ flex: 1 }} placeholder="발견 내용을 상세히 입력하세요." {...register('description', { required: true })} />
                </div>
              </div>

              <div className="form-group">
                <label>조치 요구사항</label>
                <textarea className="input" rows={2} placeholder="즉시 조치 또는 작업 중지 요청 등" {...register('actionRequired')} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '저장 중...' : '기록 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
