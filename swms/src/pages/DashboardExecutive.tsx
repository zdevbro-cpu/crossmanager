import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Crown, TrendingUp } from 'lucide-react'
import { useSite } from '../contexts/SiteContext'
import DashboardHero from './dashboard/DashboardHero'
import MarketTicker from './dashboard/MarketTicker'
import PricingDecisionCard from './dashboard/PricingDecisionCard'
import MaterialTrendChart from './dashboard/MaterialTrendChart'
import MarketTrendChart from './dashboard/MarketTrendChart'
import SankeyFlowCard from './dashboard/SankeyFlowCard'
import ZoneHeatmapCard from './dashboard/ZoneHeatmapCard'
import { formatCurrency, formatPct, formatQty } from './dashboard/format'
import { useSwmsDashboardData } from './dashboard/useSwmsDashboardData'

import './Page.css'
import './Dashboard.css'

function SummaryCard(props: {
  title: string
  value: string
  sub?: string
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
  icon?: React.ReactNode
}) {
  return (
    <section className={`kpi-tile kpi-tile--${props.tone || 'slate'}`}>
      <div className="kpi-tile__head">
        <div>
          <p className="kpi-tile__title">{props.title}</p>
          <div className="kpi-tile__value">{props.value}</div>
          {props.sub ? <div className="kpi-tile__sub">{props.sub}</div> : null}
        </div>
        {props.icon ? <div className="kpi-tile__icon">{props.icon}</div> : null}
      </div>
    </section>
  )
}

export default function DashboardExecutive() {
  const { currentSite, error, refreshSites } = useSite()
  const siteId = currentSite?.id
  const data = useSwmsDashboardData(siteId)
  const pricingMaterials = data.pricingMaterials.data || []
  const [materialTypeId, setMaterialTypeId] = useState<string>('')
  const [zoneViewMode, setZoneViewMode] = useState<'capacity' | 'aging'>('capacity')

  // Automatically select first material when loaded
  useEffect(() => {
    if (!materialTypeId && pricingMaterials.length > 0) {
      setMaterialTypeId(pricingMaterials[0].materialTypeId)
    }
  }, [pricingMaterials, materialTypeId])

  const selectedMaterial = useMemo(
    () => pricingMaterials.find((m) => m.materialTypeId === materialTypeId) || pricingMaterials[0] || null,
    [materialTypeId, pricingMaterials]
  )

  if (!siteId) {
    return (
      <div className="page">
        <div className="card">
          <h2 className="card-label">현장을 불러올 수 없습니다</h2>
          <p className="muted">서버 연결 또는 현장 목록 API를 확인해주세요.</p>
          {error ? (
            <pre className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
              {error}
            </pre>
          ) : null}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button className="pill pill-outline" onClick={() => refreshSites()}>
              다시 시도
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (data.kpi.isLoading) {
    return (
      <div className="page">
        <div className="spinner-wrap">
          <div className="spinner" />
          대시보드를 불러오는 중입니다...
        </div>
      </div>
    )
  }
  if (data.kpi.error) {
    return (
      <div className="page">
        <div className="card">
          <h2 className="card-label">대시보드 로드 실패</h2>
          <pre className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
            {data.kpi.error instanceof Error ? data.kpi.error.message : 'Unknown Error'}
          </pre>
        </div>
      </div>
    )
  }

  const kpi = data.kpi.data!
  const dateLabel = data.today.replaceAll('-', '. ')

  return (
    <div className="page swms-dashboard">
      <DashboardHero
        title="경영자 대시보드"
        subtitle="시장 레퍼런스 기반 단가 · 리스크 · 매출을 요약합니다"
        meta={`${currentSite?.name} · ${dateLabel}`}
        mode="executive"
      />

      <MarketTicker rows={data.ticker.data} loading={data.ticker.isLoading} />

      <section className="kpi-grid" aria-label="Executive summary cards">
        <SummaryCard
          title="위험(Critical)"
          value={`${(data.risk.data?.anomalies.critical ?? 0).toLocaleString()}건`}
          sub="이상 징후 중 Critical"
          tone="rose"
          icon={<AlertTriangle size={18} color="#ffc2c2" />}
        />
        <SummaryCard
          title="정산 지연(금액)"
          value={formatCurrency(kpi.settlement.pendingAmount)}
          sub={`${kpi.settlement.pendingCount.toLocaleString()}건`}
          tone="amber"
          icon={<TrendingUp size={18} color="#ffcd4d" />}
        />
        <SummaryCard
          title="월 확정 매출"
          value={formatCurrency(kpi.sales.confirmed)}
          sub={`예상 ${formatCurrency(kpi.sales.expected)}`}
          tone="blue"
          icon={<Crown size={18} color="#8bd3ff" />}
        />
        <SummaryCard
          title="금일 입/반출"
          value={`${formatQty(kpi.flow.inboundQty, '톤')} / ${formatQty(kpi.flow.outboundQty, '톤')}`}
          sub={`전일 대비 ${formatPct(kpi.flow.inboundDeltaPct)} / ${formatPct(kpi.flow.outboundDeltaPct)}`}
          tone="emerald"
        />
      </section>

      <div style={{ display: 'grid', gap: '1.2rem' }}>
        {/* Row 1: Decision & Action */}
        <section className="dashboard-grid" style={{ alignItems: 'stretch' }}>
          {pricingMaterials.length > 0 ? (
            <section className="dash-card">
              <div className="dash-card__header">
                <div>
                  <h3 className="dash-card__title">단가 결정(경영)</h3>
                  <div className="dash-card__hint">재질별로 레퍼런스를 확인하고 “확정”합니다</div>
                </div>
                <span className="badge badge-tag">Decision</span>
              </div>

              <PricingDecisionCard
                siteId={siteId}
                materials={pricingMaterials}
                inventoryHeat={data.inventoryHeat.data}
                selectedId={materialTypeId || undefined}
                onChange={setMaterialTypeId}
              />
            </section>
          ) : (
            <section className="dash-card">
              <div className="dash-card__header">
                <h3 className="dash-card__title">단가 결정</h3>
                <span className="badge badge-tag">N/A</span>
              </div>
              <p className="muted">연동 가능한 재질 매핑이 없습니다. (샘플 시드 또는 매핑 테이블 확인)</p>
            </section>
          )}

          <section className="action-box" style={{ height: 'auto', minHeight: 0 }}>
            <div className="action-box__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={18} color="#ffcd4d" />
                <strong>의사결정 필요 (Action)</strong>
              </div>
              <span className="badge badge-tag">{data.risk.isLoading ? '로딩' : 'LIVE'}</span>
            </div>

            <div className="action-box__list">
              {(
                [
                  {
                    key: 'pricing',
                    level: 'warn',
                    title: '단가 확정/점검',
                    desc: '시장 변동 발생 시 조정계수 및 제안 단가를 확인하세요.',
                    date: dateLabel,
                  },
                  {
                    key: 'settlement',
                    level: 'warn',
                    title: '정산 지연 관리',
                    desc: `정산 대기 ${kpi.settlement.pendingCount.toLocaleString()}건`,
                    date: dateLabel,
                  },
                  {
                    key: 'risk',
                    level: kpi.anomalies.openCritical > 0 ? 'critical' : 'info',
                    title: '리스크/컴플라이언스',
                    desc: `이상 징후 ${kpi.anomalies.openTotal.toLocaleString()}건 (Critical ${kpi.anomalies.openCritical.toLocaleString()})`,
                    date: dateLabel,
                  },
                ] as Array<{
                  key: string
                  level: 'info' | 'warn' | 'critical'
                  title: string
                  desc: string
                  date: string
                }>
              ).map((a) => (
                <div key={a.key} className={`action-item action-item--${a.level}`}>
                  <div className="action-item__top">
                    <div className="action-item__title">{a.title}</div>
                    <div className="action-item__date">{a.date}</div>
                  </div>
                  <div className="action-item__desc">{a.desc}</div>
                  <div className="action-item__cta">
                    <button className="btn-glow" type="button">
                      검토 <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        {/* Row 2: Charts */}
        <section className="dashboard-grid" style={{ alignItems: 'start' }}>
          <MarketTrendChart height={280} forcedSymbol={selectedMaterial?.symbol || undefined} />

          {selectedMaterial ? (
            <MaterialTrendChart
              siteId={siteId}
              materialTypeId={selectedMaterial.materialTypeId}
              title={`가격 추이 (${selectedMaterial.materialName})`}
              height={280}
            />
          ) : <div />}
        </section>

        {/* Row 3: Flow & Capacity */}
        <section className="dashboard-grid" style={{ alignItems: 'stretch' }}>
          <SankeyFlowCard response={data.sankey.data} loading={data.sankey.isLoading} height={340} />
          <ZoneHeatmapCard
            viewMode={zoneViewMode}
            onChange={setZoneViewMode}
            capacity={data.zoneHeatCapacity.data}
            aging={data.zoneHeatAging.data}
            loading={(zoneViewMode === 'capacity' ? data.zoneHeatCapacity.isLoading : data.zoneHeatAging.isLoading) || false}
            height={340}
          />
        </section>
      </div>
    </div>
  )
}
