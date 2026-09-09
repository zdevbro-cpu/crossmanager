import { useMemo } from 'react'
import { useProjectMembers, type RoleCode } from './useProjectMembers'
import { useAuth } from './useAuth'
import { useProjectContext } from '../context/ProjectContext'

export function useRole() {
  const { user } = useAuth()
  const { selectedId } = useProjectContext()
  const { data } = useProjectMembers(user?.uid ?? '')

  const role: RoleCode = useMemo(() => {
    const projectRole = data?.find((m) => m.id === selectedId)?.roleCode
    if (projectRole) return projectRole
    // fallback: 관리 권한으로 기본 허용, 콘솔에서 roleCode 지정 시 정확히 반영됨
    return 'manager'
  }, [data, selectedId])

  return { role }
}
