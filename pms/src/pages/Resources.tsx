
import './Page.css'
import { useMemo, useState } from 'react'
import { useResources, useResourceAssignmentMutations } from '../hooks/useResources'
import { useToast } from '../components/ToastProvider'
import type { Resource } from '../types/pms'
import { Trash2, Plus, Users, Truck } from 'lucide-react'

type AssignmentInput = {
  resourceType: 'PERSON' | 'EQUIPMENT'
  resourceId: string
  start: string
  end: string
}

// Format date to YYYY-MM-DD only (handle timezone offset)
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // If already in YYYY-MM-DD format, return as is
  if (dateStr.length === 10) return dateStr
  // Parse date and format in local timezone to avoid shift
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}



// Format date to MM.DD string
function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}.${day}`
}

function computeConflicts(assignments: Resource['assignments']): string[] {
  const conflicts: string[] = []
  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      const a = assignments[i]
      const b = assignments[j]

      const aStart = new Date(a.start).getTime()
      const aEnd = new Date(a.end).getTime()
      const bStart = new Date(b.start).getTime()
      const bEnd = new Date(b.end).getTime()

      if (aStart <= bEnd && bStart <= aEnd) {
        // 교집합(겹치는 구간) 계산
        const overlapStart = Math.max(aStart, bStart)
        const overlapEnd = Math.min(aEnd, bEnd)

        // 일수 계산
        const diffTime = Math.abs(overlapEnd - overlapStart)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

        const startStr = new Date(overlapStart).toISOString()
        const endStr = new Date(overlapEnd).toISOString()

        conflicts.push(`${formatShortDate(startStr)} ~ ${formatShortDate(endStr)} (${diffDays}일간)`)
      }
    }
  }
  return conflicts
}

function ResourcesPage() {
  const { show } = useToast()
  const { data: resources = [], isLoading, isError, users, equipment, personnel } = useResources()
  const { createAssignment, deleteAssignment } = useResourceAssignmentMutations()

  const [assignForm, setAssignForm] = useState<AssignmentInput>({
    resourceType: 'PERSON',
    resourceId: '',
    start: '',
    end: '',
  })

  // Compute conflicts and filter only resources with assignments
  const resourcesWithAssignments = useMemo(() => {
    return resources
      .filter((r: Resource) => r.assignments.length > 0)
      .map((r: Resource) => ({
        ...r,
        conflicts: computeConflicts(r.assignments),
      }))
  }, [resources])

  // Separate by type for display (only those with assignments)
  const personnelWithAssignments = resourcesWithAssignments.filter((r) => r.type === '인력')
  const equipmentWithAssignments = resourcesWithAssignments.filter((r) => r.type === '장비')

  // Combine users and personnel for dropdown
  const allPersonnel = [
    ...(users || []).map((u: { uid: string; name: string; email: string }) => ({
      id: u.uid,
      name: u.name || u.email,
      source: 'user'
    })),
    ...(personnel || []).map((p: { id: string; name: string; role?: string }) => ({
      id: p.id,
      name: p.name + (p.role ? ` (${p.role})` : ''),
      source: 'personnel'
    }))
  ]

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!assignForm.resourceId || !assignForm.start || !assignForm.end) {
      show('자원과 기간을 모두 선택하세요.', 'warning')
      return
    }

    try {
      await createAssignment.mutateAsync({
        resourceType: assignForm.resourceType,
        resourceId: assignForm.resourceId,
        startDate: assignForm.start,
        endDate: assignForm.end,
      })
      show('배정이 추가되었습니다.', 'success')
      setAssignForm((prev) => ({ ...prev, resourceId: '', start: '', end: '' }))
    } catch (err) {
      console.error(err)
      show('배정 추가 실패', 'error')
    }
  }

  const handleDeleteAssignment = async (assignmentId: string | undefined) => {
    if (!assignmentId) return
    if (!confirm('이 배정을 삭제하시겠습니까?')) return

    try {
      await deleteAssignment.mutateAsync(assignmentId)
      show('배정이 삭제되었습니다.', 'success')
    } catch (err) {
      show('삭제 실패', 'error')
    }
  }

  // Button styles matching nav-link.active
  const selectedButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(71, 85, 105, 0.5)',
    background: '#475569',
    color: '#f2f5ff',
    cursor: 'pointer',
    fontWeight: 500,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  }

  const unselectedButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    background: 'rgba(255, 255, 255, 0.02)',
    color: '#c6d5f0',
    cursor: 'pointer',
    fontWeight: 400
  }

  // Dark scrollbar style for select
  const selectStyle: React.CSSProperties = {
    colorScheme: 'dark'
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">자원(장비/인력)</p>
          <h2>자원 배정 및 중복 관리</h2>
          <p className="muted">인력과 장비를 작업에 배정하고, 일정 중복을 확인하세요.</p>
        </div>
        <div className="pill pill-outline">배정 현황</div>
      </header>

      {/* Assignment Form */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p className="card-label" style={{ margin: 0 }}>배정 추가</p>
          {/* + 버튼 우측 상단 배치 */}
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.closest('section')?.querySelector('form')
              if (form) form.requestSubmit()
            }}
            disabled={createAssignment.isPending}
            title="배정 추가"
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <Plus size={20} />
          </button>
        </div>
        <form className="form-grid" onSubmit={handleAssign} style={{ alignItems: 'end', gridTemplateColumns: 'auto 1fr 1fr 1fr' }}>
          <label>
            <span>자원 유형</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, resourceType: 'PERSON', resourceId: '' })}
                style={assignForm.resourceType === 'PERSON' ? selectedButtonStyle : unselectedButtonStyle}
              >
                <Users size={14} /> 인력
              </button>
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, resourceType: 'EQUIPMENT', resourceId: '' })}
                style={assignForm.resourceType === 'EQUIPMENT' ? selectedButtonStyle : unselectedButtonStyle}
              >
                <Truck size={14} /> 장비
              </button>
            </div>
          </label>
          <label>
            <span>{assignForm.resourceType === 'PERSON' ? '인력 선택' : '장비 선택'}</span>
            <select
              value={assignForm.resourceId}
              onChange={(e) => setAssignForm({ ...assignForm, resourceId: e.target.value })}
              style={selectStyle}
            >
              <option value="">선택</option>
              {assignForm.resourceType === 'PERSON'
                ? allPersonnel.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
                : (equipment || []).map((eq: { id: string; name: string; category?: string }) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.category || '기타'})
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>시작일</span>
            <input
              type="date"
              value={assignForm.start}
              onChange={(e) => setAssignForm({ ...assignForm, start: e.target.value })}
              style={{ colorScheme: 'dark' }}
            />
          </label>
          <label>
            <span>종료일</span>
            <input
              type="date"
              value={assignForm.end}
              onChange={(e) => setAssignForm({ ...assignForm, end: e.target.value })}
              style={{ colorScheme: 'dark' }}
            />
          </label>
        </form>
      </section>

      {/* Personnel Assignments */}
      <section className="card table-card" style={{ marginTop: '1.5rem' }}>
        <div className="table-head">
          <p className="card-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> 인력 배정 현황
          </p>
        </div>
        {isLoading && <p className="muted" style={{ padding: '1rem' }}>불러오는 중...</p>}
        {isError && <p className="muted" style={{ padding: '1rem' }}>불러오기 오류</p>}
        <div className="table">
          <div className="table-row table-header" style={{ gridTemplateColumns: '1fr 1.5fr 2.5fr' }}>
            <span>이름</span>
            <span>배정 기간</span>
            <span>중복</span>
          </div>
          {personnelWithAssignments.length === 0 && !isLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              배정된 인력이 없습니다. 위 폼에서 인력을 배정하세요.
            </div>
          )}
          {personnelWithAssignments.map((r) => (
            <div key={r.id} className="table-row" style={{ gridTemplateColumns: '1fr 1.5fr 2.5fr' }}>
              <span style={{ fontWeight: 500 }}>{r.name}</span>
              <span>
                {r.assignments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{formatDate(a.start)} ~ {formatDate(a.end)}</span>
                    {a.assignmentId && (
                      <button
                        className="icon-button"
                        onClick={() => handleDeleteAssignment(a.assignmentId)}
                        title="삭제"
                        style={{ padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </span>
              <span style={{ textAlign: 'left' }}>
                {r.conflicts && r.conflicts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <span className="badge badge-alert" style={{ alignSelf: 'flex-start' }}>중복 ({r.conflicts.length}건)</span>
                    {r.conflicts.map((c, idx) => (
                      <span key={idx} style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                        • {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="badge badge-live">정상</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Equipment Assignments */}
      <section className="card table-card" style={{ marginTop: '1.5rem' }}>
        <div className="table-head">
          <p className="card-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} /> 장비 배정 현황
          </p>
        </div>
        <div className="table">
          <div className="table-row table-header" style={{ gridTemplateColumns: '1fr 1.5fr 2.5fr' }}>
            <span>장비명</span>
            <span>배정 기간</span>
            <span>중복</span>
          </div>
          {equipmentWithAssignments.length === 0 && !isLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              배정된 장비가 없습니다. 위 폼에서 장비를 배정하세요.
            </div>
          )}
          {equipmentWithAssignments.map((r) => (
            <div key={r.id} className="table-row" style={{ gridTemplateColumns: '1fr 1.5fr 2.5fr' }}>
              <span style={{ fontWeight: 500 }}>{r.name}</span>
              <span>
                {r.assignments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{formatDate(a.start)} ~ {formatDate(a.end)}</span>
                    {a.assignmentId && (
                      <button
                        className="icon-button"
                        onClick={() => handleDeleteAssignment(a.assignmentId)}
                        title="삭제"
                        style={{ padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </span>
              <span style={{ textAlign: 'left' }}>
                {r.conflicts && r.conflicts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <span className="badge badge-alert" style={{ alignSelf: 'flex-start' }}>중복 ({r.conflicts.length}건)</span>
                    {r.conflicts.map((c, idx) => (
                      <span key={idx} style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                        • {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="badge badge-live">정상</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default ResourcesPage
