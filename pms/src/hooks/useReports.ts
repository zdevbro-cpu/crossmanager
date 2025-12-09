
import { useQuery } from '@tanstack/react-query'
import { mockReports } from '../data/mock'
import type { ReportMeta } from '../types/pms'

const fetchReports = async (): Promise<ReportMeta[]> => {
  // TODO: 백엔드 API 구현 후 apiClient 연결 필요
  return Promise.resolve(mockReports)
}

export const useReports = () =>
  useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })
