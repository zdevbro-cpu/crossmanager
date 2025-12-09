
import { useEffect, useState, useMemo } from 'react'
import { Plus, AlertTriangle, Calendar, MapPin, Camera, X, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useToast } from '../components/ToastProvider'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import './Page.css'

interface Incident {
  id: string
  project_id: string
  type: string
  title: string
  date: string
  time: string
  place: string
  description: string
  thumbnail?: string
  status: string
  reporter: string
}

export default function IncidentPage() {
  const { show: showToast } = useToast()
  const { selectedProjectId } = useProject()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  useEffect(() => {
    Promise.all([
      apiClient.get('/sms/incidents').then(res => setIncidents(res.data)),
      apiClient.get('/projects').then(res => setProjects(res.data))
    ]).finally(() => setLoading(false))
  }, [])

  const filteredIncidents = useMemo(() => {
    if (selectedProjectId === 'ALL') return incidents
    return incidents.filter(inc => inc.project_id === selectedProjectId)
  }, [incidents, selectedProjectId])

  const onSubmit = async (data: any) => {
    try {
      await apiClient.post('/sms/incidents', { ...data, photos: uploadedPhotos })
      showToast('사고 보고가 접수되었습니다.', 'success')
      setIsModalOpen(false)
      reset()
      setUploadedPhotos([])
      // Refresh list
      const res = await apiClient.get('/sms/incidents')
      setIncidents(res.data)
    } catch { showToast('접수 실패', 'error') }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Simple base64 conversion for demo (in production, upload to cloud storage)
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedPhotos(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const getTypeStyle = (type: string) => {
    return type === '아차사고' ? 'badge-primary' : type === '사고' ? 'badge-error' : 'badge'
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SMS Module</p>
          <h1>사고 / 아차사고 (Incident)</h1>
          <p className="muted">현장에서 발생한 사고 및 아차사고를 신속하게 보고하고 관리합니다.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> 사고 보고
        </button>
      </header>

      {/* Incident List */}
      <div className="grid three">
        {filteredIncidents.map(inc => (
          <div
            key={inc.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedIncident(inc)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className={`badge ${getTypeStyle(inc.type)}`}>{inc.type}</span>
              <span className="badge badge-tag">{inc.status}</span>
            </div>

            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inc.title}
            </h3>

            <div style={{ marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {new Date(inc.date).toLocaleDateString()} {inc.time}
            </div>

            <div style={{ marginBottom: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {inc.place}
            </div>

            {inc.thumbnail ? (
              <div style={{ aspectRatio: '16/9', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <img src={inc.thumbnail} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ padding: '2rem', background: 'var(--bg-surface-hover)', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem' }}>
                <Camera size={24} color="var(--text-tertiary)" />
                <p className="muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>사진 없음</p>
              </div>
            )}

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {inc.description}
            </p>
          </div>
        ))}
      </div>

      {filteredIncidents.length === 0 && !loading && (
        <section className="empty-state">
          <AlertTriangle size={48} className="empty-icon" />
          <h3>등록된 사고/아차사고 내역이 없습니다.</h3>
          <p>안전한 현장을 위해 작은 아차사고라도 놓치지 않고 기록하세요.</p>
        </section>
      )}

      {/* Report Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="modal-header">
              <h2>사고/아차사고 보고</h2>
              <button className="btn-text" onClick={() => { setIsModalOpen(false); setUploadedPhotos([]); }}><X size={24} /></button>
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
                  <label>구분</label>
                  <select className="input" {...register('type')}>
                    <option value="아차사고">아차사고 (Near Miss)</option>
                    <option value="사고">사고 (Accident)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>발생 일시</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="date" className="input" {...register('date', { required: true })} />
                    <input type="time" className="input" {...register('time', { required: true })} />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>제목 (사고 내용 요약)</label>
                <input className="input" placeholder="예: 자재 인양 중 낙하물 발생 (인적 피해 없음)" {...register('title', { required: true })} />
              </div>

              <div className="form-group">
                <label>발생 장소</label>
                <input className="input" placeholder="예: 101동 3층 계단실" {...register('place')} />
              </div>

              <div className="form-group">
                <label>상세 경위</label>
                <textarea className="input" rows={4} placeholder="6하 원칙에 의거하여 상세히 기술하세요." {...register('description', { required: true })} />
              </div>

              <div className="form-group">
                <label>사진 첨부</label>
                <div style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', background: 'var(--bg-surface-hover)' }}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={32} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 600 }}>클릭하여 사진 업로드</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>여러 장 선택 가능</p>
                  </label>
                </div>
                {uploadedPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {uploadedPhotos.map((photo, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={photo} alt={`Upload ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => setUploadedPhotos(prev => prev.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={16} color="#fff" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setUploadedPhotos([]); }}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '보고 중...' : '보고 제출'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIncident && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <header className="modal-header">
              <div>
                <span className={`badge ${getTypeStyle(selectedIncident.type)}`} style={{ marginBottom: '0.5rem' }}>{selectedIncident.type}</span>
                <h2 style={{ margin: '0.5rem 0 0 0' }}>{selectedIncident.title}</h2>
              </div>
              <button className="btn-text" onClick={() => setSelectedIncident(null)}><X size={24} /></button>
            </header>

            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>발생 일시</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {new Date(selectedIncident.date).toLocaleDateString()} {selectedIncident.time}
                  </p>
                </div>
                <div>
                  <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>발생 장소</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    <MapPin size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {selectedIncident.place}
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>상세 경위</p>
                <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedIncident.description}</p>
              </div>

              {selectedIncident.thumbnail && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>첨부 사진</p>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={selectedIncident.thumbnail} alt="Evidence" style={{ width: '100%', display: 'block' }} />
                  </div>
                </div>
              )}

              <div className="form-grid">
                <div>
                  <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>보고자</p>
                  <p style={{ margin: 0 }}>{selectedIncident.reporter || '관리자'}</p>
                </div>
                <div>
                  <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>처리 상태</p>
                  <span className="badge badge-tag">{selectedIncident.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
