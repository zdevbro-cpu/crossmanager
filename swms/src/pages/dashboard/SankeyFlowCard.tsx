import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { SankeyResponse } from './useSwmsDashboardData'

type Stage = 'INBOUND' | 'SORT' | 'STORAGE' | 'OUTBOUND' | 'SETTLEMENT' | 'UNKNOWN'

type Size = { width: number; height: number }

function stageFromNodeName(name: string): Stage {
  const n = String(name || '')
  if (n.startsWith('입고')) return 'INBOUND'
  if (n.startsWith('선별')) return 'SORT'
  if (n.startsWith('보관:')) return 'STORAGE'
  if (n.startsWith('출고')) return 'OUTBOUND'
  if (n.startsWith('정산')) return 'SETTLEMENT'
  return 'UNKNOWN'
}

function normalizeZoneLabel(name: string) {
  const n = String(name || '')
  if (!n.startsWith('보관:')) return n
  let zone = n.replace(/^보관:/, '')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zone)) {
    return '보관:기타'
  }
  zone = zone.replace(/^\[SAMPLE\]\s*/, '')
  zone = zone.replace(/\s*구역$/, '')
  zone = zone.replace(/^인도어\s*/, '인도어')
  zone = zone.replace(/^아웃도어\s*/, '아웃도어')
  return `보관:${zone}`
}

function colorForStage(stage: Stage) {
  if (stage === 'INBOUND') return '#60a5fa'
  if (stage === 'SORT') return '#a78bfa'
  if (stage === 'STORAGE') return '#34d399'
  if (stage === 'OUTBOUND') return '#fbbf24'
  if (stage === 'SETTLEMENT') return '#94a3b8'
  return 'rgba(148,163,184,0.45)'
}

function isCongestedZone(normalizedNodeName: string) {
  const n = normalizeZoneLabel(normalizedNodeName)
  return n === '보관:인도어1' || n === '보관:인도어2'
}

function shortLabelForNode(normalizedNodeName: string) {
  const name = normalizeZoneLabel(normalizedNodeName)
  const stage = stageFromNodeName(name)
  if (stage === 'INBOUND') return '입고'
  if (stage === 'SORT') return '선별'
  if (stage === 'OUTBOUND') return '출고'
  if (stage === 'SETTLEMENT') return name.includes('대기') ? '정산대기' : '정산확정'
  if (stage === 'STORAGE') {
    if (name === '보관:기타') return '기타'
    const m = name.match(/^보관:(인도어|아웃도어)(\d+)$/)
    if (m) return `${m[1] === '인도어' ? 'I' : 'O'}${m[2]}`
    return 'Zone'
  }
  return ''
}

function colorForNodeName(name: string) {
  const n = normalizeZoneLabel(name)
  const stage = stageFromNodeName(n)
  if (stage !== 'STORAGE') return colorForStage(stage)
  if (isCongestedZone(n)) return '#fb7185'
  if (n.includes('인도어')) return '#34d399'
  if (n.includes('아웃도어')) return '#22d3ee'
  return '#34d399'
}

function toSvgId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
}

function displayNameForTooltip(rawName: string) {
  const name = normalizeZoneLabel(rawName)
  const stage = stageFromNodeName(name)
  const short = shortLabelForNode(name)
  if (stage !== 'STORAGE') return { name, stage, short }
  if (name === '보관:기타') return { name: '보관:기타', stage, short: '기타' }
  const m = name.match(/^보관:(인도어|아웃도어)(\d+)$/)
  if (!m) return { name, stage, short }
  return { name: `보관:${m[1]}${m[2]}`, stage, short }
}

function SankeyTooltipContent({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]?.payload ?? payload[0]

  const sourceName = p?.source?.payload?.name ?? p?.source?.name
  const targetName = p?.target?.payload?.name ?? p?.target?.name
  const nodeName = p?.name ?? p?.payload?.name
  const value =
    payload?.[0]?.value ??
    p?.value ??
    p?.payload?.value ??
    p?.payload?.payload?.value

  const baseStyle: CSSProperties = {
    backgroundColor: 'rgba(10,16,32,0.95)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '0.55rem 0.65rem',
    boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
    color: '#f4f7ff',
    minWidth: 220,
  }

  if (sourceName && targetName) {
    const s = displayNameForTooltip(String(sourceName))
    const t = displayNameForTooltip(String(targetName))
    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 850, letterSpacing: '-0.01em' }}>
          {s.short || s.name} <span style={{ color: '#9fb2cc' }}>→</span> {t.short || t.name}
        </div>
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: '#9fb2cc', fontSize: 12 }}>흐름(수량)</span>
          <span style={{ fontWeight: 850 }}>{value === null || value === undefined ? '?' : `${Number(value).toLocaleString()} 톤`}</span>
        </div>
        <div style={{ marginTop: 6, color: '#9fb2cc', fontSize: 12 }}>
          {s.name} → {t.name}
        </div>
      </div>
    )
  }

  if (nodeName) {
    const n = displayNameForTooltip(String(nodeName))
    const sortSignal = (payload as any)?.[0]?.payload?.__sortSignal
    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 850, letterSpacing: '-0.01em' }}>{n.name}</div>
        <div style={{ marginTop: 6, color: '#9fb2cc', fontSize: 12 }}>단계: {n.short || n.stage}</div>
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: '#9fb2cc', fontSize: 12 }}>수량</span>
          <span style={{ fontWeight: 850 }}>{value === null || value === undefined ? '?' : `${Number(value).toLocaleString()} 톤`}</span>
        </div>
        {n.stage === 'SORT' && sortSignal ? (
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ color: '#9fb2cc', fontSize: 12 }}>평균 체류</span>
            <span style={{ fontWeight: 850 }}>
              {sortSignal.avgHours === null ? '?' : `${Math.round(sortSignal.avgHours)}h`}
              {sortSignal.isBottleneck ? ' (병목)' : ''}
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  return null
}

function SankeyNodeShapeFactory(opts: {
  midY: number
  verticalScale: number
  focusName: string | null
  activeNames: Set<string> | null
  sortBottleneck: boolean
  onFocusNode: (name: string | null) => void
}) {
  return function SankeyNodeShapeScaled(props: any) {
    const rawName = String(props?.payload?.name || '')
    const name = normalizeZoneLabel(rawName)
    const stage = stageFromNodeName(name)
    const fill = colorForNodeName(name)
    const x = Number(props.x || 0)
    const y = Number(props.y || 0)
    const width = Number(props.width || 0)
    const height = Number(props.height || 0)
    const label = shortLabelForNode(name)
    const congested = stage === 'STORAGE' && isCongestedZone(name)
    const showLabel = stage === 'STORAGE'
    const sortBottleneck = stage === 'SORT' && opts.sortBottleneck

    const scaledHeight = Math.max(3, height * opts.verticalScale)
    const scaledY = opts.midY + (y - opts.midY) * opts.verticalScale
    const isDimmed = opts.activeNames ? !opts.activeNames.has(name) : false
    const isFocused = opts.focusName === name
    const opacity = isDimmed ? 0.18 : 0.92

    const visualWidth =
      stage === 'STORAGE'
        ? Math.min(width + 36, Math.max(width, scaledHeight * 1.2))
        : width
    const visualX = stage === 'STORAGE' ? x - (visualWidth - width) / 2 : x
    const visualRx = stage === 'STORAGE' ? Math.min(999, scaledHeight / 2) : 8
    const visualRy = stage === 'STORAGE' ? Math.min(999, scaledHeight / 2) : 8

    return (
      <g
        onMouseEnter={() => opts.onFocusNode(name)}
        onMouseLeave={() => opts.onFocusNode(null)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={visualX}
          y={scaledY}
          width={visualWidth}
          height={scaledHeight}
          rx={visualRx}
          ry={visualRy}
          fill={fill}
          opacity={opacity}
          stroke={
            congested
              ? 'rgba(255, 94, 136, 0.95)'
              : sortBottleneck
                ? 'rgba(255, 0, 0, 0.95)'
                : 'rgba(255,255,255,0.18)'
          }
          strokeWidth={congested || sortBottleneck ? 2.5 : 1}
          style={
            isDimmed
              ? undefined
              : {
                  filter: isFocused
                    ? 'drop-shadow(0 8px 22px rgba(0,0,0,0.45))'
                    : 'drop-shadow(0 6px 16px rgba(0,0,0,0.28))',
                }
          }
        />
        {showLabel && label ? (
          <text
            x={visualX + visualWidth / 2}
            y={scaledY + scaledHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.95)"
            fontSize={11}
            fontWeight={850}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        ) : null}
        <title>
          {name} ({stage})
        </title>
      </g>
    )
  }
}

function SankeyLinkShapeFactory(opts: {
  midY: number
  verticalScale: number
  focusName: string | null
  focusLinkKey: string | null
  onFocusLinkKey: (key: string | null) => void
}) {
  return function SankeyLinkShapeScaled(props: any) {
    const sourceName = normalizeZoneLabel(String(props?.source?.payload?.name || props?.payload?.source?.name || ''))
    const targetName = normalizeZoneLabel(String(props?.target?.payload?.name || props?.payload?.target?.name || ''))
    const stroke = colorForNodeName(sourceName)
    const targetStroke = colorForNodeName(targetName)
    const sx = Number(props.sourceX || 0)
    const sy = Number(props.sourceY || 0)
    const tx = Number(props.targetX || 0)
    const ty = Number(props.targetY || 0)
    const width = Math.max(0.55, Number(props.linkWidth || 1) * 0.35)
    const c = 0.5
    const dx = tx - sx

    const y1 = opts.midY + (sy - opts.midY) * opts.verticalScale
    const y2 = opts.midY + (ty - opts.midY) * opts.verticalScale
    const d = `M${sx},${y1} C${sx + dx * c},${y1} ${tx - dx * c},${y2} ${tx},${y2}`

    const key = `${sourceName}→${targetName}`
    const id = `grad_${toSvgId(key)}`
    const isFocusedLink = opts.focusLinkKey ? opts.focusLinkKey === key : false
    const isDimmed =
      opts.focusLinkKey
        ? !isFocusedLink
        : opts.focusName
          ? sourceName !== opts.focusName && targetName !== opts.focusName
          : false

    const strokeOpacity = isDimmed ? 0.05 : isFocusedLink ? 0.72 : 0.24
    const displayWidth = isDimmed ? width : isFocusedLink ? width * 2.0 : width * 1.15
    const baseShadowOpacity = isDimmed ? 0 : isFocusedLink ? 0.32 : 0.16

    return (
      <g
        onMouseEnter={() => opts.onFocusLinkKey(key)}
        onMouseLeave={() => opts.onFocusLinkKey(null)}
        style={{ cursor: 'pointer' }}
      >
        <defs>
          <linearGradient id={id} x1={sx} y1={y1} x2={tx} y2={y2} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={stroke} stopOpacity={1} />
            <stop offset="100%" stopColor={targetStroke} stopOpacity={1} />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.40)"
          strokeOpacity={baseShadowOpacity}
          strokeWidth={displayWidth + 1.6}
          strokeLinecap="round"
          style={isDimmed ? undefined : { filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.35))' }}
        />
        <path
          d={d}
          fill="none"
          stroke={`url(#${id})`}
          strokeOpacity={strokeOpacity}
          strokeWidth={displayWidth}
          strokeLinecap="round"
        />
      </g>
    )
  }
}

export default function SankeyFlowCard(props: {
  title?: string
  hint?: string
  response?: SankeyResponse
  loading?: boolean
  height?: number
}) {
  const cardHeight = props.height ?? 680
  const compact = cardHeight <= 420
  const minChartHeight = compact ? 260 : 460
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 1, height: minChartHeight })
  const [focusName, setFocusName] = useState<string | null>(null)
  const [focusLinkKey, setFocusLinkKey] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Set initial size synchronously for first paint.
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) })
    }

    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      setSize({ width: Math.max(1, Math.floor(box.width)), height: Math.max(1, Math.floor(box.height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const chartData = useMemo(() => {
    if (!props.response) return null
    const sortBottleneck = props.response.signals?.sortBottleneck || null
    // Recharts Tooltip payload access convenience
    const nodes = (props.response.nodes || []).map((n) => ({ ...n, __sortSignal: sortBottleneck } as any))
    return { nodes, links: props.response.links || [] }
  }, [props.response])

  const sortBottleneckOn = Boolean(props.response?.signals?.sortBottleneck?.isBottleneck)

  const midY = Math.max(1, size.height) / 2
  const verticalScale = compact ? 1 : 0.5

  const activeNames = useMemo(() => {
    if (!chartData) return null
    if (!focusName && !focusLinkKey) return null

    if (focusLinkKey) {
      const [s, t] = focusLinkKey.split('→')
      const set = new Set<string>()
      if (s) set.add(s)
      if (t) set.add(t)
      return set
    }

    if (!focusName) return null
    const nodeIndexToName = chartData.nodes.map((n) => normalizeZoneLabel(String((n as any)?.name || '')))
    const nameToNeighbors = new Map<string, Set<string>>()
    const addEdge = (a: string, b: string) => {
      if (!nameToNeighbors.has(a)) nameToNeighbors.set(a, new Set())
      nameToNeighbors.get(a)!.add(b)
    }
    for (const l of chartData.links as any[]) {
      const s = nodeIndexToName[Number(l.source)]
      const t = nodeIndexToName[Number(l.target)]
      if (!s || !t) continue
      addEdge(s, t)
      addEdge(t, s)
    }
    const set = new Set<string>()
    set.add(focusName)
    for (const n of nameToNeighbors.get(focusName) || []) set.add(n)
    return set
  }, [chartData, focusLinkKey, focusName])

  const NodeShape = useMemo(
    () =>
      SankeyNodeShapeFactory({
        midY,
        verticalScale,
        focusName,
        activeNames,
        sortBottleneck: sortBottleneckOn,
        onFocusNode: (name) => {
          setFocusLinkKey(null)
          setFocusName(name)
        },
      }),
    [activeNames, focusName, midY, sortBottleneckOn, verticalScale]
  )
  const LinkShape = useMemo(
    () =>
      SankeyLinkShapeFactory({
        midY,
        verticalScale,
        focusName,
        focusLinkKey,
        onFocusLinkKey: (key) => {
          setFocusName(null)
          setFocusLinkKey(key)
        },
      }),
    [focusLinkKey, focusName, midY, verticalScale]
  )

  return (
    <section className="dash-card">
      <div className="dash-card__header">
        <div>
          <h3 className="dash-card__title">{props.title || '재고 흐름(Sankey)'}</h3>
          <div className="dash-card__hint">{props.hint || '입고 → 선별 → 보관(Zone) → 출고 → 정산'}</div>
        </div>
        <span className="badge badge-tag">{props.loading ? '로딩' : '30D'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: cardHeight, width: '100%' }}>
        <div
          ref={containerRef}
          style={{ position: 'relative', flex: 1, minHeight: minChartHeight, minWidth: 260, width: '100%' }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 16,
              background:
                'radial-gradient(1200px 600px at 20% 15%, rgba(96,165,250,0.10), transparent 55%), radial-gradient(900px 520px at 75% 28%, rgba(52,211,153,0.09), transparent 52%), radial-gradient(900px 520px at 78% 72%, rgba(251,113,133,0.08), transparent 55%)',
              pointerEvents: 'none',
              opacity: 0.9,
            }}
          />
          {props.loading ? (
            <div className="muted" style={{ padding: '0.8rem' }}>
              불러오는 중...
            </div>
          ) : size.width <= 1 || size.height <= 1 ? (
            <div className="muted" style={{ padding: '0.8rem' }}>
              레이아웃 계산 중...
            </div>
          ) : !chartData || chartData.nodes.length === 0 || chartData.links.length === 0 ? (
            <div className="muted" style={{ padding: '0.8rem' }}>
              표시할 흐름 데이터가 없습니다. (선별/보관 이벤트가 누적되면 표시됩니다)
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={compact ? 220 : 440}>
              <Sankey
                data={chartData as any}
                nodePadding={compact ? 6 : 10}
                nodeWidth={compact ? 12 : 10}
                linkCurvature={0.5}
                margin={{ left: compact ? 12 : 16, right: compact ? 12 : 16, top: compact ? 8 : 16, bottom: compact ? 8 : 16 }}
                node={<NodeShape />}
                link={<LinkShape />}
              >
                <Tooltip content={<SankeyTooltipContent />} />
              </Sankey>
            </ResponsiveContainer>
          )}

          {/* Congestion legend near highlighted (red) zones */}
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.6rem',
              borderRadius: 999,
              background: 'rgba(10,16,32,0.78)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#c6d5f0',
              fontSize: '0.82rem',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: '#fb7185',
                boxShadow: '0 0 0 3px rgba(251,113,133,0.18)',
              }}
            />
            <strong style={{ color: '#f4f7ff', fontWeight: 750 }}>적체</strong>
            <span style={{ color: '#9fb2cc' }}>Zone (I1, I2)</span>
          </div>
        </div>

        <div style={{ marginTop: compact ? '0.45rem' : '0.75rem', display: 'flex', justifyContent: 'center' }}>
          <div
            aria-hidden
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 6 : 8,
              padding: compact ? '0.25rem 0.45rem' : '0.3rem 0.55rem',
              borderRadius: 999,
              background: 'rgba(10,16,32,0.62)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#f4f7ff',
              fontSize: compact ? '0.74rem' : '0.8rem',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {[
              { label: '입고', color: colorForStage('INBOUND') },
              { label: '선별', color: sortBottleneckOn ? 'rgba(255, 0, 0, 0.95)' : colorForStage('SORT') },
              { label: '보관', color: colorForStage('STORAGE') },
              { label: '출고', color: colorForStage('OUTBOUND') },
              { label: '정산', color: colorForStage('SETTLEMENT') },
            ].map((s, idx, arr) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: compact ? 5 : 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: s.color,
                    boxShadow: `0 0 0 3px ${s.color}22`,
                  }}
                />
                <strong style={{ fontWeight: 850 }}>{s.label}</strong>
                {idx < arr.length - 1 ? <span style={{ color: '#9fb2cc' }}>→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
