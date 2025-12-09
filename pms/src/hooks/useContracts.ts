
import { useQuery } from '@tanstack/react-query'
import { mockContracts } from '../data/mock'
import type { Contract } from '../types/pms'

const fetchContracts = async (): Promise<Contract[]> => {
  // TODO: 백엔드 API 구현 필요
  return Promise.resolve(mockContracts)
}

export const useContracts = () =>
  useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
  })
