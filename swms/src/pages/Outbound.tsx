import { useEffect, useState } from 'react'
import { TrendingUp, Plus, XCircle, Trash2 } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useSite } from '../contexts/SiteContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface Outbound {
    id: string
    outbound_date: string
    warehouse_name: string
    vendor_name: string
    material_name: string
    quantity: number
    unit_price: number
    total_amount: number
    status: string
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

export default function OutboundPage() {
    const { currentSite } = useSite()
    const { projects } = useProject()
    const { show } = useToast()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<Outbound[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [materials, setMaterials] = useState<MaterialType[]>([])
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)

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
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '출고 데이터를 불러오지 못했습니다.', 'error')
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

    const handleCreate = async (e: React.FormEvent) => {
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
                project_id: form.project_id || null,
                outbound_date: form.outbound_date,
                warehouse_id: form.warehouse_id,
                vendor_id: form.vendor_id || null,
                material_type_id: form.material_type_id,
                quantity: parseFloat(form.quantity),
                unit_price: form.unit_price ? parseFloat(form.unit_price) : 0
            }

            await apiClient.post('/swms/outbounds', payload)
            show('출고가 완료되었습니다. 재고가 차감되었습니다.', 'success')
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '출고 등록 실패', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 재고가 복구됩니다.')) return
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
                    <h1>출고 관리</h1>
                    <p className="muted">{currentSite.name} - 자재 출고(매각/이동) 내역을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> 출고 등록
                </button>
            </header>

            {data.length === 0 ? (
                <section className="empty-state">
                    <TrendingUp size={48} className="empty-icon" />
                    <h3>등록된 출고 내역이 없습니다</h3>
                    <p>우측 상단의 "출고 등록" 버튼을 눌러 첫 출고를 기록하세요.</p>
                </section>
            ) : (
                <div className="table-container no-scrollbar">
                    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>출고일자</th>
                                <th style={{ width: '105px' }}>창고</th>
                                <th style={{ width: '95px', paddingLeft: '1.5rem' }}>품목</th>
                                <th style={{ width: '65px', textAlign: 'right' }}>수량(톤)</th>
                                <th style={{ width: '85px', textAlign: 'right' }}>금액</th>
                                <th style={{ width: '100px' }}>거래처</th>
                                <th style={{ width: '65px', textAlign: 'center' }}>상태</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        {new Date(row.outbound_date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}
                                    </td>
                                    <td>{row.warehouse_name}</td>
                                    <td style={{ paddingLeft: '1.5rem' }}><strong>{row.material_name}</strong></td>
                                    <td style={{ textAlign: 'right' }}><strong>{Number(row.quantity).toLocaleString()}</strong></td>
                                    <td style={{ textAlign: 'right' }}>{Number(row.total_amount).toLocaleString()}</td>
                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.vendor_name || '-'}>{row.vendor_name || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="badge badge-info">{row.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                            <button className="btn-icon" disabled title="수정 (준비중)">
                                                <TrendingUp size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                onClick={() => handleDelete(row.id)}
                                                title="삭제 (재고 복구)"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
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
                            <h2>출고 등록</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <XCircle size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-grid two">
                                    <label>
                                        <span>출고일자 *</span>
                                        <input
                                            type="date"
                                            className="input"
                                            value={form.outbound_date}
                                            onChange={(e) => setForm({ ...form, outbound_date: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label>
                                        <span>현장 (프로젝트)</span>
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
                                        <span>거래처/도착지 (선택)</span>
                                        <select
                                            className="input"
                                            value={form.vendor_id}
                                            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
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
                                        <span>품목 *</span>
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
                                        <span>단가 (원)</span>
                                        <input
                                            type="number"
                                            className="input"
                                            value={form.unit_price}
                                            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                                        />
                                    </label>
                                </div>
                                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                                    * 출고 등록 시 해당 창고의 재고가 즉시 차감됩니다.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                                    취소
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    출고 처리
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
