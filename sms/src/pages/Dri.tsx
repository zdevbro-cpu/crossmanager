import { useEffect, useState, useMemo } from 'react'
import { Plus, FileText, Users, MapPin, X, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import './Page.css'
import { apiClient } from '../lib/api'
import { useProject } from '../contexts/ProjectContext'
import type { Dri, RiskAssessment } from '../types/sms'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ToastProvider'
import Spinner from '../components/Spinner'

interface DriForm {
  projectId: string
  raId: string // To populate risk points
  date: string
  location: string
  workContent: string
  attendeesCount: number
}

export default function DriPage() {
  const { user } = useAuth()
  const { show: showToast } = useToast()
  const { selectedProjectId } = useProject()

  const [dris, setDris] = useState<Dri[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [ras, setRas] = useState<RiskAssessment[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [raItems, setRaItems] = useState<any[]>([]) // High risk items for selected RA

  // Filter State
  const [searchTerm, setSearchTerm] = useState('')

  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<DriForm>()
  const selectedRaId = watch('raId')

  useEffect(() => {
    Promise.all([
      fetchDris(),
      fetchProjects(),
      fetchRas()
    ]).finally(() => setLoading(false))
  }, [])

  // When RA is selected, fetch its risk items to auto-populate risk points
  useEffect(() => {
    if (selectedRaId) {
      apiClient.get(`/sms/risk-assessments/${selectedRaId}`).then(res => {
        // Filter items with Risk Level >= 4 (Medium/High)
        const highRiskItems = res.data.items.filter((item: any) => (item.frequency * item.severity) >= 4)
        setRaItems(highRiskItems)
      }).catch(console.error)
    } else {
      setRaItems([])
    }
  }, [selectedRaId])

  const filteredDris = useMemo(() => {
    return dris.filter(dri => {
      const matchesSearch =
        dri.work_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dri.location.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProject = selectedProjectId === 'ALL' || dri.project_id === selectedProjectId

      return matchesSearch && matchesProject
    })
  }, [dris, searchTerm, selectedProjectId])

  const fetchDris = async () => {
    try {
      const { data } = await apiClient.get<Dri[]>('/sms/dris')
      setDris(data)
    } catch (err) { console.error(err) }
  }

  const fetchProjects = async () => apiClient.get('/projects').then(res => setProjects(res.data))
  const fetchRas = async () => apiClient.get('/sms/risk-assessments').then(res => setRas(res.data))

  const onSubmit = async (data: DriForm) => {
    if (!user) return

    // Format risk points from auto-loaded items
    const riskPoints = raItems.map(item => `[${item.risk_factor}] ${item.mitigation_measure}`).join('\n')

    try {
      await apiClient.post('/sms/dris', {
        ...data,
        riskPoints, // Auto-filled
        createdBy: user.email,
        photoUrl: null // Placeholder
      })
      showToast('DRI(위험예지) 활동이 등록되었습니다.', 'success')
      setIsModalOpen(false)
      reset()
      fetchDris()
    } catch (err) {
      console.error(err)
      showToast('등록에 실패했습니다.', 'error')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>일일·작업전 위험예지 (DRI)</h1>
          <p className="muted">
            매일 작업 전 TBM 활동을 기록하고 주요 위험요인을 공유합니다.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          TBM 등록
        </button>
      </header>

      {/* Search Toolbar */}
      <section className="panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="input"
            placeholder="작업 내용 또는 장소 검색..."
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      {/* Today's TBM List */}
      {filteredDris.length === 0 ? (
        <section className="empty-state">
          <FileText size={48} className="empty-icon" />
          <h3>검색 결과가 없습니다.</h3>
          <p>조건을 변경하거나 새로운 TBM 활동을 등록해주세요.</p>
        </section>
      ) : (
        <div className="grid three">
          {filteredDris.map(dri => {
            const project = projects.find(p => p.id === dri.project_id)
            return (
              <div key={dri.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Line 1: Project Name */}
                <div>
                  <span className="badge badge-tag">{project?.name || '현장 미정'}</span>
                </div>
                {/* Line 2: Date (Right Aligned) */}
                <div style={{ textAlign: 'right' }}>
                  <span className="task-id">{new Date(dri.date || dri.created_at).toLocaleDateString()}</span>
                </div>

                <h3 style={{ margin: '0.25rem 0', fontSize: '1.1rem' }}>{dri.work_content}</h3>

                <div className="milestone-meta">
                  <MapPin size={14} /> {dri.location}
                </div>
                <div className="milestone-meta">
                  <Users size={14} /> 참석 {dri.attendees_count}명
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>중점 위험관리</p>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                    {dri.risk_points || '등록된 위험 포인트 없음'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="modal-header">
              <h2>새 TBM 활동 등록</h2>
              <button className="btn-text" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="form-grid">
              <div className="form-group full">
                <label>현장 선택</label>
                <select {...register('projectId', { required: true })} className="input">
                  <option value="">현장을 선택하세요</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full">
                <label>오늘의 공정 (RA 데이터 연동)</label>
                <select {...register('raId', { required: true })} className="input">
                  <option value="">공정을 선택하면 위험포인트가 자동 로드됩니다</option>
                  {ras.map(ra => (
                    <option key={ra.id} value={ra.id}>{ra.process_name}</option>
                  ))}
                </select>
              </div>

              {raItems.length > 0 && (
                <div className="full" style={{ padding: '1rem', background: 'rgba(255, 111, 111, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 111, 111, 0.3)' }}>
                  <p className="eyebrow" style={{ color: '#ffc2c2' }}>⚠️ 자동 감지된 고위험 요인</p>
                  <ul className="list" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ffc2c2' }}>
                    {raItems.map((item, idx) => (
                      <li key={idx}>{item.risk_factor} → {item.mitigation_measure}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="form-group">
                <label>작업 일자</label>
                <input type="date" {...register('date')} className="input" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="form-group">
                <label>작업 장소</label>
                <input {...register('location', { required: true })} className="input" placeholder="예: 101동 3층" />
              </div>

              <div className="form-group full">
                <label>세부 작업 내용</label>
                <input {...register('workContent', { required: true })} className="input" placeholder="금일 수행할 구체적인 작업을 입력하세요" />
              </div>

              <div className="form-group">
                <label>참석 인원 (명)</label>
                <input type="number" {...register('attendeesCount')} className="input" defaultValue={1} />
              </div>

              <div className="full" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '등록 중...' : '활동 등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
