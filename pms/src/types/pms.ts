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

export interface ContractItem {
  id?: string // Optional for new items
  contractId?: string
  group: string // 공종 (group_name)
  name: string
  spec: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  note?: string
}

export interface RegulationItem {
  id: string
  label: string
  checked: boolean
  note?: string
  file?: { name: string, url?: string, size?: number }
}

export interface RegulationConfig {
  name: string
  requirements?: RegulationItem[]
  [key: string]: any
}

export interface Contract {
  id: string
  projectId: string // project_id
  code?: string
  type: "EST" | "CONTRACT" | "CHANGE" // 'EST'(견적), 'CONTRACT'(계약), 'CHANGE'(변경)
  category?: "NEW" | "ADD" | "CHANGE" | "REDUCE" // 'NEW', 'ADD', 'CHANGE', 'REDUCE'
  name: string

  // Amounts
  totalAmount: number
  costDirect: number
  costIndirect: number
  riskFee: number
  margin: number

  // Rates (optional, for auto-calc)
  indirectRate?: number
  riskRate?: number
  marginRate?: number

  regulationConfig?: RegulationConfig

  clientManager?: string
  ourManager?: string

  contractDate?: string
  startDate?: string
  endDate?: string

  attachment?: {
    name: string
    url?: string // in real app, S3/Firebase url
    size?: number
  }

  termsPayment?: string
  termsPenalty?: string

  status: "DRAFT" | "REVIEW" | "SUBMITTED" | "SIGNED" | "REJECTED"
  items?: ContractItem[]

  createdAt?: string
  updatedAt?: string
}

export interface PmsDocument {
  id: string
  projectId: string
  category: string
  type: string
  name: string
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
  currentVersion: string
  createdBy?: string
  createdAt?: string

  // From Join
  filePath?: string
  fileSize?: number
}

// Alias for compatibility if needed, or replace usages
export type DocumentMeta = PmsDocument

export interface ReportMeta {
  id: string
  projectId: string
  type: "일일" | "주간" | "월간"
  period: string
  format: CustomerRegulation
  createdAt: string
}
