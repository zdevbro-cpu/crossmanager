import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'

export type NullableNumber = number | null

export interface DashboardKpi {
  date: string
  siteId: string | null
  flow: {
    inboundQty: number
    outboundQty: number
    inboundDeltaPct: NullableNumber
    outboundDeltaPct: NullableNumber
  }
  inventory: {
    totalQty: number
    itemCount: number
    targetPct: NullableNumber
    status: 'ok' | 'partial' | 'todo'
  }
  month: {
    processedQty: NullableNumber
    targetPct: NullableNumber
    status: 'ok' | 'partial' | 'todo'
  }
  dispatch: {
    planned: NullableNumber
    done: NullableNumber
    ratePct: NullableNumber
    status: 'ok' | 'partial' | 'todo'
  }
  sales: {
    expected: number
    confirmed: number
  }
  profit: {
    scrapRevenue: NullableNumber
    wasteCost: NullableNumber
    net: NullableNumber
    status: 'ok' | 'partial' | 'todo'
  }
  settlement: {
    pendingCount: number
    pendingAmount: number
    stageBreakdown: unknown
    status: 'ok' | 'partial' | 'todo'
  }
  anomalies: {
    openTotal: number
    openCritical: number
  }
}

export interface StageQty {
  stage: string
  quantity: number
}

export interface OutboundByHour {
  hour: string
  quantity: number
}

export interface PortfolioRow {
  type: 'SCRAP' | 'WASTE'
  quantity: number
}

export interface PriceMarginRow {
  date: string
  avgPrice: number
  avgMargin: number
}

export interface InventoryHeatRow {
  material: string
  grade: string
  quantity: number
}

export interface WorkQueueResponse {
  date: string
  siteId: string | null
  outboundPlanned: any[]
  inspectionWaiting: any[]
  settlementWaiting: any[]
}

export interface RiskResponse {
  siteId: string | null
  periodDays: number
  anomalies: { total: number; critical: number; warn: number }
  negativeInventoryCount: number
  allbaro: { failed: number; pending: number }
  sla: { status: 'todo' }
}

export interface MarketTickerRow {
  symbol: string
  source: string
  usdPerTon: number
  fxUsdKrw: number
  krwPerTon: number
  deltaPct: NullableNumber
  updatedAt: string
}

export interface PricingMaterial {
  materialTypeId: string
  materialName: string
  unit: string
  symbol: string
  source: string
  coefficientPct: number
  fixedCostKrwPerTon: number
}

export interface PricingRecommendation {
  date: string
  siteId: string | null
  materialTypeId: string
  symbol: string | null
  source: string | null
  market: { usdPerTon: number; fxUsdKrw: number; krwPerTon: number }
  coefficientPct: number
  fixedCostKrwPerTon: number
  suggestedKrwPerTon: number
  lastApprovedKrwPerTon: number
  lastApprovedAt: string | null
}

export interface PricingTrendRow {
  date: string
  marketKrwPerTon: number
  approvedKrwPerTon: number
}

export function useSwmsDashboardData(siteId?: string) {
  const today = new Date().toISOString().slice(0, 10)

  const kpi = useQuery<DashboardKpi>({
    queryKey: ['swms-dashboard', 'kpi', siteId, today],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/kpi', { params: { siteId, date: today } })).data,
    retry: 1,
  })

  const flow = useQuery<StageQty[]>({
    queryKey: ['swms-dashboard', 'flow', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/charts/flow', { params: { siteId, periodDays: 30 } })).data,
    retry: 1,
  })

  const outboundByHour = useQuery<OutboundByHour[]>({
    queryKey: ['swms-dashboard', 'outbound-by-hour', siteId, today],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/charts/outbound-by-hour', { params: { siteId, date: today } })).data,
    retry: 1,
  })

  const portfolio = useQuery<PortfolioRow[]>({
    queryKey: ['swms-dashboard', 'portfolio', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/charts/portfolio', { params: { siteId, periodDays: 30 } })).data,
    retry: 1,
  })

  const priceMargin = useQuery<PriceMarginRow[]>({
    queryKey: ['swms-dashboard', 'price-margin', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/charts/price-margin', { params: { siteId, periodDays: 30 } })).data,
    retry: 1,
  })

  const inventoryHeat = useQuery<InventoryHeatRow[]>({
    queryKey: ['swms-dashboard', 'inventory-heatmap', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/charts/inventory-heatmap', { params: { siteId, limit: 40 } })).data,
    retry: 1,
  })

  const workQueue = useQuery<WorkQueueResponse>({
    queryKey: ['swms-dashboard', 'work-queue', siteId, today],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/work-queue', { params: { siteId, date: today } })).data,
    retry: 1,
  })

  const risk = useQuery<RiskResponse>({
    queryKey: ['swms-dashboard', 'risk', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/dashboard/risk', { params: { siteId, periodDays: 30 } })).data,
    retry: 1,
  })

  const ticker = useQuery<MarketTickerRow[]>({
    queryKey: ['swms-market', 'ticker', siteId, today],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/market/ticker', { params: { siteId, date: today } })).data,
    retry: 1,
  })

  const pricingMaterials = useQuery<PricingMaterial[]>({
    queryKey: ['swms-pricing', 'materials', siteId],
    enabled: !!siteId,
    queryFn: async () => (await apiClient.get('/swms/pricing/materials', { params: { siteId } })).data,
    retry: 1,
  })

  return {
    today,
    kpi,
    flow,
    outboundByHour,
    portfolio,
    priceMargin,
    inventoryHeat,
    workQueue,
    risk,
    ticker,
    pricingMaterials,
  }
}

