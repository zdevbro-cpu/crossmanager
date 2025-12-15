import { useMemo } from 'react'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSite } from '../contexts/SiteContext'
import DashboardHero from './dashboard/DashboardHero'
import MaterialTrendChart from './dashboard/MaterialTrendChart'
import { formatPct, formatQty } from './dashboard/format'
import { useSwmsDashboardData } from './dashboard/useSwmsDashboardData'

import './Page.css'
import './Dashboard.css'

function KpiTile(props: {
  title: string
  value: string
  sub?: string
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
}) {
  return (
    <section className={`kpi-tile kpi-tile--${props.tone || 'slate'}`}>
      <div className="kpi-tile__head">
        <div>
          <p className="kpi-tile__title">{props.title}</p>
          <div className="kpi-tile__value">{props.value}</div>
          {props.sub ? <div className="kpi-tile__sub">{props.sub}</div> : null}
        </div>
      </div>
    </section>
  )
}

export default function DashboardOperations() {
  const { currentSite, error, refreshSites } = useSite()
  const siteId = currentSite?.id
  const data = useSwmsDashboardData(siteId)

  const actions = useMemo(() => {
    const items: Array<{
      key: string
      level: 'info' | 'warn' | 'critical'
      title: string
      desc: string
      date: string
    }> = []

    const dateLabel = data.today.replaceAll('-', '. ')
    const pendingOut = data.workQueue.data?.outboundPlanned?.length ?? 0
    const pendingInspection = data.workQueue.data?.inspectionWaiting?.length ?? 0
    const pendingSettlement = data.workQueue.data?.settlementWaiting?.length ?? 0
    const critical = data.risk.data?.anomalies.critical ?? 0

    if (pendingOut > 0) {
      items.push({
        key: 'outbound',
        level: 'info',
        title: '출고 처리',
        desc: `금일 출고 예정 ${pendingOut}건`,
        date: dateLabel,
      })
    }
    if (pendingInspection > 0) {
      items.push({
        key: 'inspection',
        level: 'warn',
        title: '검수 대기',
        desc: `검수 미완료 ${pendingInspection}건`,
        date: dateLabel,
      })
    }
    if (pendingSettlement > 0) {
      items.push({
        key: 'settlement',
        level: 'warn',
        title: '정산 대기',
        desc: `정산 DRAFT ${pendingSettlement}건`,
        date: dateLabel,
      })
    }
    if (critical > 0) {
      items.push({
        key: 'critical',
        level: 'critical',
        title: '이상 징후 확인',
        desc: `Critical ${critical}건`,
        date: dateLabel,
      })
    }

    if (items.length === 0) {
      items.push({
        key: 'none',
        level: 'info',
        title: '즉시 처리 항목 없음',
        desc: '현재 기준으로 처리할 항목이 없습니다.',
        date: dateLabel,
      })
    }

    return items.slice(0, 3)
  }, [data.risk.data?.anomalies.critical, data.today, data.workQueue.data])

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
  const pricingMaterials = data.pricingMaterials.data || []
  const firstMaterialId = pricingMaterials[0]?.materialTypeId

  return (
    <div className="page swms-dashboard swms-dashboard--compact">
      <DashboardHero
        title="SWMS 통합 대시보드"
        subtitle="현장 운영을 빠르게 확인하고 조치합니다"
        meta={`${currentSite?.name} · ${data.today}`}
        mode="operations"
      />

      <section className="kpi-grid" aria-label="KPI cards">
        <KpiTile
          title="금일 입고/반출량"
          value={`${formatQty(kpi.flow.inboundQty, '톤')} / ${formatQty(kpi.flow.outboundQty, '톤')}`}
          sub={`전일 대비 입고 ${formatPct(kpi.flow.inboundDeltaPct)}, 반출 ${formatPct(kpi.flow.outboundDeltaPct)}`}
          tone="emerald"
        />
        <KpiTile
          title="현재 재고"
          value={`${kpi.inventory.totalQty.toLocaleString()} 톤`}
          sub={`품목 ${kpi.inventory.itemCount.toLocaleString()}개`}
          tone="amber"
        />
        <KpiTile
          title="정산 대기"
          value={`${kpi.settlement.pendingCount.toLocaleString()}건`}
          sub={`${Math.round(kpi.settlement.pendingAmount).toLocaleString()} 원`}
          tone="blue"
        />
        <KpiTile
          title="이상 징후"
          value={`${kpi.anomalies.openTotal.toLocaleString()}건`}
          sub={`Critical ${kpi.anomalies.openCritical.toLocaleString()}건`}
          tone="rose"
        />
      </section>

      <section className="dashboard-grid">
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* Today's Unit Price Proposal Removed for Operations View */}

          {firstMaterialId ? (
            <MaterialTrendChart siteId={siteId} materialTypeId={firstMaterialId} height={220} />
          ) : null}

          <section className="dash-card">
            <div className="dash-card__header">
              <div>
                <h3 className="dash-card__title">시간대별 반출(금일)</h3>
                <div className="dash-card__hint">Gate/계근 기반(OUT)</div>
              </div>
              <span className="badge badge-tag">{data.outboundByHour.isLoading ? '로딩' : 'TODAY'}</span>
            </div>
            <div style={{ height: 200, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart data={data.outboundByHour.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
                  <XAxis dataKey="hour" stroke="#9fb2cc" tickLine={false} axisLine={false} />
                  <YAxis stroke="#9fb2cc" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,16,32,0.95)',
                      borderColor: 'rgba(255,255,255,0.10)',
                      borderRadius: '12px',
                    }}
                    formatter={(v: any) => [`${Number(v || 0).toLocaleString()} 톤`, '반출']}
                  />
                  <Bar dataKey="quantity" fill="#58f099" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <section className="action-box">
            <div className="action-box__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={18} color="#ffcd4d" />
                <strong>즉시 조치 (Action)</strong>
              </div>
              <span className="badge badge-tag">{data.risk.isLoading ? '로딩' : 'LIVE'}</span>
            </div>
            {actions.map((a) => (
              <div key={a.key} className={`action-item action-item--${a.level}`}>
                <div className="action-item__top">
                  <div className="action-item__title">{a.title}</div>
                  <div className="action-item__date">{a.date}</div>
                </div>
                <div className="action-item__desc">{a.desc}</div>
                <div className="action-item__cta">
                  <button className="btn-glow" type="button">
                    이동 <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </section>
    </div>
  )
}
