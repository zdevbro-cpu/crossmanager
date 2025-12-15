import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { apiClient } from '../../lib/api'
import { formatCurrency } from './format'

interface MarketPriceRow {
    date: string
    symbol: string
    source: string
    usdPerTon: number
    fxUsdKrw: number
    krwPerTon: number
}

const COMMODITIES = [
    { symbol: 'CU', name: '구리 (Copper)' },
    { symbol: 'AL', name: '알루미늄 (Aluminum)' },
    { symbol: 'ZN', name: '아연 (Zinc)' },
    { symbol: 'SN', name: '주석 (Tin)' },
]

const CURRENCIES = [
    { value: 'KRW', label: '원(KRW) / 톤', formatter: (v: number) => formatCurrency(v) },
    { value: 'USD', label: '달러(USD) / 톤', formatter: (v: number) => `$${v.toLocaleString()}` },
]

export default function MarketTrendChart(props: { height?: number; forcedSymbol?: string }) {
    const [localSymbol] = useState('CU')
    const [selectedCurrency, setSelectedCurrency] = useState('KRW')
    const days = 30

    // If forcedSymbol is provided by parent, use it; otherwise use local state
    const effectiveSymbol = props.forcedSymbol || localSymbol

    const q = useQuery<MarketPriceRow[]>({
        queryKey: ['swms-market', 'prices', effectiveSymbol, days],
        queryFn: async () => {
            const res = await apiClient.get('/swms/market/prices', {
                params: { symbols: effectiveSymbol, days },
            })
            return res.data
        },
        retry: 1,
    })

    // Group data by date if we were showing multiple lines, but here we show one symbol's history
    const data = q.data || []
    const currentCurrency = CURRENCIES.find(c => c.value === selectedCurrency) || CURRENCIES[0]

    // Find name for display
    const effectiveName = COMMODITIES.find(c => c.symbol === effectiveSymbol)?.name || effectiveSymbol

    return (
        <section className="dash-card">
            <div className="dash-card__header">
                <div>
                    <h3 className="dash-card__title">국제 금속 시세 ({effectiveName})</h3>
                    <div className="dash-card__hint">LME 30일 가격 추이</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                        className="input input--sm"
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                    >
                        {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ height: props.height ?? 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={props.height ?? 260}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9fb2cc" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
                        <YAxis
                            stroke="#9fb2cc"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => selectedCurrency === 'KRW' ? (val / 10000).toLocaleString() + '만' : val.toLocaleString()}
                            width={60}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(10,16,32,0.95)',
                                borderColor: 'rgba(255,255,255,0.10)',
                                borderRadius: '12px',
                            }}
                            formatter={(v: number, _name: string) => [
                                `${v.toLocaleString()} ${selectedCurrency === 'KRW' ? '원' : '$'}`,
                                undefined
                            ]}
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey={selectedCurrency === 'KRW' ? 'krwPerTon' : 'usdPerTon'}
                            stroke="#f59e0b"
                            strokeWidth={3}
                            dot={false}
                            name={currentCurrency.label}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}
