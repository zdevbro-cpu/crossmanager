import { useEffect, useState } from 'react'
import { Warehouse, XCircle, RotateCcw } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useSite } from '../contexts/SiteContext'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface InventoryItem {
    id: string
    warehouse_name: string
    material_name: string
    material_category: string
    quantity: number
    last_updated_at: string
}

interface WarehouseData {
    id: string
    name: string
}

interface MaterialData {
    id: string
    name: string
}

export default function InventoryPage() {
    const { currentSite } = useSite()
    const { show } = useToast()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<InventoryItem[]>([])

    // Adjustment States
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
    const [materials, setMaterials] = useState<MaterialData[]>([])
    const [form, setForm] = useState({
        adjustment_date: new Date().toISOString().split('T')[0],
        warehouse_id: '',
        material_type_id: '',
        quantity: '', // Delta
        reason: '',
        adjustment_type: 'ADJUSTMENT' // 'ADJUSTMENT' (Check) or 'LOSS'
    })

    const fetchMasterData = async () => {
        if (!currentSite) return
        try {
            const [whRes, mtRes] = await Promise.all([
                apiClient.get(`/swms/sites/${currentSite.id}/warehouses`),
                apiClient.get('/swms/material-types')
            ])
            setWarehouses(whRes.data)
            setMaterials(mtRes.data)
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
            const res = await apiClient.get(`/swms/inventory?${params.toString()}`)
            setData(res.data)
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '재고 데이터를 불러오지 못했습니다.', 'error')
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
            adjustment_date: new Date().toISOString().split('T')[0],
            warehouse_id: '',
            material_type_id: '',
            quantity: '',
            reason: '',
            adjustment_type: 'ADJUSTMENT'
        })
    }

    const handleAdjustment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentSite) return
        if (!form.warehouse_id || !form.material_type_id || !form.quantity) {
            show('필수 항목을 입력해주세요.', 'warning')
            return
        }

        setSaving(true)
        try {
            const payload = {
                site_id: currentSite.id,
                adjustment_date: form.adjustment_date,
                warehouse_id: form.warehouse_id,
                material_type_id: form.material_type_id,
                quantity: parseFloat(form.quantity), // Check if frontend should send Delta or Actual. API expects Delta currently.
                reason: form.reason,
                adjustment_type: form.adjustment_type
            }

            await apiClient.post('/swms/inventory/adjustments', payload)
            show('재고 조정이 반영되었습니다.', 'success')
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '조정 실패', 'error')
        } finally {
            setSaving(false)
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
                    <h1>재고 관리</h1>
                    <p className="muted">{currentSite.name} - 입·출고 확정분을 기반으로 한 실시간 재고 현황입니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <RotateCcw size={18} /> 재고 조정 (실사)
                </button>
            </header>

            {data.length === 0 ? (
                <section className="empty-state">
                    <Warehouse size={48} className="empty-icon" />
                    <h3>재고 데이터가 없습니다</h3>
                    <p>입고/출고 내역이 없거나 재고가 0입니다.</p>
                </section>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: '150px' }}>창고</th>
                                <th style={{ width: '120px' }}>분류</th>
                                <th style={{ width: '200px' }}>품목</th>
                                <th style={{ width: '140px', textAlign: 'right' }}>현재고(톤)</th>
                                <th style={{ width: '160px' }}>최종갱신일</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.warehouse_name}</td>
                                    <td>{row.material_category}</td>
                                    <td>{row.material_name}</td>
                                    <td style={{ textAlign: 'right' }}><strong>{Number(row.quantity).toLocaleString()}</strong></td>
                                    <td>{new Date(row.last_updated_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>재고 조정 (실사)</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <XCircle size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAdjustment}>
                            <div className="modal-body">
                                <div className="form-grid two">
                                    <label>
                                        <span>조정일자 *</span>
                                        <input
                                            type="date"
                                            className="input"
                                            value={form.adjustment_date}
                                            onChange={(e) => setForm({ ...form, adjustment_date: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label>
                                        <span>조정 유형</span>
                                        <select
                                            className="input"
                                            value={form.adjustment_type}
                                            onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}
                                        >
                                            <option value="ADJUSTMENT">일반 조정 (과부족)</option>
                                            <option value="LOSS">망실/손상</option>
                                            <option value="FOUND">발견</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="form-grid two">
                                    <label>
                                        <span>대상 창고 *</span>
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
                                        <span>대상 품목 *</span>
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
                                </div>
                                <label>
                                    <span>조정 수량 (톤) *</span>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            placeholder="+2.0 또는 -1.5"
                                            value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                        * 양수(+)는 재고 증가, 음수(-)는 재고 감소를 의미합니다.
                                    </p>
                                </label>
                                <label>
                                    <span>조정 사유</span>
                                    <textarea
                                        className="input"
                                        rows={3}
                                        value={form.reason}
                                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                        placeholder="예: 정기 재고실사 차이 반영"
                                    />
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                                    취소
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    조정 반영
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
