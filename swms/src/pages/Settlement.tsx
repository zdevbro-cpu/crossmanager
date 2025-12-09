import { useEffect, useState } from 'react'
import { FileText, Plus, XCircle, Check, Search, Trash2 } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useSite } from '../contexts/SiteContext'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface Settlement {
    id: string
    vendor_name: string
    settlement_date: string
    start_date: string
    end_date: string
    total_amount: number
    total_supply_price: number
    total_vat: number
    status: string
    created_at: string
    tax_invoice_no?: string
    tax_invoice_status?: string
}

interface SettlementDetail extends Settlement {
    items: Outbound[]
}

interface Vendor {
    id: string
    name: string
}

interface Outbound {
    id: string
    outbound_date: string
    material_name: string
    quantity: number
    unit_price: number
    total_amount: number
    warehouse_name: string
}

export default function SettlementPage() {
    const { currentSite } = useSite()
    const { show } = useToast()
    const [loading, setLoading] = useState(true)
    const [settlements, setSettlements] = useState<Settlement[]>([])

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [step, setStep] = useState(1)
    const [selectedVendor, setSelectedVendor] = useState('')
    const [period, setPeriod] = useState({ start: '', end: '' })
    const [candidates, setCandidates] = useState<Outbound[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [creating, setCreating] = useState(false)

    // Detail Modal State
    const [detail, setDetail] = useState<SettlementDetail | null>(null)

    // Fetch Base Data
    const fetchSettlements = async () => {
        if (!currentSite) return
        setLoading(true)
        try {
            const res = await apiClient.get(`/swms/settlements?site_id=${currentSite.id}`)
            setSettlements(res.data)
        } catch (err: any) {
            console.error(err)
            show('정산 내역을 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }

    const fetchVendors = async () => {
        if (!currentSite) return
        try {
            const res = await apiClient.get('/swms/vendors')
            setVendors(res.data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        if (currentSite) {
            fetchSettlements()
            fetchVendors()
        }
    }, [currentSite])

    // --- Create Flow ---
    const fetchCandidates = async () => {
        if (!currentSite || !selectedVendor) return
        try {
            const p = new URLSearchParams({
                site_id: currentSite.id,
                vendor_id: selectedVendor,
                start_date: period.start,
                end_date: period.end
            })
            const res = await apiClient.get(`/swms/settlements/candidates?${p.toString()}`)
            setCandidates(res.data)
            setSelectedIds(res.data.map((d: any) => d.id))
            if (res.data.length > 0) setStep(2)
            else show('정산 가능한 매각 내역이 없습니다.', 'info')
        } catch (err) {
            console.error(err)
            show('매각 내역 조회 실패', 'error')
        }
    }

    const handleCreate = async () => {
        if (!currentSite || selectedIds.length === 0) return
        setCreating(true)
        try {
            await apiClient.post('/swms/settlements', {
                site_id: currentSite.id,
                vendor_id: selectedVendor,
                start_date: period.start,
                end_date: period.end,
                outbound_ids: selectedIds
            })
            show('정산서가 생성되었습니다.', 'success')
            setShowCreateModal(false)
            resetCreateModal()
            fetchSettlements()
        } catch (err: any) {
            console.error(err)
            show('정산 생성 실패', 'error')
        } finally {
            setCreating(false)
        }
    }

    const resetCreateModal = () => {
        setStep(1)
        setSelectedVendor('')
        setPeriod({ start: '', end: '' })
        setCandidates([])
        setSelectedIds([])
    }

    // --- Detail Flow ---
    const openDetail = async (id: string) => {
        try {
            const res = await apiClient.get(`/swms/settlements/${id}`)
            setDetail(res.data)
        } catch (err) {
            console.error(err)
            show('상세 정보를 불러오지 못했습니다.', 'error')
        }
    }

    const handleConfirm = async (id: string, fromDetail = false) => {
        if (!confirm('정산을 확정하시겠습니까? 세금계산서가 자동으로 발행됩니다.')) return
        try {
            await apiClient.post(`/swms/settlements/${id}/confirm`)
            show('정산이 확정되었습니다.', 'success')
            fetchSettlements()
            if (fromDetail) setDetail(null)
        } catch (err) {
            console.error(err)
            show('정산 확정 실패', 'error')
        }
    }

    const handleDelete = async (id: string, fromDetail = false) => {
        if (!confirm('정만 정산서를 삭제하시겠습니까? (매각 내역은 삭제되지 않고 미정산 상태로 돌아갑니다)')) return
        try {
            await apiClient.delete(`/swms/settlements/${id}`)
            show('삭제되었습니다.', 'success')
            fetchSettlements()
            if (fromDetail) setDetail(null)
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '삭제 실패', 'error')
        }
    }

    // --- Formatters ---
    const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')
    const formatMoney = (n: number) => n.toLocaleString()
    const getSettlementNo = (s: Settlement) => {
        // Pseudo logic: SET-YYYYMMDD-XXXX
        const datePart = new Date(s.settlement_date).toISOString().split('T')[0].replace(/-/g, '')
        const idPart = s.id.substring(0, 4).toUpperCase()
        return `SET-${datePart}-${idPart}`
    }

    if (loading && !showCreateModal && !detail) return <div className="page"><div className="spinner-wrap">로딩 중...</div></div>

    // Calculations for Create Modal Summary
    const createSelectedItems = candidates.filter(c => selectedIds.includes(c.id))
    const createSumSupply = createSelectedItems.reduce((acc, curr) => acc + Number(curr.total_amount), 0)
    const createSumVat = Math.floor(createSumSupply * 0.1)
    const createSumTotal = createSumSupply + createSumVat

    return (
        <div className="page">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                }
            `}</style>
            <header className="page-header">
                <div>
                    <p className="eyebrow">SWMS Module</p>
                    <h1>정산 관리</h1>
                    <p className="muted">매각 확정 건에 대한 월별/기간별 정산서를 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} /> 정산 생성
                </button>
            </header>

            {settlements.length === 0 ? (
                <section className="empty-state">
                    <FileText size={48} className="empty-icon" />
                    <h3>생성된 정산 내역이 없습니다</h3>
                    <p>우측 상단의 "정산 생성" 버튼을 눌러 정산을 시작하세요.</p>
                </section>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>정산번호</th>
                                <th>거래처</th>
                                <th>정산기간</th>
                                <th style={{ textAlign: 'right' }}>공급가액</th>
                                <th style={{ textAlign: 'right' }}>부가세</th>
                                <th style={{ textAlign: 'right' }}>합계금액</th>
                                <th style={{ textAlign: 'center' }}>상태</th>
                                <th style={{ textAlign: 'center' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 500, color: '#64748b' }}>
                                        {getSettlementNo(s)}
                                    </td>
                                    <td><strong>{s.vendor_name}</strong></td>
                                    <td>
                                        {formatDate(s.start_date)} ~ {formatDate(s.end_date)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatMoney(Number(s.total_supply_price))}</td>
                                    <td style={{ textAlign: 'right' }}>{formatMoney(Number(s.total_vat))}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(Number(s.total_amount))}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`badge ${s.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`}>
                                            {s.status === 'CONFIRMED' ? '확정됨' : '작성중'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                            <button
                                                className="btn-icon"
                                                onClick={() => openDetail(s.id)}
                                                title="상세보기"
                                            >
                                                <Search size={16} />
                                            </button>

                                            {s.status === 'DRAFT' && (
                                                <>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ color: '#10b981' }}
                                                        onClick={() => handleConfirm(s.id)}
                                                        title="확정"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-danger"
                                                        onClick={() => handleDelete(s.id)}
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => { setShowCreateModal(false); resetCreateModal() }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="modal-header">
                            <h2>정산서 생성 {step === 2 && '(2/2)'}</h2>
                            <button className="btn-icon" onClick={() => { setShowCreateModal(false); resetCreateModal() }}>
                                <XCircle size={18} />
                            </button>
                        </div>

                        {step === 1 ? (
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>거래처 선택</label>
                                    <select
                                        className="input"
                                        value={selectedVendor}
                                        onChange={e => setSelectedVendor(e.target.value)}
                                    >
                                        <option value="">선택해주세요</option>
                                        {vendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-grid two">
                                    <div className="form-group">
                                        <label>시작일 (선택)</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={period.start}
                                            onChange={e => setPeriod({ ...period, start: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>종료일 (선택)</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={period.end}
                                            onChange={e => setPeriod({ ...period, end: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn-primary" disabled={!selectedVendor} onClick={fetchCandidates}>
                                        <Search size={16} /> 대상 조회
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="modal-body">
                                <div className="summary-box" style={{ background: '#1e293b', border: '1px solid #334155', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', color: '#e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>선택 건수:</span>
                                        <strong>{selectedIds.length} 건</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>
                                        <span>예상 정산금액(VAT포함):</span>
                                        <span>{formatMoney(createSumTotal)} 원</span>
                                    </div>
                                </div>

                                <div className="list-wrap custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                                    <table className="table" style={{ fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '30px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.length === candidates.length}
                                                        onChange={e => {
                                                            if (e.target.checked) setSelectedIds(candidates.map(c => c.id))
                                                            else setSelectedIds([])
                                                        }}
                                                    />
                                                </th>
                                                <th>일자</th>
                                                <th>품목</th>
                                                <th style={{ textAlign: 'right' }}>금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidates.map(c => (
                                                <tr key={c.id} onClick={() => {
                                                    if (selectedIds.includes(c.id)) setSelectedIds(selectedIds.filter(id => id !== c.id))
                                                    else setSelectedIds([...selectedIds, c.id])
                                                }} style={{ cursor: 'pointer' }}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(c.id)}
                                                            readOnly
                                                        />
                                                    </td>
                                                    <td>{formatDate(c.outbound_date)}</td>
                                                    <td>{c.material_name} ({c.quantity}t)</td>
                                                    <td style={{ textAlign: 'right' }}>{formatMoney(Number(c.total_amount))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="modal-footer" style={{ marginTop: '1rem' }}>
                                    <button className="btn-secondary" onClick={() => setStep(1)}>이전</button>
                                    <button className="btn-primary" onClick={handleCreate} disabled={selectedIds.length === 0 || creating}>
                                        {creating ? '생성 중...' : '정산서 생성'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {detail && (
                <div className="modal-overlay" onClick={() => setDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <span className={`badge ${detail.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`} style={{ marginBottom: '0.5rem' }}>
                                    {detail.status === 'CONFIRMED' ? '확정됨' : '작성중'}
                                </span>
                                <h2>{getSettlementNo(detail)}</h2>
                                <p className="muted" style={{ margin: 0 }}>
                                    {detail.vendor_name} | {formatDate(detail.start_date)} ~ {formatDate(detail.end_date)}
                                </p>
                                {detail.tax_invoice_no && (
                                    <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Check size={12} /> 세금계산서 발행완료: {detail.tax_invoice_no}
                                    </div>
                                )}
                            </div>
                            <button className="btn-icon" onClick={() => setDetail(null)}>
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <h4 style={{ marginBottom: '0.5rem', marginTop: 0 }}>정산 상세 내역</h4>
                            <div className="list-wrap custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px', marginBottom: '1.5rem' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>일자</th>
                                            <th>품목</th>
                                            <th>창고</th>
                                            <th style={{ textAlign: 'right' }}>수량</th>
                                            <th style={{ textAlign: 'right' }}>단가</th>
                                            <th style={{ textAlign: 'right' }}>공급가액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.items.map(item => (
                                            <tr key={item.id}>
                                                <td>{formatDate(item.outbound_date)}</td>
                                                <td><strong>{item.material_name}</strong></td>
                                                <td className="muted">{item.warehouse_name}</td>
                                                <td style={{ textAlign: 'right' }}>{Number(item.quantity).toLocaleString()}</td>
                                                <td style={{ textAlign: 'right' }}>{Number(item.unit_price).toLocaleString()}</td>
                                                <td style={{ textAlign: 'right' }}>{Number(item.total_amount).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid three" style={{ background: '#1e293b', border: '1px solid #334155', padding: '1rem', borderRadius: '8px', color: '#e2e8f0' }}>
                                <div style={{ borderRight: '1px solid #334155', paddingRight: '1rem' }}>
                                    <p className="eyebrow" style={{ color: '#94a3b8' }}>공급가액</p>
                                    <h3>{formatMoney(Number(detail.total_supply_price))}</h3>
                                </div>
                                <div style={{ paddingLeft: '1rem' }}>
                                    <p className="eyebrow" style={{ color: '#94a3b8' }}>부가세 (10%)</p>
                                    <h3>{formatMoney(Number(detail.total_vat))}</h3>
                                </div>
                                <div style={{ borderLeft: '1px solid #334155', paddingLeft: '1rem' }}>
                                    <p className="eyebrow" style={{ color: '#94a3b8' }}>합계 금액</p>
                                    <h2 style={{ color: '#38bdf8' }}>{formatMoney(Number(detail.total_amount))} 원</h2>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            {detail.status === 'DRAFT' && (
                                <>
                                    <button className="btn-secondary btn-danger" onClick={() => handleDelete(detail.id, true)}>
                                        <Trash2 size={16} /> 정산 삭제
                                    </button>
                                    <button className="btn-primary" onClick={() => handleConfirm(detail.id, true)}>
                                        <Check size={16} /> 정산 확정
                                    </button>
                                </>
                            )}
                            {detail.status === 'CONFIRMED' && (
                                <button className="btn-secondary" onClick={() => setDetail(null)}>
                                    닫기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
