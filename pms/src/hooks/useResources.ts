
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Resource } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'

interface UserResource {
  uid: string
  name: string
  email: string
  role: string
  status: string
}

interface PersonnelResource {
  id: string
  name: string
  role: string
  qualifications: string[]
  security_clearance: string
  status: string
}

interface EquipmentResource {
  id: string
  name: string
  category: string
  equipment_status: string
  assigned_site: string
}

interface Assignment {
  id: string
  project_id: string
  resource_type: string // 'PERSON' or 'EQUIPMENT'
  resource_id: string
  start_date: string
  end_date: string
}

// Fetch Users (Staff with Auth)
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserResource[]>('/users')
      return data.filter(u => u.status === 'approved')
    },
  })
}

// Fetch Personnel (Field Workers without Auth)
export const usePersonnel = () => {
  return useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data } = await apiClient.get<PersonnelResource[]>('/personnel')
      return data
    },
  })
}

// Fetch Equipment
export const useEquipment = () => {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentResource[]>('/equipment')
      return data
    },
  })
}

// Fetch Resource Assignments
export const useResourceAssignments = () => {
  const { selectedId } = useProjectContext()

  return useQuery({
    queryKey: ['resource-assignments', selectedId],
    queryFn: async () => {
      const params = selectedId ? { projectId: selectedId } : {}
      const { data } = await apiClient.get<Assignment[]>('/resource-assignments', { params })
      return data
    },
  })
}

// Combine into unified resources with assignments
export const useResources = () => {
  const { selectedId } = useProjectContext()
  const usersQuery = useUsers()
  const personnelQuery = usePersonnel()
  const equipmentQuery = useEquipment()
  const assignmentsQuery = useResourceAssignments()

  const isLoading = usersQuery.isLoading || personnelQuery.isLoading || equipmentQuery.isLoading || assignmentsQuery.isLoading
  const isError = usersQuery.isError || personnelQuery.isError || equipmentQuery.isError || assignmentsQuery.isError

  // Transform data into unified Resource format
  const data: Resource[] = []
  const users = usersQuery.data || []
  const personnel = personnelQuery.data || []
  const equipment = equipmentQuery.data || []
  const assignments = assignmentsQuery.data || []

  // Add users (staff with auth) as resources
  users.forEach(u => {
    const userAssignments = assignments
      .filter(a => a.resource_type === 'PERSON' && a.resource_id === u.uid)
      .map(a => ({
        taskId: '',
        start: a.start_date,
        end: a.end_date,
        assignmentId: a.id
      }))

    data.push({
      id: u.uid,
      type: '인력',
      name: u.name || u.email,
      projectId: selectedId || '',
      assignments: userAssignments,
      conflicts: []
    })
  })

  // Add personnel (field workers without auth) as resources
  personnel.forEach(p => {
    const pAssignments = assignments
      .filter(a => a.resource_type === 'PERSON' && a.resource_id === p.id)
      .map(a => ({
        taskId: '',
        start: a.start_date,
        end: a.end_date,
        assignmentId: a.id
      }))

    data.push({
      id: p.id,
      type: '인력',
      name: p.name + (p.role ? ` (${p.role})` : ''),
      projectId: selectedId || '',
      assignments: pAssignments,
      conflicts: []
    })
  })

  // Add equipment as resources
  equipment.forEach(eq => {
    const eqAssignments = assignments
      .filter(a => a.resource_type === 'EQUIPMENT' && a.resource_id === eq.id)
      .map(a => ({
        taskId: '',
        start: a.start_date,
        end: a.end_date,
        assignmentId: a.id
      }))

    data.push({
      id: eq.id,
      type: '장비',
      name: eq.name,
      projectId: selectedId || '',
      assignments: eqAssignments,
      conflicts: []
    })
  })

  return { data, isLoading, isError, users, equipment, personnel }
}

// Mutations for assignments
export const useResourceAssignmentMutations = () => {
  const queryClient = useQueryClient()
  const { selectedId } = useProjectContext()

  const createAssignment = useMutation({
    mutationFn: async (newAssignment: {
      resourceType: string
      resourceId: string
      startDate: string
      endDate: string
    }) => {
      const payload = {
        projectId: selectedId,
        resourceType: newAssignment.resourceType,
        resourceId: newAssignment.resourceId,
        startDate: newAssignment.startDate,
        endDate: newAssignment.endDate
      }
      const { data } = await apiClient.post('/resource-assignments', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-assignments', selectedId] })
    }
  })

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/resource-assignments/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-assignments', selectedId] })
    }
  })

  return { createAssignment, deleteAssignment }
}
