import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { apiClient } from '../../lib/api'
import type { InventoryHeatRow, PricingMaterial, PricingRecommendation } from './useSwmsDashboardData'
import { formatCurrency } from './format'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function PricingDecisionCard(props: {
  siteId: string
  materials: PricingMaterial[]
  inventoryHeat?: InventoryHeatRow[]
  compact?: boolean
  selectedId?: string
  onChange?: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [localMaterialTypeId, setLocalMaterialTypeId] = useState<string>(() => props.materials[0]?.materialTypeId || '')
  const materialTypeId = props.selectedId !== undefined ? props.selectedId : localMaterialTypeId

  const setEffectiveId = (id: string) => {
    if (props.onChange) props.onChange(id)
    else setLocalMaterialTypeId(id)
  }

  const selected = useMemo(() => props.materials.find(m => m.materialTypeId === materialTypeId) || null, [materialTypeId, props.materials])

  const rec = useQuery<PricingRecommendation>({
    queryKey: ['swms-pricing', 'recommendation', props.siteId, materialTypeId, today],
    enabled: !!materialTypeId,
    queryFn: async () => {
      const res = await apiClient.get('/swms/pricing/recommendation', { params: { siteId: props.siteId, materialTypeId, date: today } })
      return res.data
    },
    retry: 1,
  })

  // Reset local adjustments when material changes
  // We can do this by keying the component or effect, but here let's just reset when selected changes
  // actually simpler: key the state content by materialId

  const [coeffPct, setCoeffPct] = useState<number | null>(null)
  const [fixedCost, setFixedCost] = useState<number | null>(null)

  // ... (rest of logic same)

  const liveCoeff = coeffPct ?? rec.data?.coefficientPct ?? selected?.coefficientPct ?? 60
  const liveFixed = fixedCost ?? rec.data?.fixedCostKrwPerTon ?? selected?.fixedCostKrwPerTon ?? 0

  const suggested = useMemo(() => {
    const lme = rec.data?.market.krwPerTon ?? 0
    return Math.round(lme * (liveCoeff / 100) - liveFixed)
  }, [liveCoeff, liveFixed, rec.data?.market.krwPerTon])

  // ... (inventoryTons etc)
  const inventoryTons = useMemo(() => {
    const inv = props.inventoryHeat || []
    const name = selected?.materialName
    if (!name) return 0
    return inv.filter(r => r.material === name).reduce((acc, r) => acc + Number(r.quantity || 0), 0)
  }, [props.inventoryHeat, selected?.materialName])

  const impact = useMemo(() => {
    const last = rec.data?.lastApprovedKrwPerTon ?? 0
    if (!inventoryTons) return null
    if (!last) return null
    const delta = suggested - last
    return Math.round(delta * inventoryTons)
  }, [inventoryTons, rec.data?.lastApprovedKrwPerTon, suggested])

  const approve = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/swms/pricing/approve', {
        siteId: props.siteId,
        materialTypeId,
        effectiveDate: today,
        coefficientPct: liveCoeff,
        fixedCostKrwPerTon: liveFixed,
        approvedKrwPerTon: suggested,
        note: '[UI] approve from dashboard',
        approvedBy: '대표/담당자',
      })
      return res.data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swms-pricing', 'recommendation'] }),
        queryClient.invalidateQueries({ queryKey: ['swms-pricing', 'trend'] }),
        queryClient.invalidateQueries({ queryKey: ['swms-dashboard', 'kpi'] }),
      ])
    },
  })

  if (!selected) return null

  return (
    <section className="dash-card">
      <div className="dash-card__header">
        <div>
          <h3 className="dash-card__title">오늘의 단가 제안</h3>
          <div className="dash-card__hint">LME(중계 API) × 조정계수(%) − 가공/고정비</div>
        </div>
        <span className="badge badge-tag">{rec.isLoading ? '로딩' : selected.symbol || selected.materialName.slice(0, 2)}</span>
      </div>

      <div className="form-grid two" style={{ marginTop: '0.6rem' }}>
        <label>
          <span>기준물질</span>
          <select
            className="input"
            value={materialTypeId}
            onChange={(e) => {
              setEffectiveId(e.target.value)
              setCoeffPct(null)
              setFixedCost(null)
            }}
          >
            {props.materials.map((m) => (
              <option key={m.materialTypeId} value={m.materialTypeId}>
                {m.materialName} ({m.symbol})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>시장 기준가(원/톤)</span>
          <input className="input" value={rec.data ? Math.round(rec.data.market.krwPerTon).toLocaleString() : '—'} readOnly />
        </label>
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <SlidersHorizontal size={16} /> 조정계수 (%)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="input input--sm"
              style={{ width: '80px', textAlign: 'right' }}
              min={10}
              max={150}
              step={0.1}
              value={liveCoeff}
              onChange={(e) => setCoeffPct(Number(e.target.value))}
            />
            <span className="muted">%</span>
          </div>
        </div>

        <input
          type="range"
          min={10}
          max={95}
          step={0.5}
          value={clamp(liveCoeff, 10, 95)}
          onChange={(e) => setCoeffPct(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div className="muted" style={{ textAlign: 'right', marginTop: '0.2rem', fontSize: '0.8rem' }}>
          고정비 {Math.round(liveFixed).toLocaleString()} 원/톤
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: props.compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', marginTop: '0.9rem' }}>
        <section className="kpi-tile kpi-tile--blue" style={{ padding: props.compact ? '0.7rem 0.8rem' : '0.85rem 0.95rem' }}>
          <div className="kpi-tile__title">시스템 제안가</div>
          <div className="kpi-tile__value">{formatCurrency(suggested)}</div>
          <div className="kpi-tile__sub">전일/최근 확정 대비 변화는 추이에서 확인</div>
        </section>
        <section className="kpi-tile kpi-tile--slate" style={{ padding: props.compact ? '0.7rem 0.8rem' : '0.85rem 0.95rem' }}>
          <div className="kpi-tile__title">최근 확정 단가</div>
          <div className="kpi-tile__value">{formatCurrency(rec.data?.lastApprovedKrwPerTon ?? 0)}</div>
          <div className="kpi-tile__sub">{rec.data?.lastApprovedAt ? `승인: ${String(rec.data.lastApprovedAt).slice(0, 10)}` : '—'}</div>
        </section>
        {!props.compact ? (
          <section className="kpi-tile kpi-tile--amber" style={{ padding: '0.85rem 0.95rem' }}>
            <div className="kpi-tile__title">재고 영향(가치 Δ)</div>
            <div className="kpi-tile__value">{impact === null ? '—' : formatCurrency(impact)}</div>
            <div className="kpi-tile__sub">현재 재고 {inventoryTons.toLocaleString()} 톤 기준</div>
          </section>
        ) : null}
      </div>

      <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-glow" type="button" onClick={() => approve.mutate()} disabled={approve.isPending || rec.isLoading}>
          단가 확정 및 적용 <ArrowUpRight size={16} />
        </button>
      </div>

      {approve.isError ? (
        <div className="muted" style={{ marginTop: '0.6rem', color: '#ffc2c2' }}>
          저장 실패: {(approve.error as any)?.message || 'Unknown'}
        </div>
      ) : null}
    </section>
  )
}
