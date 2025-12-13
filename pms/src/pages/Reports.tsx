import './Page.css'
import { useReports, useCreateReport, useUpdateReport, useUpdateReportStatus, useDeleteReport } from '../hooks/useReports'
import { mockProjects } from '../data/mock'
import { useEffect, useState } from 'react'
import type { Report } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { Trash2, FileText, Edit2 } from 'lucide-react'
import { useRole } from '../hooks/useRole'
import ReportModal from '../components/ReportModal'

function ReportsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()

  // Hooks
  const { data: reports, isLoading } = useReports(selectedId || undefined)
  const createReport = useCreateReport()
  const updateReport = useUpdateReport()
  const updateReportStatus = useUpdateReportStatus()
  const deleteReport = useDeleteReport()
  const { role } = useRole()

  // State
  const [filterType, setFilterType] = useState('ALL')

  const [filterProject, setFilterProject] = useState('ALL')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState<Report | null>(null)
  const [modalMode, setModalMode] = useState<'VIEW' | 'CREATE' | 'EDIT'>('VIEW')

  // Create Form State
  const [form, setForm] = useState({
    projectId: selectedId || 'p1',
    type: 'DAILY',
    title: '',
    createdAt: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    if (selectedId) setForm((prev) => ({ ...prev, projectId: selectedId }))
  }, [selectedId])

  // Create Handler
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.createdAt) { show('날짜는 필수입니다', 'warning'); return }

    const roleMap: Record<string, string> = { 'admin': '관리자', 'manager': '현장소장', 'field': '현장기사', 'safety': '안전관리자' }
    const creatorName = role ? (roleMap[role] || role) : '시스템'

    const typeLabel: Record<string, string> = { 'DAILY': '일일 업무', 'WEEKLY': '주간 공정', 'MONTHLY': '월간', 'AD_HOC': '수시', 'ISSUE': '이슈' }
    const formattedType = typeLabel[form.type] || form.type

    createReport.mutate({
      projectId: form.projectId,
      title: form.title || `${form.createdAt} ${formattedType} 보고`,
      date: form.createdAt,
      type: form.type,
      createdBy: creatorName,
    }, {
      onSuccess: (newReport: any) => {
        show('보고서가 생성되었습니다. 내용을 확인하세요.', 'success')
        setCurrentReport(newReport)
        setModalMode('VIEW')
        setIsModalOpen(true)
        setForm(prev => ({ ...prev, title: '' }))
      },
      onError: () => show('보고서 생성 실패', 'error')
    })
  }

  const handleRowClick = (r: Report) => {
    setCurrentReport(r)
    setModalMode('VIEW')
    setIsModalOpen(true)
  }

  const filteredReports = reports?.filter(r => {
    if (filterType !== 'ALL') {
      let contentType = (r.content as any)?.type
      if (!contentType) {
        if (r.title.includes('주간')) contentType = 'WEEKLY'
        else if (r.title.includes('월간')) contentType = 'MONTHLY'
        else if (r.title.includes('수시')) contentType = 'AD_HOC'
        else contentType = 'DAILY'
      }
      if (contentType !== filterType) return false
    }

    if (filterProject !== 'ALL' && r.projectId !== filterProject) return false
    return true
  })

  // Permission Checks
  const canDeleteReports = role !== 'field'
  const isApprover = role === 'sysadmin' || role === 'executive' || role === 'manager'

  return (
    <div className="page" style={{ paddingBottom: '4rem' }}>
      <header className="section-header">
        <div>
          <p className="eyebrow">문서/보고 자동화</p>
          <h2>보고서 관리 (Reports)</h2>
          <p className="muted">PMS/SMS/EMS 데이터를 통합하여 보고서를 생성, 검토 및 승인합니다.</p>
        </div>
      </header>

      {/* Creation Panel (Mini) */}
      <section className="card" style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <form className="form-inline" onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="text-xs muted">프로젝트</span>
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="input-sm" style={{ width: '240px', height: '42px', fontSize: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}>
              {mockProjects.map(p => <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="text-xs muted">보고유형</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-sm" style={{ height: '42px', fontSize: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}>
              <option value="DAILY" style={{ background: '#1e293b' }}>일일 업무 보고</option>
              <option value="WEEKLY" style={{ background: '#1e293b' }}>주간 공정 보고</option>
              <option value="MONTHLY" style={{ background: '#1e293b' }}>월간 종합 보고</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="text-xs muted">기준일자</span>
            <input type="date" value={form.createdAt} onChange={(e) => setForm({ ...form, createdAt: e.target.value })} className="input-sm" style={{ height: '42px', fontSize: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }} />
          </label>
          <button type="submit" className="btn-secondary" disabled={createReport.isPending} style={{
            height: '42px',
            padding: '0 1.5rem',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#10b981',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileText size={18} style={{ marginRight: '8px' }} />
            {createReport.isPending ? '생성 중...' : '보고서 작성'}
          </button>
        </form>
      </section>

      {/* List Table */}
      <section className="card table-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 500px)', overflow: 'hidden' }}>
        <div className="table-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={24} className="muted" />
            <p className="card-label" style={{ margin: 0 }}>보고서 목록 <span className="muted" style={{ fontWeight: 400 }}>({filteredReports?.length || 0}건)</span></p>
          </div>
          <div className="filters" style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="input-sm" style={{ width: '260px', height: '40px', fontSize: '0.95rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}>
              <option value="ALL" style={{ background: '#1e293b' }}>전체 현장</option>
              {mockProjects.map(p => <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>{p.name}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-sm" style={{ width: '160px', height: '40px', fontSize: '0.95rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}>
              <option value="ALL" style={{ background: '#1e293b' }}>전체 유형</option>
              <option value="DAILY" style={{ background: '#1e293b' }}>일일</option>
              <option value="WEEKLY" style={{ background: '#1e293b' }}>주간</option>
              <option value="MONTHLY" style={{ background: '#1e293b' }}>월간</option>
            </select>
          </div>
        </div>

        <div className="table reports-table custom-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '0.35rem' }}>
          <div className="table-row table-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', margin: 0, borderRadius: '6px 6px 0 0' }}>
            <span style={{ flex: 2 }}>제목</span>
            <span style={{ flex: 1 }}>날짜</span>
            <span style={{ flex: 1 }}>작성자</span>
            <span style={{ flex: 1 }}>상태</span>
            <span style={{ flex: 0.5, textAlign: 'center' }}>관리</span>
          </div>
          {isLoading && <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>로딩중...</p>}

          {filteredReports?.map((r: Report) => (
            <div
              key={r.id}
              className="table-row hover-effect"
              onClick={() => handleRowClick(r)}
              style={{ cursor: 'pointer', height: '54px', alignItems: 'center', flex: '0 0 auto' }}
            >
              <span style={{ flex: 2, fontWeight: 500, color: '#e2e8f0' }}>{r.title}</span>
              <span style={{ flex: 1 }}>{r.reportDate?.slice(0, 10)}</span>
              <span style={{ flex: 1 }}>{r.createdBy || '-'}</span>
              <span style={{ flex: 1 }}>
                <span className={`pill ${r.status === 'APPROVED' ? 'pill-success' : r.status === 'REJECTED' ? 'pill-danger' : r.status === 'PENDING' ? 'pill-warning' : 'pill-neutral'}`}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  {r.status === 'PENDING' ? '결재중' : r.status === 'APPROVED' ? '승인완료' : r.status === 'REJECTED' ? '반려됨' : '작성중'}
                </span>
              </span>
              <span style={{ flex: 0.5, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                {canDeleteReports && (
                  <>
                    <button className="icon-button" onClick={(e) => {
                      e.stopPropagation()
                      handleRowClick(r)
                      // Ideally set mode to edit, but handleRowClick sets it to VIEW.
                      // Let's refactor handleRowClick or set mode separately after.
                      // Actually, let's just create a separate handler or set state here.
                      setModalMode('EDIT') // Ensure this overrides handleRowClick if we reuse it,
                      // or better: don't call handleRowClick, call specific logic.
                      setCurrentReport(r)
                      setIsModalOpen(true)
                    }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="icon-button" onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('정말 삭제하시겠습니까?')) {
                        deleteReport.mutate(r.id)
                      }
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
          {reports?.length === 0 && !isLoading && <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>보고서가 없습니다.</div>}
        </div>
      </section>

      {/* Modal */}
      {currentReport && (
        <ReportModal
          isOpen={isModalOpen}
          mode={modalMode}
          report={currentReport}
          onClose={() => setIsModalOpen(false)}
          isApprover={isApprover}
          onSave={(updatedData) => {
            updateReport.mutate({ id: currentReport.id, data: { content: updatedData } }, {
              onSuccess: () => { show('저장되었습니다.', 'success'); setIsModalOpen(false) }
            })
          }}
          onStatusChange={(id, status, comment) => {
            updateReportStatus.mutate({ id, status, comment }, {
              onSuccess: () => {
                show(status === 'PENDING' ? '결재가 상신되었습니다.' : status === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.', 'success')
                setIsModalOpen(false)
              },
              onError: () => show('상태 변경 실패', 'error')
            })
          }}
        />
      )}
    </div>
  )
}

export default ReportsPage
