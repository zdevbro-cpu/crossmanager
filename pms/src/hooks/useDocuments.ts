
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { PmsDocument } from '../types/pms'

// Map Helper
const mapDocumentFromDB = (data: any): PmsDocument => ({
  id: data.id,
  projectId: data.project_id,
  category: data.category,
  type: data.type,
  name: data.name,
  status: data.status,
  currentVersion: data.current_version,
  createdAt: data.created_at,

  // Versions Join
  filePath: data.file_path, // relative path "uploads/..."
  fileSize: data.file_size ? Number(data.file_size) : 0
})

const fetchDocuments = async (projectId?: string): Promise<PmsDocument[]> => {
  const params = projectId ? { projectId } : {}
  const res = await apiClient.get('/documents', { params })
  return res.data.map(mapDocumentFromDB)
}

const deleteDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/documents/${id}`)
}

export const useDocuments = (projectId?: string) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => fetchDocuments(projectId),
  })

  // Mutations for Create are handled in the Modal usually because of FormData complexity,
  // but we can expose a invalidate helper or generic mutation.
  // Actually, let's keep it simple and just provide delete here.
  // Upload is usually a separate flow.

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  return {
    ...query,
    deleteDocument: deleteMutation.mutateAsync,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['documents'] })
  }
}

