import { useMemo, useRef, useState } from 'react'
import type { ZoneHeatmapResponse, ZoneHeatmapRow } from './useSwmsDashboardData'

function cellToneForCapacity(fillRatePct: number | null) {
  if (fillRatePct === null) return 'slate'
  // 10~110을 4분할: 10~35(Blue) / 36~60(Green) / 61~85(Orange) / 86~110+(Red)
  if (fillRatePct >= 86) return 'red'
  if (fillRatePct >= 61) return 'orange'
  if (fillRatePct >= 36) return 'green'
  return 'blue'
}

function cellToneForAging(maxAgeDays: number | null) {
  if (maxAgeDays === null) return 'slate'
  if (maxAgeDays >= 30) return 'red'
  if (maxAgeDays >= 25) return 'orange'
  if (maxAgeDays >= 20) return 'yellow'
  if (maxAgeDays >= 15) return 'blue'
  if (maxAgeDays >= 10) return 'green'
  return 'lime'
}

type Bucket = { key: string; label: string }

function bucketKeyForCapacity(fillRatePct: number | null) {
  if (fillRatePct === null) return null
  if (fillRatePct >= 100) return '100'
  const v = Math.floor(fillRatePct / 10) * 10
  return String(Math.max(10, v))
}

function bucketKeyForAging(maxAgeDays: number | null) {
  if (maxAgeDays === null) return null
  if (maxAgeDays >= 30) return '30'
  if (maxAgeDays >= 25) return '25'
  if (maxAgeDays >= 20) return '20'
  if (maxAgeDays >= 15) return '15'
  if (maxAgeDays >= 10) return '10'
  return '5'
}

function defaultBucketsForMode(viewMode: 'capacity' | 'aging'): Bucket[] {
  if (viewMode === 'aging') {
    return [
      { key: '30', label: '30+' },
      { key: '25', label: '25' },
      { key: '20', label: '20' },
      { key: '15', label: '15' },
      { key: '10', label: '10' },
      { key: '5', label: '5' },
    ]
  }
  return [
    { key: '100', label: '100+' },
    { key: '90', label: '90' },
    { key: '80', label: '80' },
    { key: '70', label: '70' },
    { key: '60', label: '60' },
    { key: '50', label: '50' },
    { key: '40', label: '40' },
    { key: '30', label: '30' },
    { key: '20', label: '20' },
    { key: '10', label: '10' },
  ]
}

type HoverState = null | {
  x: number
  y: number
  zone: ZoneHeatmapRow
  mode: 'capacity' | 'aging'
}

export default function ZoneHeatmapCard(props: {
  capacity?: ZoneHeatmapResponse
  aging?: ZoneHeatmapResponse
  viewMode: 'capacity' | 'aging'
  onChange: (mode: 'capacity' | 'aging') => void
  loading?: boolean
  height?: number
}) {
  const cardHeight = props.height ?? 680
  const compact = cardHeight <= 420
  const response = props.viewMode === 'capacity' ? props.capacity : props.aging
  const zones = response?.zones || []
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<HoverState>(null)

  const buckets = useMemo(() => defaultBucketsForMode(props.viewMode), [props.viewMode])

  const zonesSorted = useMemo(() => {
    return [...zones].sort((a, b) => String(a.warehouseName || '').localeCompare(String(b.warehouseName || '')))
  }, [zones])

  return (
    <section className="dash-card">
      <div className="dash-card__header">
        <div>
          <h3 className="dash-card__title">Zone Heatmap</h3>
          <div className="dash-card__hint">
            {props.viewMode === 'capacity' ? '가로축: 적재율(%) · 세로축: 구역(Zone)' : '가로축: 체류(일) · 세로축: 구역(Zone)'}
          </div>
        </div>
        <div className="segmented" aria-label="zone heatmap mode">
          <button type="button" className={props.viewMode === 'capacity' ? 'active' : ''} onClick={() => props.onChange('capacity')}>
            포화
          </button>
          <button type="button" className={props.viewMode === 'aging' ? 'active' : ''} onClick={() => props.onChange('aging')}>
            체류
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: cardHeight, width: '100%' }}>
        {props.loading ? (
          <div className="muted" style={{ padding: '0.8rem' }}>
            불러오는 중...
          </div>
        ) : zones.length === 0 ? (
          <div className="muted" style={{ padding: '0.8rem' }}>
            Zone 데이터가 없습니다.
          </div>
        ) : (
          <div
            ref={wrapperRef}
            className="heatmap-wrap"
            style={{ flex: 1, minHeight: 0, marginTop: compact ? '0.2rem' : '0.35rem', position: 'relative', overflow: 'hidden' }}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="heatmap-grid"
              style={{
                height: '100%',
                gridTemplateColumns: `repeat(${buckets.length}, minmax(${compact ? 30 : 38}px, 1fr))`,
                gridTemplateRows: `auto repeat(${zonesSorted.length}, 1fr)`,
                rowGap: compact ? 4 : 8,
                columnGap: compact ? 4 : 8,
              }}
            >
              {buckets.map((b) => (
                <div key={b.key} className="heatmap-xlabel">
                  {props.viewMode === 'capacity' ? `${b.label}%` : `${b.label}일`}
                </div>
              ))}

              {zonesSorted.map((z) => {
                const fill = z.fillRatePct === null ? null : Number(z.fillRatePct)
                const age = z.maxAgeDays === null ? null : Number(z.maxAgeDays)
                const cap = z.capacity === null ? null : Number(z.capacity)
                const qty = Number(z.quantity || 0)

                const activeKey = props.viewMode === 'capacity' ? bucketKeyForCapacity(fill) : bucketKeyForAging(age)

                const tone = props.viewMode === 'capacity' ? cellToneForCapacity(fill) : cellToneForAging(age)

                return (
                  <div key={z.warehouseId} style={{ display: 'contents' }}>
                    {buckets.map((b) => {
                      const isActive = activeKey === b.key
                      const cellKey = `${z.warehouseId}-${b.key}`
                      const title =
                        props.viewMode === 'capacity'
                          ? `${z.warehouseName}\n수량: ${qty.toLocaleString()}${z.unit}${cap ? ` / ${cap.toLocaleString()}${z.unit}` : ''}\n적재율: ${fill === null ? '?' : `${Math.round(fill)}%`}\n체류(Max): ${age === null ? '?' : `${age}일`}`
                          : `${z.warehouseName}\n체류(Max): ${age === null ? '?' : `${age}일`}\n수량: ${qty.toLocaleString()}${z.unit}${cap ? ` / ${cap.toLocaleString()}${z.unit}` : ''}\n적재율: ${fill === null ? '?' : `${Math.round(fill)}%`}`

                      return (
                        <button
                          key={cellKey}
                          type="button"
                          className={`heatmap-cell ${isActive ? `heatmap-cell--${tone}` : 'heatmap-cell--empty'}`}
                          style={{ borderRadius: compact ? 8 : 10 }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              setHover(null)
                              return
                            }
                            const rect = wrapperRef.current?.getBoundingClientRect()
                            const x = rect ? e.clientX - rect.left : e.clientX
                            const y = rect ? e.clientY - rect.top : e.clientY
                            setHover({ x, y, zone: z, mode: props.viewMode })
                          }}
                          onFocus={() => {
                            if (!isActive) return
                            const rect = wrapperRef.current?.getBoundingClientRect()
                            const x = rect ? rect.width / 2 : 200
                            const y = rect ? rect.height / 2 : 120
                            setHover({ x, y, zone: z, mode: props.viewMode })
                          }}
                          onBlur={() => setHover(null)}
                          aria-label={title.replaceAll('\n', ' · ')}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {hover ? (
              <div
                className="heatmap-tooltip"
                style={{
                  left: Math.min(Math.max(hover.x + 12, 12), (wrapperRef.current?.clientWidth || 360) - 240),
                  top: Math.min(Math.max(hover.y + 12, 12), (wrapperRef.current?.clientHeight || 260) - 140),
                }}
              >
                <div className="heatmap-tooltip__title">{hover.zone.warehouseName}</div>
                <div className="heatmap-tooltip__row">
                  <span className="heatmap-tooltip__label">적재율</span>
                  <span className="heatmap-tooltip__value">
                    {hover.zone.fillRatePct === null ? '?' : `${Math.round(Number(hover.zone.fillRatePct))}%`}
                  </span>
                </div>
                <div className="heatmap-tooltip__row">
                  <span className="heatmap-tooltip__label">수량</span>
                  <span className="heatmap-tooltip__value">
                    {Number(hover.zone.quantity || 0).toLocaleString()}
                    {hover.zone.unit}
                    {hover.zone.capacity ? ` / ${Number(hover.zone.capacity).toLocaleString()}${hover.zone.unit}` : ''}
                  </span>
                </div>
                <div className="heatmap-tooltip__row">
                  <span className="heatmap-tooltip__label">체류(Max)</span>
                  <span className="heatmap-tooltip__value">
                    {hover.zone.maxAgeDays === null ? '?' : `${Number(hover.zone.maxAgeDays)}일`}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
