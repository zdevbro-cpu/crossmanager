export function validateDateRange(start?: string, end?: string): string | null {
  if (start && end) {
    const s = new Date(start)
    const e = new Date(end)
    if (s > e) return '시작일은 종료일보다 늦을 수 없습니다.'
  }
  return null
}

export function validatePositiveAmount(amount: number): string | null {
  if (Number.isNaN(amount) || amount <= 0) return '금액은 0보다 커야 합니다.'
  return null
}

export function validateProgress(progress: number): string | null {
  if (progress < 0 || progress > 100) return '진척률은 0~100% 범위여야 합니다.'
  return null
}
