import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { apiClient } from '../lib/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<'generation' | 'inventory' | 'sales'>('generation')

    const downloadExcel = (data: any[], fileName: string) => {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Report")
        XLSX.writeFile(wb, `${fileName}.xlsx`)
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">분석·리포팅</h1>
                    <p className="text-slate-400 text-sm mt-1">상세 현황 분석 및 경영 리포트를 제공합니다.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'generation' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setActiveTab('generation')}
                    >
                        발생 현황
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'inventory' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setActiveTab('inventory')}
                    >
                        재고 현황
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'sales' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setActiveTab('sales')}
                    >
                        매각/정산
                    </button>
                </div>
            </header>

            {activeTab === 'generation' && <GenerationReport onExport={downloadExcel} />}
            {activeTab === 'inventory' && <InventoryReport onExport={downloadExcel} />}
            {activeTab === 'sales' && <SalesReport onExport={downloadExcel} />}
        </div>
    )
}

function GenerationReport({ onExport }: { onExport: Function }) {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics', 'generation', 'daily'],
        queryFn: async () => (await apiClient.get('/swms/analytics/generation/daily?days=30')).data
    })

    if (isLoading) return <div className="text-slate-400">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={() => onExport(data, 'Generation_Report')} className="btn btn-outline gap-2">
                    <Download size={16} /> 엑셀 다운로드
                </button>
            </div>
            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => value ? value.substring(5) : ''}
                        />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                        <Area type="monotone" dataKey="quantity" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            {/* Table */}
            <div className="table-container max-h-96 overflow-y-auto">
                <table className="table w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-800">
                        <tr>
                            <th className="p-3 border-b border-slate-700 text-slate-400">일자</th>
                            <th className="p-3 border-b border-slate-700 text-slate-400 text-right">발생량 (kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-3 text-slate-300">{item.date}</td>
                                <td className="p-3 text-slate-300 text-right font-mono text-emerald-400">
                                    {(parseFloat(item.quantity) || 0).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function InventoryReport({ onExport }: { onExport: Function }) {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics', 'inventory', 'summary'],
        queryFn: async () => (await apiClient.get('/swms/analytics/inventory/summary')).data
    })

    if (isLoading) return <div className="text-slate-400">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={() => onExport(data, 'Inventory_Report')} className="btn btn-outline gap-2">
                    <Download size={16} /> 엑셀 다운로드
                </button>
            </div>
            <div className="table-container">
                <table className="table w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-3 border-b border-slate-700 text-slate-400">창고명</th>
                            <th className="p-3 border-b border-slate-700 text-slate-400">품목명</th>
                            <th className="p-3 border-b border-slate-700 text-slate-400 text-right">재고량</th>
                            <th className="p-3 border-b border-slate-700 text-slate-400">단위</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-3 text-slate-300">{item.warehouse_name}</td>
                                <td className="p-3 text-slate-300">{item.material_name}</td>
                                <td className="p-3 text-slate-300 text-right font-mono text-amber-400">
                                    {(parseFloat(item.total_quantity) || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-slate-300">{item.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SalesReport({ onExport }: { onExport: Function }) {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics', 'sales', 'monthly'],
        queryFn: async () => (await apiClient.get('/swms/analytics/sales/monthly')).data
    })

    if (isLoading) return <div className="text-slate-400">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={() => onExport(data, 'Sales_Report')} className="btn btn-outline gap-2">
                    <Download size={16} /> 엑셀 다운로드
                </button>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                            formatter={(value: number) => value.toLocaleString()}
                        />
                        <Legend />
                        <Bar dataKey="sales_amount" name="매각 수익" fill="#3b82f6" />
                        <Bar dataKey="disposal_cost" name="처리 비용" fill="#f43f5e" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
