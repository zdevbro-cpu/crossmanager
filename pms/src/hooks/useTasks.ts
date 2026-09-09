
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Task } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'

export const useTasks = () => {
  const { selectedId } = useProjectContext()

  return useQuery({
    queryKey: ['tasks', selectedId],
    queryFn: async () => {
      // If no project selected, maybe return empty or all? API handles filter.
      // Let's pass projectId if exists.
      const params = selectedId ? { projectId: selectedId } : {}
      const { data } = await apiClient.get<Task[]>('/tasks', { params })
      return data
    },
    enabled: true // Always enabled, or maybe check if selectedId exists? 
    // If we want to support "all tasks" view, true is fine.
  })
}

export const useTaskMutations = () => {
  const queryClient = useQueryClient()
  const { selectedId } = useProjectContext()

  const createMutation = useMutation({
    mutationFn: async (newTask: Partial<Task>) => {
      const { data } = await apiClient.post<Task>('/tasks', newTask)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedId] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (task: Task) => {
      const { data } = await apiClient.put<Task>(`/tasks/${task.id}`, task)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedId] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedId] })
    }
  })

  const clearTasksMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('No project selected')
      await apiClient.delete('/tasks', { params: { projectId: selectedId } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedId] })
    }
  })

  return { createMutation, updateMutation, deleteMutation, clearTasksMutation }
}
