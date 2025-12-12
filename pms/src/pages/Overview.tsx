import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReports, useUpdateReport, useUpdateReportStatus } from '../hooks/useReports'
import { useProjectContext } from '../context/ProjectContext'
import { useRole } from '../hooks/useRole'
import { useToast } from '../components/ToastProvider'
import ReportModal from '../components/ReportModal'
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  X
} from 'lucide-react'
import './Page.css'
import type { Report } from '../types/pms'

export default function OverviewPage() {
  const { selectedId } = useProjectContext()
  const navigate = useNavigate()
  const { role } = useRole()
  const { show } = useToast()

  const { data: reports, isLoading } = useReports(selectedId || undefined)
  const updateReport = useUpdateReport()
  const updateReportStatus = useUpdateReportStatus()

  // Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState<Report | null>(null)
  const [isPendingListOpen, setIsPendingListOpen] = useState(false)

  // Calculate Metrics
  const totalReports = reports?.length || 0
  const pendingReportsList = reports?.filter(r => r.status === 'PENDING') || []
  const pendingReports = pendingReportsList.length
  const approvedReports = reports?.filter(r => r.status === 'APPROVED').length || 0
  const rejectedReports = reports?.filter(r => r.status === 'REJECTED').length || 0
  const draftReports = reports?.filter(r => r.status === 'DRAFT').length || 0

  // Recent Reports (Top 5)
  const recentReports = reports?.slice(0, 5) || []

  // Approver Check
  const isApprover = role === 'sysadmin' || role === 'executive' || role === 'manager'

  const handleReportClick = (r: Report) => {
    setCurrentReport(r)
    setIsDetailModalOpen(true)
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">Project Overview</p>
          <h2>임원용 통합 대시보드</h2>
          <p className="muted">프로젝트의 주요 현황과 결재 대기 문서를 한눈에 파악합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-live">Live Data</span>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(30, 41, 59, 0.4))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="card-label" style={{ color: '#60a5fa' }}><FileText size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />총 보고서</p>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#white' }}>{totalReports}</span>
          </div>
          <div className="progress-bar" style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem' }}>
            <div style={{ width: '100%', height: '100%', background: '#3b82f6', borderRadius: '3px' }}></div>
          </div>
        </div>

        <div
          className="card hover-effect"
          onClick={() => setIsPendingListOpen(true)}
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(30, 41, 59, 0.4))', border: '1px solid rgba(245, 158, 11, 0.3)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="card-label" style={{ color: '#fbbf24' }}><Clock size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />결재 대기</p>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24' }}>{pendingReports}</span>
          </div>
          <p className="text-xs muted" style={{ marginTop: '0.5rem' }}>결재대기 : {pendingReports} 건</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(30, 41, 59, 0.4))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="card-label" style={{ color: '#34d399' }}><CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />승인 완료</p>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399' }}>{approvedReports}</span>
          </div>
          <p className="text-xs muted" style={{ marginTop: '0.5rem' }}>전체 대비 승인율 {totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0}%</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="card-label"><Activity size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />작성 중 (Draft)</p>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#94a3b8' }}>{draftReports}</span>
          </div>
          <p className="text-xs muted" style={{ marginTop: '0.5rem' }}>반려된 문서: {rejectedReports}건</p>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Recent Reports Table */}
        <section className="card">
          <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>최근 보고서 현황</h3>
            <button
              onClick={() => navigate('/reports')}
              style={{
                backgroundColor: '#172554', // Dark Blue
                color: '#60a5fa', // Blue Text
                border: '1px solid #3b82f6', // Blue Border
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              전체보기
            </button>
          </div>

          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 500 }}>제목</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 500 }}>날짜</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 500 }}>작성자</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 500 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }} className="muted">데이터를 불러오는 중...</td></tr>
                ) : recentReports.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }} className="muted">등록된 보고서가 없습니다.</td></tr>
                ) : (
                  recentReports.map(r => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                      onClick={() => handleReportClick(r)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', color: '#e2e8f0' }}>{r.title}</td>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{r.reportDate?.slice(0, 10)}</td>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{r.createdBy || '-'}</td>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        <span className={`pill ${r.status === 'APPROVED' ? 'pill-success' :
                          r.status === 'REJECTED' ? 'pill-danger' :
                            r.status === 'PENDING' ? 'pill-warning' : 'pill-neutral'
                          } `} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                          {r.status === 'PENDING' ? '결재중' : r.status === 'APPROVED' ? '승인' : r.status === 'REJECTED' ? '반려' : '작성'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* System Status / Quick Actions */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', background: '#1e293b' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>빠른 실행</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '0.8rem' }}>
                <AlertTriangle size={18} style={{ marginRight: '8px' }} /> 안전 이슈 보고
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>시스템 상태</h3>
            <ul className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: 0, listStyle: 'none' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">PMS Server</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>◎ Online</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">DB Connection</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>◎ Stable</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Last Sync</span>
                <span className="muted">Just now</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Reports Detail Modal */}
      {currentReport && (
        <ReportModal
          isOpen={isDetailModalOpen}
          mode="VIEW"
          report={currentReport}
          onClose={() => setIsDetailModalOpen(false)}
          isApprover={isApprover}
          onSave={(updatedData) => {
            updateReport.mutate({ id: currentReport.id, data: { content: updatedData } }, {
              onSuccess: () => { show('저장되었습니다.', 'success'); setIsDetailModalOpen(false) }
            })
          }}
          onStatusChange={(id, status, comment) => {
            updateReportStatus.mutate({ id, status, comment }, {
              onSuccess: () => {
                show(status === 'PENDING' ? '결재가 상신되었습니다.' : status === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.', 'success')
                setIsDetailModalOpen(false)
                setIsPendingListOpen(false) // Close list if open
              },
              onError: () => show('상태 변경 실패', 'error')
            })
          }}
        />
      )}

      {/* Pending List Modal */}
      {isPendingListOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <div className="modal-content" style={{ width: '600px', background: '#0b1324', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: 0 }}>결재 대기 문서 ({pendingReports}건)</h3>
              <button className="icon-button" onClick={() => setIsPendingListOpen(false)}><X /></button>
            </div>
            <div className="modal-body custom-scroll" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0' }}>
              {pendingReports === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>결재 대기 중인 문서가 없습니다.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {pendingReportsList.map(r => (
                      <tr
                        key={r.id}
                        className="hover-effect"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                        onClick={() => handleReportClick(r)}
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{r.title}</div>
                          <div className="text-sm muted">{r.createdBy} · {r.reportDate?.slice(0, 10)}</div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <span className="pill pill-warning">결재대기</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
