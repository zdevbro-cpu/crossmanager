
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { PmsDocument } from '../types/pms'

// Map Helper
const mapDocumentFromDB = (data: any): PmsDocument => ({
  id: data.id,
  projectId: data.project_id,
  category: data.category,
  subCategory: data.sub_category,
  type: data.type,
  name: data.name,
  status: data.status,
  currentVersion: data.current_version,
  createdAt: data.created_at,

  // Checkout lock
  lockedBy: data.locked_by,
  lockedAt: data.locked_at,
  lockedByName: data.locked_by_name,

  // Versions Join
  filePath: data.file_path,
  fileSize: data.file_size ? Number(data.file_size) : 0,
  security_level: data.security_level,
  projectName: data.project_name,
  clientSubmit: data.metadata?.client_submit || false,
  metadata: data.metadata || {}
})

const checkoutDocument = async ({ id, userId, userName }: { id: string, userId: string, userName: string }): Promise<void> => {
  await apiClient.post(`/documents/${id}/checkout`, { userId, userName })
}

const checkinDocument = async (formData: FormData): Promise<void> => {
  const id = formData.get('id') as string
  await apiClient.post(`/documents/${id}/checkin`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

const unlockDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/documents/${id}/lock`)
}

const getVersionHistory = async (id: string) => {
  const res = await apiClient.get(`/documents/${id}/versions`)
  return res.data
}

const fetchDocuments = async (projectId?: string): Promise<PmsDocument[]> => {
  const params = projectId ? { projectId } : {}
  const res = await apiClient.get('/documents', { params })
  // If paginated, take from .documents array
  const docs = Array.isArray(res.data) ? res.data : (res.data.documents || [])
  return docs.map(mapDocumentFromDB)
}

const deleteDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/documents/${id}`)
}

const moveDocument = async ({ id, category, subCategory }: { id: string, category: string, subCategory: string }): Promise<void> => {
  await apiClient.patch(`/documents/${id}`, { category, subCategory })
}

const copyDocument = async ({ id, category, subCategory }: { id: string, category?: string, subCategory?: string }): Promise<void> => {
  await apiClient.post(`/documents/${id}/copy`, { category, subCategory })
}

const updateDocument = async ({ id, ...data }: { id: string } & Partial<PmsDocument>): Promise<PmsDocument> => {
  const res = await apiClient.patch(`/documents/${id}`, data)
  return res.data
}

export const useDocuments = (projectId?: string) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => fetchDocuments(projectId),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const moveMutation = useMutation({
    mutationFn: moveDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const copyMutation = useMutation({
    mutationFn: copyDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const checkoutMutation = useMutation({
    mutationFn: checkoutDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const checkinMutation = useMutation({
    mutationFn: checkinDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  const unlockMutation = useMutation({
    mutationFn: unlockDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  return {
    ...query,
    deleteDocument: deleteMutation.mutateAsync,
    moveDocument: moveMutation.mutateAsync,
    copyDocument: copyMutation.mutateAsync,
    updateDocument: updateMutation.mutateAsync,
    checkoutDocument: checkoutMutation.mutateAsync,
    checkinDocument: checkinMutation.mutateAsync,
    unlockDocument: unlockMutation.mutateAsync,
    getVersionHistory,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['documents'] })
  }
}

