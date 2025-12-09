
import { useQuery } from '@tanstack/react-query'
import { mockDocuments } from '../data/mock'
import type { DocumentMeta } from '../types/pms'

const fetchDocuments = async (): Promise<DocumentMeta[]> => {
  // TODO: 백엔드 API 구현 필요
  return Promise.resolve(mockDocuments)
}

export const useDocuments = () =>
  useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  })
