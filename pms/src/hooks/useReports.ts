import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Report } from '../types/pms'

const fetchReports = async (projectId?: string): Promise<Report[]> => {
  const url = projectId ? `/reports?projectId=${projectId}` : '/reports'
  const { data } = await apiClient.get(url)

  return data.map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    templateId: r.template_id,
    title: r.title,
    reportDate: r.report_date,
    status: r.status,
    content: r.content,
    createdBy: r.created_by,
    createdAt: r.created_at,
    type: r.template_type || 'Custom',
    templateTitle: r.template_title
  }))
}

export const useReports = (projectId?: string) =>
  useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => fetchReports(projectId),
  })

export const useCreateReport = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newReport: Partial<Report> & { date?: string }) => {
      const { data } = await apiClient.post('/reports', newReport)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
  })
}

export const useUpdateReport = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      // Note: Standardizing URL to match others (removing explicit /api prefix if others don't use it, 
      // but strictly following creating consistency. The create uses '/reports', fetch uses '/reports'.
      // Only update uses '/api/reports'. Assuming proxy handles '/api' or baseURL implies it.
      // Let's use '/reports' to be consistent with creating/fetching which work.)
      const { data: response } = await apiClient.put(`/reports/${id}`, data)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
  })
}

export const useUpdateReportStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, comment }: { id: string, status: string, comment?: string }) => {
      const { data } = await apiClient.patch(`/reports/${id}/status`, { status, comment })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
  })
}

export const useDeleteReport = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reports/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
  })
}
