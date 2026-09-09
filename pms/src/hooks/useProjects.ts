
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Project } from '../types/pms'

const fetchProjects = async (): Promise<Project[]> => {
  try {
    const response = await apiClient.get<any[]>('/projects')
    return response.data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      client: item.client,
      address: item.address,
      startDate: item.start_date,
      endDate: item.end_date,
      securityLevel: item.security_level || 'A',
      pm: item.pm_name,
      regulation: item.regulation_type,
      status: item.status,
    }))
  } catch (err) {
    console.error('프로젝트 조회 실패:', err)
    throw err
  }
}

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })
