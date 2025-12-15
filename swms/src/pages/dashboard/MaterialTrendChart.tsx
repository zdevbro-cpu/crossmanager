import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { apiClient } from '../../lib/api'
import type { PricingTrendRow } from './useSwmsDashboardData'
import { formatCurrency } from './format'

export default function MaterialTrendChart(props: {
  siteId: string
  materialTypeId: string
  title?: string
  days?: number
  height?: number
}) {
  const days = props.days ?? 30
  const q = useQuery<PricingTrendRow[]>({
    queryKey: ['swms-pricing', 'trend', props.siteId, props.materialTypeId, days],
    enabled: !!props.materialTypeId,
    queryFn: async () => {
      const res = await apiClient.get('/swms/pricing/trend', {
        params: { siteId: props.siteId, materialTypeId: props.materialTypeId, days },
      })
      return res.data
    },
    retry: 1,
  })

  return (
    <section className="dash-card">
      <div className="dash-card__header">
        <div>
          <h3 className="dash-card__title">{props.title || '가격 추이 (Market vs Approved)'}</h3>
          <div className="dash-card__hint">Market(LME 환산가)와 확정 단가 비교</div>
        </div>
        <span className="badge badge-tag">{q.isLoading ? '로딩' : `${days}일`}</span>
      </div>

      <div style={{ height: props.height ?? 260, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={props.height ?? 260}>
          <LineChart data={q.data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
            <XAxis dataKey="date" stroke="#9fb2cc" tickLine={false} axisLine={false} hide />
            <YAxis stroke="#9fb2cc" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,16,32,0.95)',
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: '12px',
              }}
              formatter={(v: any, name: any) => [
                formatCurrency(Number(v || 0)),
                name === 'marketKrwPerTon' ? '시장가(원/톤)' : '확정 단가(원/톤)',
              ]}
            />
            <Legend />
            <Line type="monotone" dataKey="marketKrwPerTon" stroke="#94a3b8" strokeWidth={2} dot={false} name="시장가(원/톤)" />
            <Line type="monotone" dataKey="approvedKrwPerTon" stroke="#60a5fa" strokeWidth={3} dot={false} name="확정 단가(원/톤)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
