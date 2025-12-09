export type CustomerRegulation = "삼성" | "LG" | "기타"

export interface Project {
  id: string
  code: string
  name: string
  client: string
  address: string
  startDate: string
  endDate: string
  securityLevel: string
  pm: string
  regulation: CustomerRegulation
  status: "준비" | "진행" | "완료"
}

export interface Task {
  id: string
  projectId?: string
  name: string
  start: string
  end: string
  predecessors: string[]
  progress: number
  delayRisk?: boolean
  weight?: number
  order?: number
  parentId?: string
}

export interface Resource {
  id: string
  type: "장비" | "인력"
  name: string
  projectId: string
  assignments: Array<{
    taskId: string
    start: string
    end: string
    assignmentId?: string
  }>
  conflicts?: string[]
}

export interface Contract {
  id: string
  projectId: string
  type: "계약" | "견적" | "변경"
  amount: number
  status: "작성" | "검토" | "승인" | "준비" | "완료"
  regulation: CustomerRegulation
}

export interface DocumentMeta {
  id: string
  projectId: string
  kind: "도면" | "계약서" | "허가서" | "기타"
  type?: "도면" | "계약서" | "허가서" | "기타" // 호환용
  name: string
  version: string
  tags: string[]
  url?: string
}

export interface ReportMeta {
  id: string
  projectId: string
  type: "일일" | "주간" | "월간"
  period: string
  format: CustomerRegulation
  createdAt: string
}
