
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient } from '../lib/api'

interface KPI {
    totalGeneration: number
    totalSales: number
    totalStockCount: number
}

interface TrendData {
    date: string
    quantity: number
}

export default function Dashboard() {
    const { data: kpi, isLoading: kpiLoading, error: kpiError } = useQuery<KPI>({
        queryKey: ['analytics', 'kpi'],
        queryFn: async () => {
            console.log('Fetching KPI...')
            const res = await apiClient.get('/swms/analytics/dashboard/kpi')
            console.log('KPI Data:', res.data)
            return res.data
        },
        retry: 1
    })

    const { data: trend, isLoading: trendLoading, error: trendError } = useQuery<TrendData[]>({
        queryKey: ['analytics', 'trend'],
        queryFn: async () => {
            console.log('Fetching Trend...')
            const res = await apiClient.get('/swms/analytics/generation/daily?days=30')
            console.log('Trend Data:', res.data)
            return res.data.map((item: any) => ({
                ...item,
                quantity: parseFloat(item.quantity)
            }))
        },
        retry: 1
    })

    if (kpiLoading || trendLoading) {
        return (
            <div className="p-10 flex items-center justify-center text-slate-400">
                <div className="animate-spin mr-3 h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                데이터를 불러오는 중입니다...
            </div>
        )
    }

    if (kpiError || trendError) {
        const err = kpiError || trendError
        return (
            <div className="p-10 text-red-400">
                <h2 className="text-xl font-bold mb-2">데이터 로드 실패</h2>
                <p>서버 API를 호출하는 중 오류가 발생했습니다.</p>
                <code className="block bg-slate-800 p-4 mt-4 rounded text-sm text-slate-300">
                    {err instanceof Error ? err.message : JSON.stringify(err)}
                </code>
                <p className="mt-4 text-sm text-slate-500">
                    * 백엔드 서버(port 3000)가 켜져 있는지 확인해주세요.<br />
                    * 최근 추가된 API가 적용되도록 서버를 재시작해주세요.
                </p>
            </div>
        )
    }

    const KPICard = ({ title, value, unit, color }: { title: string, value?: number, unit: string, color: string }) => {
        const colorClass = {
            emerald: 'text-emerald-400',
            blue: 'text-blue-400',
            amber: 'text-amber-400',
            rose: 'text-rose-400'
        }[color] || 'text-slate-200'

        return (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm flex flex-col justify-between h-32">
                <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className={`text-3xl font-bold ${colorClass}`}>
                        {(value ?? 0).toLocaleString()}
                    </span>
                    <span className="text-slate-500 text-sm">{unit}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">운영 현황 대시보드</h1>
                    <p className="text-slate-400 text-sm mt-1">실시간 스크랩 발생 및 처리 현황을 모니터링합니다.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="이번 달 총 발생량" value={kpi?.totalGeneration} unit="kg" color="emerald" />
                <KPICard title="이번 달 총 매출액" value={kpi?.totalSales} unit="원" color="blue" />
                <KPICard title="현재 보관 재고" value={kpi?.totalStockCount} unit="건" color="amber" />
            </div>

            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
                <h3 className="text-slate-200 text-lg font-bold mb-6">일별 발생량 추이 (최근 30일)</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend}>
                            <defs>
                                <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#e2e8f0', borderRadius: '8px' }}
                                itemStyle={{ color: '#10b981' }}
                                formatter={(value: number) => [`${value.toLocaleString()} kg`, '발생량']}
                            />
                            <Area
                                type="monotone"
                                dataKey="quantity"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorQty)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
