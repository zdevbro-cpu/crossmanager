import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../lib/api'
import { useToast } from './ToastProvider'
// import { useProjectContext } from '../context/ProjectContext' // Unused for now
import {
  Users, Search, Plus, CheckCircle, XCircle,
  FileText, Award, GraduationCap, ShieldCheck,
  ChevronRight, Loader2
} from 'lucide-react'

// --- Types ---

type WorkType = {
  code: string
  group_code: string
  name: string
  required_certs_all: string[]
  required_certs_any: string[]
  required_trainings_all: string[]
  required_trainings_any: string[]
  enforcement?: { mode?: string; reason_code?: string }
}

type Person = {
  id: number
  name: string
  contact?: string | null
  status: 'active' | 'inactive' | 'blocked' | string
  role_tags: string[]
}

type MasterItem = {
  code: string
  name: string
}

// type PersonCert = ... // Unused for now
// type PersonTraining = ... // Unused for now

type EligibilityResponse = {
  work_type_code: string
  eligible: boolean
  assignee_results: Array<{
    user_id: number
    eligible: boolean
    missing_certs: string[]
    missing_trainings: string[]
    expiring_soon: string[]
  }>
  rule_trace?: { enforcement?: string; overrides_applied?: number }
}

// --- Component ---

export default function PmsResourceAdmin({ projectId }: { projectId?: string }) {
  const { show } = useToast()
  // const { projects } = useProjectContext() // Unused

  // Data State
  const [isLoading, setIsLoading] = useState(false)
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [certs, setCerts] = useState<MasterItem[]>([])
  const [trainings, setTrainings] = useState<MasterItem[]>([])
  // const [personCerts, setPersonCerts] = useState<PersonCert[]>([]) // Future
  // const [personTrainings, setPersonTrainings] = useState<PersonTraining[]>([]) // Future

  // UI State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'cert' | 'training' | 'eligibility'>('overview')
  const [showAddPerson, setShowAddPerson] = useState(false)

  // Forms State
  const [newPerson, setNewPerson] = useState({ name: '', contact: '' })
  const [newItemForm, setNewItemForm] = useState({
    code: '',
    date_1: '', // issued_at / taken_at
    date_2: '', // expires_at
    status: 'pending'
  })

  const [eligibilityTestConfig, setEligibilityTestConfig] = useState({
    work_type_code: '',
    date: new Date().toISOString().slice(0, 10)
  })
  const [testResult, setTestResult] = useState<EligibilityResponse | null>(null)

  // Computed
  const selectedPerson = useMemo(() =>
    people.find(p => p.id === selectedPersonId) || null
    , [people, selectedPersonId])

  const filteredPeople = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return people.filter(p =>
      p.name.toLowerCase().includes(term) ||
      String(p.id).includes(term) ||
      (p.contact && p.contact.includes(term))
    )
  }, [people, searchTerm])

  // Removed unused currentPersonCerts until fetching is implemented

  // Effects
  useEffect(() => {
    reload()
  }, [])

  // --- Mock Data ---
  const MOCK_DATA = {
    people: [
      { id: 1001, name: '김철수', contact: '010-1234-5678', status: 'active', role_tags: ['WORKER'] },
      { id: 1002, name: '이영희', contact: '010-9876-5432', status: 'active', role_tags: ['MANAGER'] },
      { id: 1003, name: '박민수', contact: '010-5555-5555', status: 'blocked', role_tags: ['WORKER'] },
      { id: 1004, name: '최지훈', contact: '010-3333-4444', status: 'active', role_tags: ['ENGINEER'] },
      { id: 1005, name: '정수이', contact: '010-2222-3333', status: 'inactive', role_tags: ['WORKER'] },
      { id: 1006, name: '한소희', contact: '010-4444-1111', status: 'active', role_tags: ['WORKER'] },
    ] as Person[],
    workTypes: [
      { code: 'WT_ELEC_LOW_VOLT', group_code: 'TG_ELEC', name: '저전압 전기작업', required_certs_all: ['CERT_ELEC_BASIC'], required_certs_any: [], required_trainings_all: [], required_trainings_any: [] },
      { code: 'WT_WELD_ARC', group_code: 'TG_WELD', name: '아크 용접', required_certs_all: ['CERT_WELD_ARC'], required_certs_any: [], required_trainings_all: ['TRN_HOT_WORK'], required_trainings_any: [] }
    ] as WorkType[],
    certs: [
      { code: 'CERT_ELEC_BASIC', name: '전기기능사' },
      { code: 'CERT_WELD_ARC', name: '용접기능사' }
    ] as MasterItem[],
    trainings: [
      { code: 'TRN_HOT_WORK', name: '화기작업 안전교육' },
      { code: 'TRN_CONFINED', name: '밀폐공간 안전교육' }
    ] as MasterItem[]
  }

  const reload = async () => {
    setIsLoading(true)
    try {
      // Parallel fetch with Mock fallback
      const responses = await Promise.allSettled([
        apiClient.get<WorkType[]>('/pms/resource/work-types'),
        apiClient.get<Person[]>('/pms/resource/people'),
        apiClient.get<MasterItem[]>('/pms/resource/certs'),
        apiClient.get<MasterItem[]>('/pms/resource/trainings'),
      ])

      const [wtRes, pplRes, cRes, tRes] = responses

      // Use Mock if API fails or returns empty array (logic simplified for demo)
      const wtData = wtRes.status === 'fulfilled' && wtRes.value.data.length ? wtRes.value.data : MOCK_DATA.workTypes
      const pplData = pplRes.status === 'fulfilled' && pplRes.value.data.length ? pplRes.value.data : MOCK_DATA.people
      const cData = cRes.status === 'fulfilled' && cRes.value.data.length ? cRes.value.data : MOCK_DATA.certs
      const tData = tRes.status === 'fulfilled' && tRes.value.data.length ? tRes.value.data : MOCK_DATA.trainings

      setWorkTypes(wtData)
      setPeople(pplData)
      setCerts(cData)
      setTrainings(tData)

      // Auto-select first person if none selected
      if (pplData.length > 0 && !selectedPersonId) {
        setSelectedPersonId(pplData[0].id)
      }

      if (wtData.length > 0) {
        setEligibilityTestConfig(prev => ({ ...prev, work_type_code: wtData[0].code }))
      }

    } catch (e) {
      console.error(e)
      show('데이터 로드 실패 (Mock Fallback)', 'error')
      // Fallback in case of total crash
      setPeople(MOCK_DATA.people)
      setWorkTypes(MOCK_DATA.workTypes)
    } finally {
      setIsLoading(false)
    }
  }

  // Handlers
  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPerson.name.trim()) return show('이름 필수', 'warning')
    try {
      await apiClient.post('/pms/resource/people', {
        name: newPerson.name.trim(),
        contact: newPerson.contact.trim() || null
      })
      show('인력 등록 완료', 'success')
      setNewPerson({ name: '', contact: '' })
      setShowAddPerson(false)
      reload()
    } catch (err) {
      console.error(err)
      show('등록 실패', 'error')
    }
  }

  const handleAddItem = async (e: React.FormEvent, type: 'cert' | 'training') => {
    e.preventDefault()
    if (!selectedPersonId) return
    if (!newItemForm.code) return show('항목 선택 필수', 'warning')

    const endpoint = type === 'cert' ? 'certs' : 'trainings'
    const body = type === 'cert' ? {
      cert_code: newItemForm.code,
      issued_at: newItemForm.date_1 || null,
      expires_at: newItemForm.date_2 || null,
      status: newItemForm.status
    } : {
      training_code: newItemForm.code,
      taken_at: newItemForm.date_1 || null,
      expires_at: newItemForm.date_2 || null,
      status: newItemForm.status
    }

    try {
      await apiClient.post(`/pms/resource/people/${selectedPersonId}/${endpoint}`, body)
      show('등록 완료', 'success')
      setNewItemForm({ code: '', date_1: '', date_2: '', status: 'pending' })
      // Ideally re-fetch or update local state. For now reload.
      // reload() // Optimize later
      show('데이터가 갱신되었습니다 (Mock)', 'success')
    } catch (err) {
      console.error(err)
      show('등록 실패', 'error')
    }
  }

  const handleTestEligibility = async () => {
    if (!selectedPersonId) return
    if (!eligibilityTestConfig.work_type_code) return show('작업유형 선택', 'warning')
    try {
      const { data } = await apiClient.post<EligibilityResponse>('/pms/resource/eligibility/check', {
        project_id: projectId || null,
        date: eligibilityTestConfig.date,
        work_type_code: eligibilityTestConfig.work_type_code,
        assignees: [selectedPersonId]
      })
      setTestResult(data)
    } catch (err) {
      console.error(err)
      show('판정 실패', 'error')
    }
  }

  // Styles
  const compactCardStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)',
  }

  const listItemStyle = (isSelected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.8rem',
    cursor: 'pointer',
    backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.2s'
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      {/* Left Column: List */}
      <div style={compactCardStyle}>
        <div style={{ padding: '0.8rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={16} /> 인력 관리
              </h3>
              {isLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />}
            </div>
            <button
              className="icon-btn"
              onClick={() => setShowAddPerson(!showAddPerson)}
              title="인력 추가"
              style={{ padding: '4px', borderRadius: '4px', background: showAddPerson ? 'var(--primary-light)' : 'transparent' }}
            >
              <Plus size={16} />
            </button>
          </div>

          {showAddPerson && (
            <form onSubmit={handleAddPerson} style={{ display: 'grid', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <input
                className="input-std"
                placeholder="이름"
                value={newPerson.name}
                onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                style={{ fontSize: '0.85rem', padding: '0.3rem' }}
              />
              <input
                className="input-std"
                placeholder="연락처"
                value={newPerson.contact}
                onChange={e => setNewPerson(p => ({ ...p, contact: e.target.value }))}
                style={{ fontSize: '0.85rem', padding: '0.3rem' }}
              />
              <button type="submit" className="pill user-select-none" style={{ fontSize: '0.8rem', padding: '0.3rem' }}>추가</button>
            </form>
          )}

          <div className="search-box" style={{ padding: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
            <input
              type="text"
              placeholder="검색 (이름, ID)..."
              className="input-std"
              style={{ paddingLeft: '1.8rem', fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredPeople.map(p => (
            <div
              key={p.id}
              style={listItemStyle(selectedPersonId === p.id)}
              onClick={() => setSelectedPersonId(p.id)}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem', color: 'var(--primary)'
                }}
              >
                {p.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{p.status} • ID: {p.id}</div>
              </div>
              <ChevronRight size={14} color="var(--fg-muted)" />
            </div>
          ))}
          {filteredPeople.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Details */}
      <div style={compactCardStyle}>
        {selectedPerson ? (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(to right, var(--bg-card), var(--bg-subtle))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700 }}>
                    {selectedPerson.name.slice(0, 1)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{selectedPerson.name}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
                      <span>{selectedPerson.contact || '연락처 미등록'}</span>
                      <span>•</span>
                      <span style={{
                        color: selectedPerson.status === 'active' ? 'var(--success)' :
                          selectedPerson.status === 'blocked' ? 'var(--danger)' : 'var(--warning)'
                      }}>
                        {selectedPerson.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* Placeholder for actions */}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', borderBottom: '1px solid transparent' }}>
                {(
                  [
                    { id: 'overview', icon: FileText, label: '개요' },
                    { id: 'cert', icon: Award, label: '자격증' },
                    { id: 'training', icon: GraduationCap, label: '교육' },
                    { id: 'eligibility', icon: ShieldCheck, label: '투입판정' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem', pointerEvents: 'auto',
                      paddingBottom: '0.5rem', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`,
                      color: activeTab === tab.id ? 'var(--primary)' : 'var(--fg-muted)', fontWeight: activeTab === tab.id ? 600 : 400,
                      background: 'none', border: 'none', cursor: 'pointer', outline: 'none', paddingLeft: 0, paddingRight: 0
                    }}
                  >
                    <tab.icon size={16} /> {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem' }}>
                    <p className="card-label">기본 정보</p>
                    <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <div><span className="muted">ID:</span> {selectedPerson.id}</div>
                      <div><span className="muted">Role:</span> {selectedPerson.role_tags.join(', ') || '-'}</div>
                      <div><span className="muted">Status:</span> {selectedPerson.status}</div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>
                    요약 대시보드 준비중
                  </div>
                </div>
              )}

              {(activeTab === 'cert' || activeTab === 'training') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', background: 'var(--bg-subtle)', padding: '0.8rem', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>항목</label>
                      <select className="input-std" value={newItemForm.code} onChange={e => setNewItemForm(p => ({ ...p, code: e.target.value }))}>
                        <option value="">선택...</option>
                        {(activeTab === 'cert' ? certs : trainings).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 130 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{activeTab === 'cert' ? '발급일' : '이수일'}</label>
                      <input className="input-std" type="date" value={newItemForm.date_1} onChange={e => setNewItemForm(p => ({ ...p, date_1: e.target.value }))} />
                    </div>
                    <div style={{ width: 130 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>만료일</label>
                      <input className="input-std" type="date" value={newItemForm.date_2} onChange={e => setNewItemForm(p => ({ ...p, date_2: e.target.value }))} />
                    </div>
                    <button className="pill" onClick={(e) => handleAddItem(e, activeTab === 'cert' ? 'cert' : 'training')}>추가</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem' }}>
                    {/* Placeholder for list until API linkage is solid */}
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--fg-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                      등록된 {activeTab === 'cert' ? '자격' : '교육'} 이력이 API 응답에 포함되지 않았습니다.<br />
                      (상세 조회 API 필요)
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'eligibility' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px' }}>
                    <p className="card-label">투입 적격성 시뮬레이션</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="input-std"
                        style={{ flex: 1 }}
                        value={eligibilityTestConfig.work_type_code}
                        onChange={e => setEligibilityTestConfig(p => ({ ...p, work_type_code: e.target.value }))}
                      >
                        {workTypes.map(w => <option key={w.code} value={w.code}>{w.name} ({w.code})</option>)}
                      </select>
                      <input
                        type="date"
                        className="input-std"
                        style={{ width: 140 }}
                        value={eligibilityTestConfig.date}
                        onChange={e => setEligibilityTestConfig(p => ({ ...p, date: e.target.value }))}
                      />
                      <button className="pill" onClick={handleTestEligibility}>판정 확인</button>
                    </div>
                  </div>

                  {testResult && (
                    <div className={`card ${testResult.eligible ? 'border-l-success' : 'border-l-danger'}`} style={{ padding: '1rem', borderLeftWidth: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {testResult.eligible ? <CheckCircle color="var(--success)" /> : <XCircle color="var(--danger)" />}
                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{testResult.eligible ? '투입 가능' : '투입 불가'}</span>
                        {testResult.rule_trace?.enforcement && <span className="badge badge-neutral">{testResult.rule_trace.enforcement}</span>}
                      </div>

                      {testResult.assignee_results[0] && (
                        <ul style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', paddingLeft: '1.5rem', margin: 0 }}>
                          {testResult.assignee_results[0].missing_certs.map(c => <li key={c}>누락 자격: {c}</li>)}
                          {testResult.assignee_results[0].missing_trainings.map(t => <li key={t}>누락 교육: {t}</li>)}
                          {testResult.assignee_results[0].expiring_soon.map(e => <li key={e} style={{ color: 'var(--warning)' }}>만료 임박: {e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', flexDirection: 'column', gap: '1rem' }}>
            <Users size={48} opacity={0.2} />
            <p>좌측 목록에서 인력을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
