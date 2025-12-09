
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type RoleCode = 'executive' | 'manager' | 'field' | 'sysadmin'

export type ProjectMember = {
  id: string // projectId
  roleCode: RoleCode
}

const fetchMembers = async (uid: string): Promise<ProjectMember[]> => {
  // TODO: 백엔드 API 구현 필요
  // Mock 데이터 반환
  console.log(`[Mock] Fetching members for user ${uid}`)
  return Promise.resolve([])
}

const setMemberRole = async (params: { uid: string; projectId: string; roleCode: RoleCode }) => {
  console.log(`[Mock] Setting member role:`, params)
  return Promise.resolve()
}

const removeMember = async (params: { uid: string; projectId: string }) => {
  console.log(`[Mock] Removing member:`, params)
  return Promise.resolve()
}

export const useProjectMembers = (uid: string) =>
  useQuery({
    queryKey: ['projectMembers', uid],
    queryFn: () => fetchMembers(uid),
    enabled: !!uid,
  })

export const useSetMemberRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setMemberRole,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projectMembers', variables.uid] })
    },
  })
}

export const useRemoveMember = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeMember,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['projectMembers', variables.uid] })
    },
  })
}
