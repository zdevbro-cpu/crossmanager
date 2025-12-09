import { useEffect, useState } from 'react'
import { Wallet, Plus, XCircle, Trash2, Edit, Check, X } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useSite } from '../contexts/SiteContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface Disposal {
    id: string
    outbound_date: string
    warehouse_name: string
    vendor_name: string
    material_name: string
    quantity: number
    unit_price: number
    total_amount: number
    status: string
    project_id?: string
}

interface Warehouse {
    id: string
    name: string
}

interface MaterialType {
    id: string
    name: string
    unit: string
}

interface Vendor {
    id: string
    name: string
}

export default function SalesPage() {
    const { currentSite } = useSite()
    const { projects } = useProject()
    const { show } = useToast()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<Disposal[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [materials, setMaterials] = useState<MaterialType[]>([])
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)

    // Summary Statistics
    const [stats, setStats] = useState({
        totalCount: 0,
        totalWeight: 0,
        totalAmount: 0
    })

    const [form, setForm] = useState({
        outbound_date: new Date().toISOString().split('T')[0],
        project_id: '',
        warehouse_id: '',
        vendor_id: '',
        material_type_id: '',
        quantity: '',
        unit_price: ''
    })

    const fetchMasterData = async () => {
        if (!currentSite) return
        try {
            const [whRes, mtRes, vendorRes] = await Promise.all([
                apiClient.get(`/swms/sites/${currentSite.id}/warehouses`),
                apiClient.get('/swms/material-types'),
                apiClient.get('/swms/vendors')
            ])
            setWarehouses(whRes.data)
            setMaterials(mtRes.data)
            setVendors(vendorRes.data)
        } catch (err) {
            console.error(err)
        }
    }

    const fetchData = async () => {
        if (!currentSite) return
        setLoading(true)
        try {
            const params = new URLSearchParams({
                site_id: currentSite.id
            })
            const res = await apiClient.get(`/swms/outbounds?${params.toString()}`)
            setData(res.data)

            // Calculate stats (Exclude REJECTED)
            const validData = res.data.filter((d: Disposal) => d.status !== 'REJECTED')
            const totalCount = validData.length
            const totalWeight = validData.reduce((acc: number, curr: Disposal) => acc + Number(curr.quantity || 0), 0)
            const totalAmount = validData.reduce((acc: number, curr: Disposal) => acc + Number(curr.total_amount || 0), 0)
            setStats({ totalCount, totalWeight, totalAmount })

        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '매각 데이터를 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (currentSite) {
            fetchMasterData()
            fetchData()
        }
    }, [currentSite])

    const resetForm = () => {
        setForm({
            outbound_date: new Date().toISOString().split('T')[0],
            project_id: '',
            warehouse_id: '',
            vendor_id: '',
            material_type_id: '',
            quantity: '',
            unit_price: ''
        })
    }

    // Standard Price Fetch (England LME or similar) - Placeholder
    const fetchStandardPrice = async () => {
        if (!form.material_type_id) {
            show('자재(품목)를 먼서 선택해주세요.', 'warning')
            return
        }
        show('영국 금속거래소(LME) 표준 단가를 조회합니다... (Simulated)', 'info')
        setTimeout(() => {
            const mockPrice = 250000 + Math.floor(Math.random() * 20000) - 10000
            setForm(prev => ({ ...prev, unit_price: String(mockPrice) }))
            show(`표준 단가 적용 완료: ${mockPrice.toLocaleString()}원`, 'success')
        }, 1000)
    }

    const handleEdit = (row: Disposal) => {
        if (row.status !== 'PENDING') {
            show('승인대기 상태인 항목만 수정할 수 있습니다.', 'warning')
            return
        }
        setForm({
            outbound_date: row.outbound_date.split('T')[0],
            project_id: row.project_id || '',
            warehouse_id: '',
            vendor_id: (row as any).vendor_id || '',
            material_type_id: (row as any).material_type_id || '',
            quantity: String(row.quantity),
            unit_price: String(row.unit_price)
        })
        setShowModal(true)
        show('수정을 위해 데이터를 불러왔습니다. (현재는 신규 등록으로 처리됩니다)', 'info')
    }

    const handleApprove = async (id: string) => {
        if (!confirm('매각을 승인하시겠습니까? 관련 재고가 차감됩니다.')) return
        try {
            await apiClient.post(`/swms/outbounds/${id}/approve`)
            show('매각이 승인되었습니다.', 'success')
            fetchData()
        } catch (err: any) {
            console.error(err)
            show('승인 실패', 'error')
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm('매각을 반려하시겠습니까?')) return
        try {
            await apiClient.post(`/swms/outbounds/${id}/reject`)
            show('매각이 반려되었습니다.', 'success')
            fetchData()
        } catch (err: any) {
            console.error(err)
            show('반려 실패', 'error')
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentSite) return
        if (!form.warehouse_id || !form.material_type_id || !form.quantity || !form.unit_price) {
            show('필수 항목을 입력해주세요. (단가 포함)', 'warning')
            return
        }

        setSaving(true)
        try {
            const payload = {
                site_id: currentSite.id,
                project_id: form.project_id || null,
                outbound_date: form.outbound_date,
                warehouse_id: form.warehouse_id,
                vendor_id: form.vendor_id || null,
                material_type_id: form.material_type_id,
                quantity: parseFloat(form.quantity),
                unit_price: parseFloat(form.unit_price)
            }

            await apiClient.post('/swms/outbounds', payload)
            show('매각 요청이 등록되었습니다. 승인 대기 상태입니다.', 'success')
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '매각 등록 실패', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return
        try {
            await apiClient.delete(`/swms/outbounds/${id}`)
            show('삭제되었습니다.', 'success')
            fetchData()
        } catch (err: any) {
            console.error(err)
            show('삭제 실패', 'error')
        }
    }

    if (!currentSite) {
        return <div className="page"><div className="spinner-wrap">사이트를 선택해주세요.</div></div>
    }

    if (loading) {
        return <div className="page"><div className="spinner-wrap"><div className="spinner" /><span>로딩 중...</span></div></div>
    }

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <p className="eyebrow">SWMS Module</p>
                    <h1>매각 관리</h1>
                    <p className="muted">{currentSite.name} - 스크랩 및 폐자원 매각 내역을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> 매각 등록
                </button>
            </header>

            {/* 통계 카드 */}
            <div className="grid three" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                    <p className="eyebrow">총 매각 금액 (승인)</p>
                    <h3 style={{ color: '#10b981' }}>{stats.totalAmount.toLocaleString()} 원</h3>
                    <p className="muted">누적 매각 수익</p>
                </div>
                <div className="card">
                    <p className="eyebrow">총 매각 중량 (승인)</p>
                    <h3>{stats.totalWeight.toFixed(2)} 톤</h3>
                    <p className="muted">누적 반출량</p>
                </div>
                <div className="card">
                    <p className="eyebrow">매각 건수 (전체)</p>
                    <h3>{stats.totalCount} 건</h3>
                    <p className="muted">유효 매각 건수</p>
                </div>
            </div>

            {data.length === 0 ? (
                <section className="empty-state">
                    <Wallet size={48} className="empty-icon" />
                    <h3>등록된 매각 내역이 없습니다</h3>
                    <p>우측 상단의 "매각 등록" 버튼을 눌러 수익을 기록하세요.</p>
                </section>
            ) : (
                <div className="table-container no-scrollbar">
                    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '100px' }}>매각일자</th>
                                <th style={{ width: '180px' }}>프로젝트</th>
                                <th style={{ width: '100px', paddingLeft: '1.5rem' }}>자재명</th>
                                <th style={{ width: '100px' }}>거래처</th>
                                <th style={{ width: '70px', textAlign: 'right' }}>수량(톤)</th>
                                <th style={{ width: '90px', textAlign: 'right' }}>단가</th>
                                <th style={{ width: '100px', textAlign: 'right' }}>총액</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>상태</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row) => {
                                const project = projects.find(p => p.id === row.project_id)
                                let statusBadge = <span className="badge badge-success">매각완료</span>
                                if (row.status === 'PENDING') statusBadge = <span className="badge badge-warning">승인대기</span>
                                else if (row.status === 'REJECTED') statusBadge = <span className="badge badge-danger">반려됨</span>
                                else if (row.status === 'SHIPPED') statusBadge = <span className="badge badge-success">매각완료</span> // Old data compatibility

                                return (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {new Date(row.outbound_date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}
                                        </td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project ? project.name : '-'}>
                                            {project ? project.name : '-'}
                                        </td>
                                        <td style={{ paddingLeft: '1.5rem' }}><strong>{row.material_name}</strong></td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.vendor_name || '-'}>{row.vendor_name || '-'}</td>
                                        <td style={{ textAlign: 'right' }}><strong>{Number(row.quantity).toLocaleString()}</strong></td>
                                        <td style={{ textAlign: 'right' }} className="muted">{Number(row.unit_price).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{Number(row.total_amount).toLocaleString()}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {statusBadge}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                {row.status === 'PENDING' ? (
                                                    <>
                                                        <button
                                                            className="btn-icon"
                                                            style={{ color: '#10b981' }}
                                                            onClick={() => handleApprove(row.id)}
                                                            title="승인"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            style={{ color: '#ef4444' }}
                                                            onClick={() => handleReject(row.id)}
                                                            title="반려"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleEdit(row)}
                                                            title="수정"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="btn-icon btn-danger"
                                                        onClick={() => handleDelete(row.id)}
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>매각 등록</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <XCircle size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-grid two">
                                    <label>
                                        <span>매각일자 *</span>
                                        <input
                                            type="date"
                                            className="input"
                                            value={form.outbound_date}
                                            onChange={(e) => setForm({ ...form, outbound_date: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label>
                                        <span>프로젝트 (선택)</span>
                                        <select
                                            className="input"
                                            value={form.project_id}
                                            onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                                        >
                                            <option value="">전체/공통</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <div className="form-grid two">
                                    <label>
                                        <span>출고 창고 *</span>
                                        <select
                                            className="input"
                                            value={form.warehouse_id}
                                            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                                            required
                                        >
                                            <option value="">창고 선택</option>
                                            {warehouses.map((w) => (
                                                <option key={w.id} value={w.id}>{w.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>매입 거래처 *</span>
                                        <select
                                            className="input"
                                            value={form.vendor_id}
                                            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                                            required
                                        >
                                            <option value="">거래처 선택</option>
                                            {vendors.map((v) => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <div className="form-grid three">
                                    <label>
                                        <span>품목 (자재) *</span>
                                        <select
                                            className="input"
                                            value={form.material_type_id}
                                            onChange={(e) => setForm({ ...form, material_type_id: e.target.value })}
                                            required
                                        >
                                            <option value="">품목 선택</option>
                                            {materials.map((m) => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>수량(톤) *</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            <span>단가 (원) *</span>
                                            <button
                                                type="button"
                                                className="btn-xs"
                                                onClick={fetchStandardPrice}
                                                style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                🇬🇧 LME 시세 조회
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            className="input"
                                            value={form.unit_price}
                                            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                                            required
                                            placeholder="톤당 단가"
                                        />
                                    </label>
                                </div>
                                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                                    * 매각 요청 등록 시 승인 대기 상태가 되며, 승인 완료 시 재고가 차감됩니다.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                                    취소
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    매각 요청
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
