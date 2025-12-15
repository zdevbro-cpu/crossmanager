import type { MarketTickerRow } from './useSwmsDashboardData'
import { formatPct } from './format'

function formatUsd(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function formatFx(value: number) {
  return `₩${Math.round(value).toLocaleString()}`
}

function formatKrwPerTon(value: number) {
  return `₩${Math.round(value).toLocaleString()}/톤`
}

function symbolLabel(symbol: string) {
  if (symbol === 'CU') return 'LME 구리(CU)'
  if (symbol === 'AL') return 'LME 알루미늄(AL)'
  if (symbol === 'ZN') return 'LME 아연(ZN)'
  if (symbol === 'SN') return 'LME 주석(SN)'
  return symbol
}

export default function MarketTicker(props: { rows?: MarketTickerRow[]; loading?: boolean }) {
  const rows = props.rows || []
  if (props.loading) {
    return (
      <div className="ticker">
        <div className="ticker__inner">
          <span className="ticker__item">Market loading...</span>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="ticker">
        <div className="ticker__inner">
          <span className="ticker__item">Market data is empty.</span>
        </div>
      </div>
    )
  }

  const items = rows.map((r) => {
    const color = (r.deltaPct ?? 0) >= 0 ? 'ticker__up' : 'ticker__down'
    return (
      <span key={`${r.symbol}-${r.source}`} className={`ticker__item ${color}`}>
        <strong>{symbolLabel(r.symbol)}</strong>: {formatUsd(r.usdPerTon)} ({formatPct(r.deltaPct)}) · FX {formatFx(r.fxUsdKrw)} · {formatKrwPerTon(r.krwPerTon)}
      </span>
    )
  })

  return (
    <div className="ticker" aria-label="Market ticker">
      <div className="ticker__track">
        <div className="ticker__inner">{items}{items}</div>
      </div>
    </div>
  )
}

