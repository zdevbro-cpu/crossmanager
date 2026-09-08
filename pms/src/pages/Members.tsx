import './Page.css'
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProjectContext } from '../context/ProjectContext'
import { mockProjects } from '../data/mock'
import { useProjectMembers, useRemoveMember, useSetMemberRole, type RoleCode } from '../hooks/useProjectMembers'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'
import { Trash2, Plus, Eye, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
import ChecklistTemplateManager from '../components/ChecklistTemplateManager'
import PmsResourceAdmin from '../components/PmsResourceAdmin'

const roles: { code: RoleCode; label: string }[] = [
  { code: 'executive', label: '경영자' },
  { code: 'manager', label: '관리자' },
  { code: 'field', label: '현장근무' },
  { code: 'sysadmin', label: '시스템관리자' },
]

function MembersPage() {
  const { user } = useAuth()
  const { selectedId } = useProjectContext()
  const { data, isLoading, isError } = useProjectMembers(user?.uid ?? '')
  const setRole = useSetMemberRole()
  const remove = useRemoveMember()
  const { show } = useToast()
  const [targetUid, setTargetUid] = useState('')
  const [roleCode, setRoleCode] = useState<RoleCode>('field')
  const [assignProjectId, setAssignProjectId] = useState(selectedId || '')

  useEffect(() => {
    if (selectedId) setAssignProjectId(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (setRole.isSuccess) show('역할이 변경되었습니다.', 'success')
    if (remove.isSuccess) show('멤버가 삭제되었습니다.', 'success')
  }, [setRole.isSuccess, remove.isSuccess, show])

  const members = data ?? []

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'resources' | 'templates' | 'my-role'>('users')

  // Users State
  const [allUsers, setAllUsers] = useState<any[]>([])

  const fetchUsers = async () => {
    try {
      const { data } = await apiClient.get('/users')
      setAllUsers(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Handlers
  const handleApprove = async (uid: string) => {
    try {
      await apiClient.post('/users/approve', { uid }) // Role prevents default or current? Logic handles it.
      show('사용자가 승인되었습니다. (고유코드 생성 완료)', 'success')
      fetchUsers()
    } catch (e) {
      console.error(e)
      show('승인 중 오류 발생', 'error')
    }
  }

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      await apiClient.post('/users/approve', { uid, role: newRole })
      show('권한이 변경되었습니다.', 'success')
      fetchUsers()
    } catch (e) { console.error(e) }
  }

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('정말 이 사용자를 삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/users/${uid}`)
      show('사용자가 삭제되었습니다.', 'success')
      fetchUsers()
    } catch (e) { console.error(e) }
  }

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!targetUid || !assignProjectId) {
      show('사용자와 프로젝트를 선택하세요.', 'warning')
      return
    }
    try {
      await setRole.mutateAsync({ uid: targetUid, projectId: assignProjectId, roleCode })
    } catch (err) {
      console.error(err)
      show('역할 설정 실패: 권한/네트워크 확인.', 'error')
    }
  }


  const formatPhoneNumber = (value: string) => {
    if (!value) return '-'
    const v = value.replace(/[^0-9]/g, '')
    if (v.length > 7) {
      return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`
    }
    return v
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">시스템관리</p>
          <h2>통합 관리 시스템</h2>
          <p className="muted">직원 권한 및 자격/투입가능(Eligibility)을 관리합니다.</p>
        </div>
        <div className="pill pill-outline">System Admin</div>
      </header>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'users' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'users' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          직원 권한 관리
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'resources' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'resources' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'resources' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          자원관리(자격/투입가능)
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'templates' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'templates' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          체크리스트 템플릿
        </button>
        <button
          onClick={() => setActiveTab('my-role')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my-role' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'my-role' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'my-role' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          내 프로젝트 역할
        </button>
      </div>

      {/* Tab Content: Users */}
      {activeTab === 'users' && (
        <>
          {/* Role Assignment */}
          <section className="card">
            <p className="card-label">프로젝트 멤버 역할 지정</p>
            <form className="form-grid" onSubmit={handleAssign}>
              <label>
                <span>대상 직원</span>
                <select className="input-std" value={targetUid} onChange={(e) => setTargetUid(e.target.value)}>
                  <option value="">직원을 선택하세요</option>
                  {allUsers.filter(u => u.status === 'approved').map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>프로젝트</span>
                <select
                  className="input-std"
                  value={assignProjectId}
                  onChange={(e) => setAssignProjectId(e.target.value)}
                >
                  <option value="">프로젝트를 선택하세요</option>
                  {mockProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>역할</span>
                <select className="input-std" value={roleCode} onChange={(e) => setRoleCode(e.target.value as RoleCode)}>
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button type="submit" className="icon-button" disabled={setRole.isPending} aria-label="역할 설정">
                  {setRole.isPending ? '…' : <Plus size={18} />}
                </button>
              </div>
            </form>
            <p className="muted">등록된 직원 목록에서 선택하여 프로젝트 역할을 부여합니다.</p>
          </section>

          {/* All Users List (Unified) */}
          <section className="card table-card" style={{ marginTop: '1.5rem' }}>
            <div className="table-head">
              <p className="card-label">직원관리</p>
            </div>
            <div className="table">
              {/* Header */}
              <div className="table-row table-header" style={{ gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr 1fr 0.8fr 0.6fr 1fr' }}>
                <span>이름</span>
                <span>이메일</span>
                <span>전화번호</span>
                <span>지점</span>
                <span>직원구분</span>
                <span>고유코드</span>
                <span>상태</span>
                <span>관리</span>
              </div>

              {/* Rows */}
              {allUsers.map(u => (
                <div key={u.uid} className="table-row" style={{ gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr 1fr 0.8fr 0.6fr 1fr', alignItems: 'center' }}>
                  <span>{u.name}</span>
                  <span>{u.email}</span>
                  <span>{formatPhoneNumber(u.contact)}</span>
                  <span>{u.branch || '본사'}</span>

                  {/* Role Dropdown */}
                  <span>
                    <select
                      className="input-std"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                    >
                      {roles.map(r => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                  </span>

                  <span style={{ color: '#8bd3ff' }}>{u.code || '-'}</span>

                  {/* Status Badge */}
                  <span>
                    {u.status === 'pending' ? (
                      <span className="badge badge-alert">대기중</span>
                    ) : (
                      <span className="badge badge-live">승인됨</span>
                    )}
                  </span>

                  {/* Actions */}
                  <span className="row-actions" style={{ gap: '0.5rem' }}>
                    {u.status === 'pending' ? (
                      <>
                        <button className="icon-button" title="승인" onClick={() => handleApprove(u.uid)} style={{ color: '#5eead4', borderColor: '#5eead4' }}>
                          <CheckCircle size={18} />
                        </button>
                        <button className="icon-button" title="거절/삭제" onClick={() => handleDeleteUser(u.uid)} style={{ color: '#fca5a5', borderColor: '#fca5a5' }}>
                          <XCircle size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="icon-button" title="상세보기" onClick={() => show('상세보기 기능 준비중', 'info')}>
                          <Eye size={16} />
                        </button>
                        <button className="icon-button" title="비밀번호 초기화" onClick={() => show('비밀번호 초기화 메일 전송 (준비중)', 'info')}>
                          <RotateCcw size={16} />
                        </button>
                        <button className="icon-button" onClick={() => handleDeleteUser(u.uid)} title="삭제">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Tab Content: Resources */}
      {activeTab === 'resources' && (
        <PmsResourceAdmin projectId={assignProjectId} />
      )}

      {/* Tab Content: Checklist Templates */}
      {activeTab === 'templates' && (
        <section>
          <ChecklistTemplateManager />
        </section>
      )}

      {/* Tab Content: My Role */}
      {activeTab === 'my-role' && (
        <section className="card table-card">
          <div className="table-head">
            <p className="card-label">내 역할(참여 프로젝트)</p>
          </div>
          {isLoading && <p className="muted">불러오는 중...</p>}
          {isError && <p className="muted">불러오기 오류: 권한/네트워크 확인.</p>}
          <div className="table">
            <div className="table-row table-header">
              <span>프로젝트</span>
              <span>역할</span>
              <span>관리</span>
            </div>
            {members.map((m) => (
              <div key={m.id} className="table-row">
                <span>{mockProjects.find((p) => p.id === m.id)?.name ?? m.id}</span>
                <span>{roles.find((r) => r.code === m.roleCode)?.label ?? m.roleCode}</span>
                <span className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => remove.mutate({ uid: user?.uid ?? '', projectId: m.id })}
                    disabled={remove.isPending}
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
    </div>
  )
}

export default MembersPage
