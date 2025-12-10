import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Contract } from '../types/pms'

// Fetch Contracts
const fetchContracts = async (projectId?: string): Promise<Contract[]> => {
  const params = projectId ? { projectId } : {}
  const res = await apiClient.get('/contracts', { params })

  // Transform DB fields to match frontend if needed (snake_case to camelCase)
  // Our new definition uses camelCase for internal objects but DB returns snake_case mostly?
  // Wait, our Route `contracts.js` returns row data which is snake_case because of Postgres default.
  // We need to either map it or update our types. 
  // For simplicity now, I'll update the type definition to allow flexible mapping OR map here.
  // Mapping is better to keep frontend clean.

  return res.data.map(mapContractFromDB)
}

// Map Helper
const mapContractFromDB = (data: any): Contract => ({
  id: data.id,
  projectId: data.project_id,
  code: data.code,
  type: data.type,
  category: data.category,
  name: data.name,

  totalAmount: Number(data.total_amount),
  costDirect: Number(data.cost_direct),
  costIndirect: Number(data.cost_indirect),
  riskFee: Number(data.risk_fee),
  margin: Number(data.margin),

  regulationConfig: data.regulation_config,

  clientManager: data.client_manager,
  ourManager: data.our_manager,

  contractDate: data.contract_date,
  startDate: data.start_date,
  endDate: data.end_date,

  termsPayment: data.terms_payment,
  termsPenalty: data.terms_penalty,

  attachment: data.attachment, // Add attachment mapping

  status: data.status,
  items: data.items ? data.items.map(mapItemFromDB) : [],

  createdAt: data.created_at,
  updatedAt: data.updated_at
})

const mapItemFromDB = (data: any) => ({
  id: data.id,
  contractId: data.contract_id,
  group: data.group_name,
  name: data.name,
  spec: data.spec,
  quantity: Number(data.quantity),
  unit: data.unit,
  unitPrice: Number(data.unit_price),
  amount: Number(data.amount),
  note: data.note
})

// Create
const createContract = async (contract: Partial<Contract>): Promise<Contract> => {
  // Inverse Map (Frontend camelCase -> Backend expected field body)
  // Actually the route expects camelCase body and maps to DB columns inside `contracts.js`!
  // Let's double check `contracts.js`.
  // Yes: "const { projectId, type ... } = req.body".
  // So we can send camelCase.
  const res = await apiClient.post('/contracts', contract)
  return mapContractFromDB(res.data)
}

// Update
const updateContract = async (contract: Partial<Contract>): Promise<Contract> => {
  if (!contract.id) throw new Error("Missing ID")
  const res = await apiClient.put(`/contracts/${contract.id}`, contract)
  return mapContractFromDB(res.data)
}

// Delete
const deleteContract = async (id: string): Promise<void> => {
  await apiClient.delete(`/contracts/${id}`)
}

export const useContracts = (projectId?: string) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['contracts', projectId],
    queryFn: () => fetchContracts(projectId),
  })

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    }
  })

  return {
    ...query,
    createContract: createMutation.mutateAsync,
    updateContract: updateMutation.mutateAsync,
    deleteContract: deleteMutation.mutateAsync,
  }
}
