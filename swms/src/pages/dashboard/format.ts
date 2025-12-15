import type { NullableNumber } from './useSwmsDashboardData'

export function formatPct(value: NullableNumber) {
  if (value === null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function formatCurrency(value: NullableNumber) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value).toLocaleString()} 원`
}

export function formatQty(value: NullableNumber, unit: string) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Number(value).toLocaleString()} ${unit}`
}

