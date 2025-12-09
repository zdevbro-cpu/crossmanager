import { useState, useEffect } from 'react'
import { Camera, MapPin, Save, RotateCcw, Check, X as XIcon, ChevronRight } from 'lucide-react'
import './Page.css'
import { useToast } from '../components/ToastProvider'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'

// Sample Templates (Later move to DB)
const CHECKLIST_TEMPLATES = [
  {
    id: 'TPL001',
    title: '고소작업차 작업 전 점검',
    items: [
      '아우트리거 설치 및 지반 상태 확인',
      '작업대 난간 및 안전장치 작동 여부확인',
      '안전대 부착설비 상태 및 체결 확인',
      '신호수 배치 및 작업 반경 통제',
      '작업자 안전모 및 보호구 착용 상태'
    ]
  },
  {
    id: 'TPL002',
    title: '굴착기 작업 안전 점검',
    items: [
      '작업 반경 내 접근 금지 조치 및 유도원 배치',
      '후방 카메라 및 경보장치 작동 확인',
      '버켓 연결핀 및 안전핀 체결 상태',
      '지반 침하 우려 구간 보강 조치',
      '운전자 자격 및 보험 가입 여부 확인'
    ]
  },
  {
    id: 'TPL003',
    title: '가설 전기 분전반 점검',
    items: [
      '누전차단기 작동 테스트 (시험 버튼)',
      '외함 접지 연결 상태 확인',
      '케이블 피복 손상 여부 및 결선 상태',
      '충전부 방호 조치 (덮개 등)',
      '분전반 앞 적재물 없음 확인'
    ]
  },
  {
    id: 'TPL004',
    title: '비계 설치 및 해체 안전 점검',
    items: [
      '지반 상태 및 깔목 설치 확인',
      '벽이음 설치 간격 및 체결 상태 확인',
      '작업 발판 고정 여부 및 틈새 유무',
      '안전 난간 (상부, 중간 난간대) 설치 상태',
      '승강 및 이동 통로 설치 여부'
    ]
  },
  {
    id: 'TPL005',
    title: '밀폐구역 작업 전 점검',
    items: [
      '작업 전 산소 및 유해가스 농도 측정',
      '환기 설비 설치 및 작동 상태 확인',
      '송기 마스크 등 호흡 보호구 비치',
      '외부 감시인 배치 및 비상 연락 체계 구축',
      '작업자 특별 안전 교육 실시 여부'
    ]
  },
  {
    id: 'TPL006',
    title: '철근 배근 작업 점검',
    items: [
      '철근 인양 시 결속 상태 및 줄걸이 점검',
      '가공 작업장 주변 정리정돈 상태',
      '철근 찔림 방지용 캡 설치 여부',
      '작업 발판 및 통로 확보 상태',
      '개인 보호구 착용 철저'
    ]
  },
  {
    id: 'TPL007',
    title: '콘크리트 타설 작업 점검',
    items: [
      '펌프카 아우트리거 설치 상태 확인',
      '타설 호스 요동 방지 조치',
      '거푸집 및 동바리 변형 유무 수시 확인',
      '진동기 전선 피복 관리 상태',
      '신호수 배치 및 작업자 간 수신호 확인'
    ]
  },
  {
    id: 'TPL008',
    title: '가설 통로 및 계단 점검',
    items: [
      '미끄럼 방지 조치 여부',
      '안전 난간 설치 높이 및 견고성',
      '통로 조도 확보 상태',
      '통행 방해 자재 및 장애물 제거',
      '경사로 기울기 적정성 확인 (30도 이하)'
    ]
  }
]

type CheckStatus = 'Y' | 'N' | 'NA' | null

export default function ChecklistPage() {
  const { show: showToast } = useToast()
  const { selectedProjectId, selectedProject } = useProject()

  const [view, setView] = useState<'LIST' | 'FORM' | 'HISTORY'>('LIST')
  const [selectedTemplate, setSelectedTemplate] = useState<typeof CHECKLIST_TEMPLATES[0] | null>(null)
  const [checks, setChecks] = useState<Record<number, CheckStatus>>({})
  const [checklists, setChecklists] = useState<any[]>([])
  const [selectedChecklist, setSelectedChecklist] = useState<any | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      fetchChecklists()
    }
  }, [selectedProjectId])

  const fetchChecklists = async () => {
    try {
      const res = await apiClient.get('/sms/checklists')
      setChecklists(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleStartCheck = (tpl: typeof CHECKLIST_TEMPLATES[0]) => {
    setSelectedTemplate(tpl)
    setChecks({})
    setView('FORM')
  }

  const handleToggle = (idx: number, status: CheckStatus) => {
    setChecks(prev => ({
      ...prev,
      [idx]: prev[idx] === status ? null : status
    }))
  }

  const handleSubmit = async () => {
    // Basic validation
    if (selectedTemplate && selectedTemplate.items.some((_, idx) => !checks[idx])) {
      showToast('모든 항목을 점검해주세요.', 'error')
      return
    }

    if (!selectedProjectId) {
      showToast('프로젝트를 선택해주세요.', 'error')
      return
    }

    try {
      await apiClient.post('/sms/checklists', {
        projectId: selectedProjectId,
        templateId: selectedTemplate?.id,
        title: selectedTemplate?.title,
        results: checks
      })

      showToast('점검 결과가 저장되었습니다.', 'success')
      fetchChecklists() // Refresh checklist data
      setView('LIST')
    } catch (err) {
      console.error(err)
      showToast('저장 중 오류가 발생했습니다.', 'error')
    }
  }

  // Filter checklists by selected project
  const filteredChecklists = selectedProjectId === 'ALL'
    ? checklists
    : checklists.filter(checklist => checklist.project_id === selectedProjectId)

  return (
    <div className="page" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">SMS Mobile</p>
          <h1>{view === 'LIST' ? '현장 안전 점검 수행' : view === 'HISTORY' ? '점검 이력' : selectedTemplate?.title}</h1>
          <p className="muted">
            {view === 'LIST' ? '점검할 안전 항목을 선택하여 점검을 시작하세요.' :
              view === 'HISTORY' ? `${selectedProject?.name || '프로젝트'} 점검 이력` :
                new Date().toLocaleDateString() + ' 실시간 점검 중'}
          </p>
        </div>
      </header>

      {view === 'LIST' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setView('HISTORY')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              📋 점검 이력 보기 ({filteredChecklists.length}건)
            </button>
          </div>

          <div className="grid">
            {CHECKLIST_TEMPLATES.map(tpl => (
              <div
                key={tpl.id}
                className="card checklist-card"
                onClick={() => handleStartCheck(tpl)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <span className="badge badge-tag" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>{tpl.id}</span>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{tpl.title}</h3>
                  <p className="muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>총 {tpl.items.length}개 점검 항목</p>
                </div>
                <ChevronRight size={24} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'HISTORY' && (
        <div>
          <button
            className="btn-secondary"
            onClick={() => setView('LIST')}
            style={{ marginBottom: '1rem' }}
          >
            <RotateCcw size={18} /> 돌아가기
          </button>

          {filteredChecklists.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
              <p className="muted">선택한 프로젝트의 점검 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="grid">
              {filteredChecklists.map(checklist => {
                const template = CHECKLIST_TEMPLATES.find(t => t.id === checklist.template_id)
                const results = typeof checklist.results === 'string' ? JSON.parse(checklist.results) : checklist.results
                const totalItems = template?.items.length || 0
                const passedItems = Object.values(results).filter(r => r === 'Y').length
                const failedItems = Object.values(results).filter(r => r === 'N').length

                return (
                  <div
                    key={checklist.id}
                    className="card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedChecklist(checklist)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                      <span className="badge badge-tag">{checklist.template_id}</span>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {new Date(checklist.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{checklist.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span className="badge badge-live">✓ {passedItems}건</span>
                      {failedItems > 0 && <span className="badge badge-error">✗ {failedItems}건</span>}
                      <span className="muted">총 {totalItems}개 항목</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {view === 'FORM' && selectedTemplate && (
        <div className="checklist-form">
          {selectedTemplate.items.map((item, idx) => (
            <div key={idx} className="check-item-card">
              <div className="check-text">
                <span className="check-idx">{idx + 1}</span>
                <p>{item}</p>
              </div>
              <div className="check-actions">
                <button
                  className={`check-btn yes ${checks[idx] === 'Y' ? 'active' : ''}`}
                  onClick={() => handleToggle(idx, 'Y')}
                >
                  <Check size={20} /> 적합
                </button>
                <button
                  className={`check-btn no ${checks[idx] === 'N' ? 'active' : ''}`}
                  onClick={() => handleToggle(idx, 'N')}
                >
                  <XIcon size={20} /> 부적합
                </button>
              </div>
            </div>
          ))}

          <div className="panel" style={{ marginTop: '1.5rem' }}>
            <p className="eyebrow">증빙 자료</p>
            <div className="form-grid" style={{ marginTop: '0.5rem' }}>
              <button className="btn-secondary" style={{ justifyContent: 'center', height: '48px' }}>
                <Camera size={18} /> 사진 촬영
              </button>
              <button className="btn-secondary" style={{ justifyContent: 'center', height: '48px' }}>
                <MapPin size={18} /> 위치 인증 (GPS)
              </button>
            </div>
          </div>

          <div className="fixed-bottom-actions">
            <button className="btn-secondary" onClick={() => setView('LIST')}>
              <RotateCcw size={18} /> 취소
            </button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>
              <Save size={18} /> 점검 완료
            </button>
          </div>
        </div>
      )}

      {/* Checklist Detail Modal */}
      {selectedChecklist && (
        <div className="modal-overlay" onClick={() => setSelectedChecklist(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <header className="modal-header">
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="badge badge-tag">{selectedChecklist.template_id}</span>
                  <span className="muted" style={{ fontSize: '0.9rem' }}>
                    {new Date(selectedChecklist.created_at).toLocaleDateString()} {new Date(selectedChecklist.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <h2 style={{ margin: 0 }}>{selectedChecklist.title}</h2>
              </div>
              <button className="btn-text" onClick={() => setSelectedChecklist(null)}>
                <XIcon size={24} />
              </button>
            </header>

            <div className="modal-body">
              {(() => {
                const template = CHECKLIST_TEMPLATES.find(t => t.id === selectedChecklist.template_id)
                const results = typeof selectedChecklist.results === 'string'
                  ? JSON.parse(selectedChecklist.results)
                  : selectedChecklist.results

                if (!template) {
                  return <p className="muted">템플릿을 찾을 수 없습니다.</p>
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {template.items.map((item, idx) => {
                      const status = results[idx]
                      return (
                        <div key={idx} className="panel" style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <span className="badge" style={{ fontSize: '0.75rem' }}>{idx + 1}</span>
                                <p style={{ margin: 0, fontSize: '0.95rem' }}>{item}</p>
                              </div>
                            </div>
                            <div>
                              {status === 'Y' && (
                                <span className="badge badge-live" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Check size={16} /> 적합
                                </span>
                              )}
                              {status === 'N' && (
                                <span className="badge badge-error" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <XIcon size={16} /> 부적합
                                </span>
                              )}
                              {status === 'NA' && (
                                <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  해당없음
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedChecklist(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
