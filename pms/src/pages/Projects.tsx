
import './Page.css'
import { useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { mockProjects } from '../data/mock'
import { apiClient } from '../lib/api'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { CheckCircle, Trash2, Plus } from 'lucide-react'
import type { Project } from '../types/pms'
import { validateDateRange } from '../utils/validation'
import { usePersonnel } from '../hooks/usePersonnel'
import DocChecklist from '../components/DocChecklist'

const constructionTypeOptions = [
  { code: 'DC', label: '해체/철거' },
  { code: 'CN', label: '신축' },
  { code: 'RF', label: '리모델' },
]

const clientCodeOptions = [
  { code: 'SS', label: '삼성' },
  { code: 'LG', label: 'LG' },
  { code: 'SK', label: 'SK' },
  { code: 'HD', label: '현대' },
  { code: 'ETC', label: '기타' },
]

function getYearYY() {
  return new Date().getFullYear().toString().slice(-2)
}

function nextSeqForPrefix(prefix: string, items: Project[]) {
  const seqs = items
    .map((p) => p.code)
    .filter((code) => code.startsWith(prefix))
    .map((code) => {
      const parts = code.split('-')
      const seq = parts[4] ?? parts[3]
      const num = Number(seq)
      return Number.isFinite(num) ? num : 0
    })
  const max = seqs.length ? Math.max(...seqs) : 0
  return (max + 1).toString().padStart(3, '0')
}

function ProjectsPage() {
  const { selectedId, setSelectedId } = useProjectContext()
  const { show } = useToast()
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const { data, isLoading, isError } = useProjects()
  const { personnel: pmList, isLoading: pmLoading } = usePersonnel()
  const [isCreating, setIsCreating] = useState(false)

  // 발주처는 마스터(client)에서 가져온다. 자유 입력이면 「삼성물산」
  // 「삼성 물산」 「(주)삼성물산」이 각각 다른 값으로 쌓인다.
  const [clients, setClients] = useState<{ id: number; name: string; client_code: string | null }[]>([])
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', clientCode: '' })

  const loadClients = async () => {
    try {
      const { data } = await apiClient.get('/master/clients')
      setClients(data)
    } catch {
      // 발주처를 못 불러와도 프로젝트 작업 자체는 막지 않는다.
    }
  }

  useEffect(() => { loadClients() }, [])

  // 화면이 세로로 길어 스크롤이 깊어졌다. 성격별로 탭을 나눈다.
  // 문서·양식은 프로젝트를 골라야 뜬다. 대상이 없으면 체크리스트를 만들 수 없다.
  const [tab, setTab] = useState<'project' | 'docs'>('project')

  // Unified Form State (for both create and detail)
  const [form, setForm] = useState({
    code: '',
    name: '',
    client: '',
    clientId: '',
    address: '',
    constructionTypeCode: constructionTypeOptions[0].code,
    clientCode: clientCodeOptions[0].code,
    pm: '',
    startDate: '',
    endDate: '',
    securityLevel: 'A',
    regulation: '삼성',
    status: '준비',
  })

  const loadProjectDetail = (p: Project) => {
    setSelectedId(p.id)
    setIsCreating(false)
    setForm({
      code: p.code || '',
      name: p.name || '',
      client: p.client || '',
      clientId: (p as any).client_id ? String((p as any).client_id) : '',
      address: p.address || '',
      constructionTypeCode: constructionTypeOptions[0].code,
      clientCode: clientCodeOptions[0].code,
      pm: p.pm || '',
      // Ensure date is YYYY-MM-DD string regardless of input type (Date object, full ISO string, etc)
      startDate: typeof p.startDate === 'string' ? p.startDate.substring(0, 10) : ((p.startDate as any) instanceof Date ? (p.startDate as any).toISOString().substring(0, 10) : ''),
      endDate: typeof p.endDate === 'string' ? p.endDate.substring(0, 10) : ((p.endDate as any) instanceof Date ? (p.endDate as any).toISOString().substring(0, 10) : ''),
      securityLevel: p.securityLevel || 'A',
      regulation: p.regulation || '삼성',
      status: p.status || '준비',
    })
  }

  useEffect(() => {
    if (data && data.length > 0) {
      setProjects(data)

      const targetProject = selectedId
        ? data.find(p => p.id === selectedId)
        : data[0]

      if (targetProject && !form.name && !isCreating) {
        loadProjectDetail(targetProject)
      }
    } else if (data) {
      setProjects(data)
    }
  }, [data])

  const generatedCode = useMemo(() => {
    const prefix = `PRJ-${getYearYY()}-${form.constructionTypeCode}-${form.clientCode}`
    const seq = nextSeqForPrefix(prefix, projects)
    return `${prefix}-${seq}`
  }, [form.constructionTypeCode, form.clientCode, projects])

  const handleCreateNew = () => {
    setIsCreating(true)
    setSelectedId('')
    setForm({
      code: '',
      name: '',
      client: '',
    clientId: '',
      address: '',
      constructionTypeCode: constructionTypeOptions[0].code,
      clientCode: clientCodeOptions[0].code,
      pm: '',
      startDate: '',
      endDate: '',
      securityLevel: 'A',
      regulation: '삼성',
      status: '준비',
    })
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name) {
      show('명칭은 필수입니다.', 'warning')
      return
    }
    const rangeError = validateDateRange(form.startDate, form.endDate)
    if (rangeError) {
      show(rangeError, 'warning')
      return
    }

    try {
      const response = await apiClient.post('/projects', {
        code: generatedCode,
        name: form.name,
        clientId: form.clientId ? Number(form.clientId) : null,
        address: form.address || '-',
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        security_level: form.securityLevel,
        pm_name: form.pm || '-',
        regulation_type: form.regulation,
        status: form.status,
      })

      // if (!response.ok) throw new Error('Failed to create project') // Axios throws on non-2xx
      const createdProject = response.data

      // Convert DB format to frontend format
      const newProject: Project = {
        id: createdProject.id,
        code: createdProject.code,
        name: createdProject.name,
        client: createdProject.client_name || '',
        address: createdProject.address,
        startDate: createdProject.start_date || '-',
        endDate: createdProject.end_date || '-',
        securityLevel: createdProject.security_level,
        pm: createdProject.pm_name,
        regulation: createdProject.regulation_type,
        status: createdProject.status,
      }

      setProjects((prev) => [newProject, ...prev])
      setIsCreating(false)
      show('프로젝트를 등록했습니다.', 'success')
    } catch (error) {
      console.error('Error creating project:', error)
      show('프로젝트 등록에 실패했습니다.', 'error')
    }
  }



  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedId) return
    if (!form.code || !form.name) {
      show('코드와 명칭은 필수입니다.', 'warning')
      return
    }
    const rangeError = validateDateRange(form.startDate, form.endDate)
    if (rangeError) {
      show(rangeError, 'warning')
      return
    }


    if (!confirm('변경된 내용을 저장하시겠습니까?')) {
      return
    }

    try {
      const response = await apiClient.put(`/projects/${selectedId}`, {
        code: form.code,
        name: form.name,
        clientId: form.clientId ? Number(form.clientId) : null,
        address: form.address || '-',
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        security_level: form.securityLevel,
        pm_name: form.pm || '-',
        regulation_type: form.regulation,
        status: form.status,
      })

      // if (!response.ok) throw new Error('Failed to update project')
      const updatedProject = response.data

      // Convert DB format to frontend format
      const updated: Project = {
        id: updatedProject.id,
        code: updatedProject.code,
        name: updatedProject.name,
        client: updatedProject.client_name || '',
        address: updatedProject.address,
        startDate: updatedProject.start_date || '-',
        endDate: updatedProject.end_date || '-',
        securityLevel: updatedProject.security_level,
        pm: updatedProject.pm_name,
        regulation: updatedProject.regulation_type,
        status: updatedProject.status,
      }

      setProjects((prev) => prev.map((p) => (p.id === selectedId ? updated : p)))
      loadProjectDetail(updated)
      show('프로젝트가 수정되었습니다.', 'success')
    } catch (error) {
      console.error('Error updating project:', error)
      show('프로젝트 수정에 실패했습니다.', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return

    // TODO: 백엔드 API 연동 (DELETE /api/projects/:id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    show('삭제되었습니다. (DB 삭제를 위해 백엔드 구현 필요)', 'success')
  }

  const handleSelect = (id: string) => {
    const project = projects.find(p => p.id === id)
    if (project) {
      loadProjectDetail(project)
      show(`프로젝트가 선택되었습니다: ${project.name}`, 'info')
    }
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">프로젝트 기본정보</p>
          <h2>코드 · 명칭 · 발주처 · 기간 · 보안등급 · PM · 고객사 규정</h2>
          <p className="muted">고객사 규정(삼성/LG) 필드까지 포함해 프로젝트별 메타데이터를 분리합니다.</p>
        </div>
        <div className="pill pill-outline">프로젝트 등록/수정/멤버 할당</div>
      </header>

      <div className="pj-tabs">
        {([
          ['project', '프로젝트 등록·상세'],
          ['docs', '문서·양식'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`pj-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'project' && (
      <section className="card table-card">
        <div className="table-head">
          <p className="card-label">프로젝트 목록</p>
          <div className="table-actions">
            <button className="pill pill-outline" onClick={handleCreateNew}>프로젝트 등록</button>
          </div>
        </div>
        {isLoading && <p className="muted">불러오는 중...</p>}
        {isError && <p className="muted">불러오기 오류, 새로고침 해주세요.</p>}
        <div className="table projects-table">
          <div className="table-row table-header">
            <span>코드/상태</span>
            <span>명칭</span>
            <span>발주처</span>
            <span>기간</span>
            <span>보안</span>
            <span>PM</span>
            <span>규정</span>
            <span>관리</span>
          </div>
          {projects.map((p) => (
            <div
              key={p.id}
              className={`table-row ${selectedId === p.id ? 'row-active' : ''}`}
              onClick={() => handleSelect(p.id)}
              style={{ cursor: 'pointer' }}
            >
              <span className="code-cell">
                <strong>{p.code}</strong>
                <span className={`badge ${p.status === '진행' ? 'badge-live' : ''}`}>{p.status}</span>
              </span>
              <span>{p.name}</span>
              <span>{p.client}</span>
              <span style={{ textAlign: 'center' }}>
                {String(p.startDate).substring(0, 10)} ~ {String(p.endDate).substring(0, 10)}
              </span>
              <span>{p.securityLevel}</span>
              <span>{p.pm}</span>
              <span>{p.regulation}</span>
              <span className="row-actions">
                <button
                  className="icon-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id);
                  }}
                  aria-label="삭제"
                  title="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
      )}

      {tab === 'project' && (isCreating || selectedId) && (
        <section className="card">
          <div className="table-head">
            <p className="card-label">{isCreating ? '프로젝트 등록' : '프로젝트 상세'}</p>
            <button
              type="submit"
              form="project-form"
              className="icon-button"
              aria-label={isCreating ? '추가' : '저장'}
            >
              {isCreating ? <Plus size={18} /> : <CheckCircle size={18} />}
            </button>
          </div>
          <form
            id="project-form"
            className="form-grid"
            onSubmit={isCreating ? handleCreate : handleUpdate}
          >
            <label>
              <span>코드(자동생성)</span>
              <input value={isCreating ? generatedCode : form.code} readOnly />
            </label>
            <label>
              <span>명칭*</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            {isCreating && (
              <label>
                <span>공사 종류</span>
                <select
                  value={form.constructionTypeCode}
                  onChange={(e) => setForm({ ...form, constructionTypeCode: e.target.value })}
                >
                  {constructionTypeOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>발주처</span>
              {/* 마스터에서 고른다. 목록에 없으면 「+ 신규」로 바로 추가한다.
                  착수 시점에 발주처가 마스터에 없는 것은 정상이고,
                  여기서 막히면 프로젝트를 못 연다. */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">발주처 선택</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.client_code ? ` (${c.client_code})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pill pill-outline"
                  onClick={() => { setNewClient({ name: '', clientCode: '' }); setNewClientOpen(true) }}
                >
                  + 신규
                </button>
              </div>
            </label>
            {isCreating && (
              <label>
                <span>발주처 코드</span>
                <select value={form.clientCode} onChange={(e) => setForm({ ...form, clientCode: e.target.value })}>
                  {clientCodeOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>PM</span>
              <select value={form.pm} onChange={(e) => setForm({ ...form, pm: e.target.value })} disabled={pmLoading}>
                <option value="">{pmLoading ? '로딩 중...' : '선택'}</option>
                {pmList.map((person) => (
                  <option key={person.id} value={person.name}>
                    {person.name} ({person.role})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>착수일</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label>
              <span>종료일</span>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </label>
            <label>
              <span>보안등급</span>
              <select value={form.securityLevel} onChange={(e) => setForm({ ...form, securityLevel: e.target.value })}>
                <option value="S">S등급 (최고급)</option>
                <option value="A">A등급 (고급)</option>
                <option value="B">B등급 (중급)</option>
                <option value="C">C등급 (일반)</option>
              </select>
            </label>
            <label>
              <span>규정</span>
              <select value={form.regulation} onChange={(e) => setForm({ ...form, regulation: e.target.value })}>
                <option value="삼성">삼성</option>
                <option value="LG">LG</option>
                <option value="현대자동차">현대자동차</option>
                <option value="포스코">포스코</option>
                <option value="한화">한화</option>
                <option value="SK">SK</option>
                <option value="한국전력공사">한국전력공사</option>
                <option value="인천국제공항공사">인천국제공항공사</option>
                <option value="기타">기타</option>
              </select>
            </label>
            <label>
              <span>상태</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="준비">준비</option>
                <option value="진행">진행</option>
                <option value="완료">완료</option>
              </select>
            </label>
          </form>
        </section>
      )}

      {/* 신규 발주처 — 이름·코드만 받는다. 약칭·규제유형·필수서류 프로파일은
          시스템관리 > 발주처 마스터에서 채운다. 프로젝트 등록을 무겁게 하지 않는다. */}
      {newClientOpen && (
        <div className="pj-modal" onClick={() => setNewClientOpen(false)}>
          <div className="pj-modal-box" onClick={(e) => e.stopPropagation()}>
            <p className="card-label">신규 발주처 등록</p>
            <div className="form-grid" style={{ marginTop: '0.75rem' }}>
              <label>
                <span>발주처명*</span>
                <input
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="예: 삼성물산"
                />
              </label>
              <label>
                <span>코드</span>
                <input
                  value={newClient.clientCode}
                  onChange={(e) => setNewClient({ ...newClient, clientCode: e.target.value })}
                  placeholder="예: SS"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="pill pill-outline" type="button" onClick={() => setNewClientOpen(false)}>취소</button>
              <button
                className="pill"
                type="button"
                onClick={async () => {
                  if (!newClient.name.trim()) { show('발주처명을 입력하세요.', 'warning'); return }
                  // 같은 이름이 이미 있으면 새로 만들지 않고 그것을 고른다.
                  const dup = clients.find((c) => c.name.trim() === newClient.name.trim())
                  if (dup) {
                    setForm({ ...form, clientId: String(dup.id) })
                    setNewClientOpen(false)
                    show('이미 등록된 발주처입니다. 그 발주처를 선택했습니다.', 'info')
                    return
                  }
                  try {
                    const { data } = await apiClient.post('/master/clients', {
                      name: newClient.name.trim(),
                      clientCode: newClient.clientCode.trim() || null,
                    })
                    await loadClients()
                    setForm({ ...form, clientId: String(data.id) })
                    setNewClientOpen(false)
                    show('발주처를 등록했습니다.', 'success')
                  } catch (err: any) {
                    show(err?.response?.data?.error || '발주처 등록에 실패했습니다.', 'error')
                  }
                }}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'docs' && (
        <section className="card">
          <div className="table-head">
            <p className="card-label">문서·양식</p>
          </div>
          {selectedId
            ? <DocChecklist projectId={selectedId} />
            : (
              // 프로젝트를 고르지 않으면 어느 현장의 체크리스트인지 정할 수 없다.
              <p className="muted">
                「프로젝트 등록·상세」에서 프로젝트를 먼저 선택하십시오.
              </p>
            )}
        </section>
      )}
    </div>
  )
}

export default ProjectsPage
