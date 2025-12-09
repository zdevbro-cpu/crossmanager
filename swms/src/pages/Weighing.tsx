import { useState, useEffect } from 'react'
import { Plus, Scale, Edit2, Trash2, X, TrendingDown, TrendingUp } from 'lucide-react'
import { useSite } from '../contexts/SiteContext'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface MaterialType {
    id: string
    name: string
    category: string
    unit: string
}

interface Vendor {
    id: string
    name: string
    type: string
}

interface Weighing {
    id: string
    site_id: string
    project_id?: string
    weighing_date: string
    weighing_time: string
    vehicle_number: string
    driver_name: string
    driver_contact: string
    material_type_id: string
    material_name: string
    material_category: string
    direction: 'IN' | 'OUT'
    gross_weight: number | string
    tare_weight: number | string
    net_weight: number | string
    unit: string
    vendor_id: string
    vendor_name: string
    vendor_type: string
    notes: string
    created_by: string
    created_at: string
}

export default function WeighingPage() {
    const { currentSite } = useSite()
    const { projects } = useProject()
    const { show } = useToast()
    const [weighings, setWeighings] = useState<Weighing[]>([])
    const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([])
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filterDirection, setFilterDirection] = useState<string>('ALL')
    const [formData, setFormData] = useState({
        weighing_date: new Date().toISOString().split('T')[0],
        weighing_time: new Date().toTimeString().slice(0, 5),
        project_id: '',
        vehicle_number: '',
        driver_name: '',
        driver_contact: '',
        material_type_id: '',
        direction: 'IN' as 'IN' | 'OUT',
        gross_weight: '',
        tare_weight: '',
        vendor_id: '',
        notes: ''
    })

    useEffect(() => {
        if (currentSite) {
            fetchData()
        }
    }, [currentSite, filterDirection])

    const fetchData = async () => {
        if (!currentSite) return
        setLoading(true)
        try {
            console.log('🔍 Fetching weighings data...', { siteId: currentSite.id, filterDirection })
            const params = new URLSearchParams({
                site_id: currentSite.id
            })
            if (filterDirection !== 'ALL') {
                params.append('direction', filterDirection)
            }

            const [weighRes, mtRes, vendorRes] = await Promise.all([
                apiClient.get(`/swms/weighings?${params}`),
                apiClient.get('/swms/material-types'),
                apiClient.get('/swms/vendors')
            ])
            console.log('✅ Weighings response:', weighRes.data.length, 'items')
            setWeighings(weighRes.data)
            setMaterialTypes(mtRes.data)
            setVendors(vendorRes.data)
        } catch (err: any) {
            console.error('❌ Error fetching data:', err)
            show('데이터 로딩 실패', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!currentSite) return
        if (!formData.vehicle_number || !formData.material_type_id || !formData.gross_weight || !formData.tare_weight) {
            show('필수 항목을 입력하세요', 'warning')
            return
        }

        try {
            const payload = {
                site_id: currentSite.id,
                project_id: formData.project_id || null,
                weighing_date: formData.weighing_date,
                weighing_time: formData.weighing_time,
                vehicle_number: formData.vehicle_number,
                driver_name: formData.driver_name,
                driver_contact: formData.driver_contact,
                material_type_id: formData.material_type_id,
                direction: formData.direction,
                gross_weight: parseFloat(formData.gross_weight),
                tare_weight: parseFloat(formData.tare_weight),
                vendor_id: formData.vendor_id || null,
                notes: formData.notes,
                created_by: '계근원'
            }

            if (editingId) {
                await apiClient.put(`/swms/weighings/${editingId}`, payload)
                show('계근 정보가 수정되었습니다', 'success')
            } else {
                await apiClient.post('/swms/weighings', payload)
                show('계근 정보가 등록되었습니다', 'success')
            }

            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '저장 실패', 'error')
        }
    }

    const handleEdit = (weighing: Weighing) => {
        setEditingId(weighing.id)
        setFormData({
            weighing_date: weighing.weighing_date,
            weighing_time: weighing.weighing_time,
            project_id: weighing.project_id || '',
            vehicle_number: weighing.vehicle_number,
            driver_name: weighing.driver_name || '',
            driver_contact: weighing.driver_contact || '',
            material_type_id: weighing.material_type_id,
            direction: weighing.direction,
            gross_weight: weighing.gross_weight.toString(),
            tare_weight: weighing.tare_weight.toString(),
            vendor_id: weighing.vendor_id || '',
            notes: weighing.notes || ''
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return

        try {
            await apiClient.delete(`/swms/weighings/${id}`)
            show('삭제되었습니다', 'success')
            fetchData()
        } catch (err) {
            console.error(err)
            show('삭제 실패', 'error')
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({
            weighing_date: new Date().toISOString().split('T')[0],
            weighing_time: new Date().toTimeString().slice(0, 5),
            project_id: '',
            vehicle_number: '',
            driver_name: '',
            driver_contact: '',
            material_type_id: '',
            direction: 'IN',
            gross_weight: '',
            tare_weight: '',
            vendor_id: '',
            notes: ''
        })
    }

    const openNewModal = () => {
        resetForm()
        setShowModal(true)
    }

    // 통계 계산
    const stats = weighings.reduce((acc, w) => {
        if (!acc[w.direction]) {
            acc[w.direction] = { count: 0, weight: 0 }
        }
        acc[w.direction].count++
        acc[w.direction].weight += Number(w.net_weight) || 0
        return acc
    }, {} as Record<string, { count: number; weight: number }>)

    // 순중량 자동 계산
    const netWeight = (parseFloat(formData.gross_weight) || 0) - (parseFloat(formData.tare_weight) || 0)

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
                    <h1>계근 관리</h1>
                    <p className="muted">{currentSite.name} - 입·출고 차량의 중량을 측정하고 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={openNewModal}>
                    <Plus size={18} />
                    계근 등록
                </button>
            </header>

            {/* 통계 카드 */}
            <div className="grid three" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <TrendingDown size={20} color="#3b82f6" />
                        <p className="eyebrow">입고 (IN)</p>
                    </div>
                    <h3>{Number(stats.IN?.weight || 0).toFixed(2)} 톤</h3>
                    <p className="muted">{stats.IN?.count || 0}건</p>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <TrendingUp size={20} color="#10b981" />
                        <p className="eyebrow">출고 (OUT)</p>
                    </div>
                    <h3>{Number(stats.OUT?.weight || 0).toFixed(2)} 톤</h3>
                    <p className="muted">{stats.OUT?.count || 0}건</p>
                </div>
                <div className="card">
                    <p className="eyebrow">총 계근</p>
                    <h3>{weighings.length}건</h3>
                    <p className="muted">전체 처리 건수</p>
                </div>
            </div>

            {/* 필터 */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button
                    className="pill pill-outline"
                    onClick={() => setFilterDirection('ALL')}
                    style={filterDirection === 'ALL' ? {
                        background: 'rgba(139, 211, 255, 0.18)',
                        color: '#8bd3ff',
                        borderColor: 'rgba(139, 211, 255, 0.5)',
                        borderRadius: '8px'
                    } : { borderRadius: '8px' }}
                >
                    전체
                </button>
                <button
                    className="pill pill-outline"
                    onClick={() => setFilterDirection('IN')}
                    style={filterDirection === 'IN' ? {
                        background: 'rgba(139, 211, 255, 0.18)',
                        color: '#8bd3ff',
                        borderColor: 'rgba(139, 211, 255, 0.5)',
                        borderRadius: '8px'
                    } : { borderRadius: '8px' }}
                >
                    입고
                </button>
                <button
                    className="pill pill-outline"
                    onClick={() => setFilterDirection('OUT')}
                    style={filterDirection === 'OUT' ? {
                        background: 'rgba(139, 211, 255, 0.18)',
                        color: '#8bd3ff',
                        borderColor: 'rgba(139, 211, 255, 0.5)',
                        borderRadius: '8px'
                    } : { borderRadius: '8px' }}
                >
                    출고
                </button>
            </div>

            {/* 계근 목록 */}
            {weighings.length === 0 ? (
                <section className="empty-state">
                    <Scale size={48} className="empty-icon" />
                    <h3>등록된 계근 정보가 없습니다</h3>
                    <p>상단의 "계근 등록" 버튼을 클릭하여 첫 계근 정보를 등록하세요.</p>
                </section>
            ) : (
                <div className="table-container no-scrollbar">
                    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '85px' }}>계근일시</th>
                                <th style={{ width: '50px' }}>구분</th>
                                <th style={{ width: '80px', paddingLeft: '1.5rem' }}>차량번호</th>
                                <th style={{ width: '95px', paddingLeft: '1.5rem' }}>자재명</th>
                                <th style={{ width: '130px' }}>프로젝트</th>
                                <th style={{ width: '60px', textAlign: 'right' }}>총중량(톤)</th>
                                <th style={{ width: '55px', textAlign: 'right' }}>공차(톤)</th>
                                <th style={{ width: '60px', textAlign: 'right' }}>순중량(톤)</th>
                                <th style={{ width: '65px' }}>거래처</th>
                                <th style={{ width: '60px', textAlign: 'center' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weighings.map((w) => {
                                const project = projects.find(p => p.id === w.project_id)
                                return (
                                    <tr key={w.id}>
                                        <td style={{ fontSize: '0.9rem' }}>
                                            {new Date(w.weighing_date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}
                                            <div className="muted">{w.weighing_time?.slice(0, 5) || ''}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${w.direction === 'IN' ? 'badge-info' : 'badge-success'}`}>
                                                {w.direction === 'IN' ? '입고' : '출고'}
                                            </span>
                                        </td>
                                        <td style={{ paddingLeft: '1.5rem' }}><strong>{w.vehicle_number}</strong></td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '1.5rem' }} title={w.material_name}>{w.material_name}</td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project ? project.name : '-'}>{project ? project.name : '-'}</td>
                                        <td style={{ textAlign: 'right' }}><strong>{Number(w.gross_weight).toFixed(2)}</strong></td>
                                        <td style={{ textAlign: 'right' }}>{Number(w.tare_weight).toFixed(2)}</td>
                                        <td style={{ textAlign: 'right' }}><strong>{Number(w.net_weight).toFixed(2)}</strong></td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.vendor_name || '-'}>{w.vendor_name || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button className="btn-icon" onClick={() => handleEdit(w)} title="수정">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" onClick={() => handleDelete(w.id)} title="삭제">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 등록/수정 모달 */}
            {
                showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editingId ? '계근 정보 수정' : '계근 정보 등록'}</h2>
                                <button className="btn-icon" onClick={() => setShowModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="form-grid three">
                                        <label>
                                            <span>계근일 *</span>
                                            <input
                                                type="date"
                                                className="input"
                                                value={formData.weighing_date}
                                                onChange={(e) => setFormData({ ...formData, weighing_date: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            <span>계근시간 *</span>
                                            <input
                                                type="time"
                                                className="input"
                                                value={formData.weighing_time}
                                                onChange={(e) => setFormData({ ...formData, weighing_time: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            <span>구분 *</span>
                                            <select
                                                className="input"
                                                value={formData.direction}
                                                onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'IN' | 'OUT' })}
                                                required
                                            >
                                                <option value="IN">입고</option>
                                                <option value="OUT">출고</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className="form-grid three">
                                        <label>
                                            <span>프로젝트 (선택)</span>
                                            <select
                                                className="input"
                                                value={formData.project_id}
                                                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                            >
                                                <option value="">선택 안 함 (전체/공통)</option>
                                                {projects.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>차량번호 *</span>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="예: 12가3456"
                                                value={formData.vehicle_number}
                                                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            <span>기사명</span>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="기사 이름"
                                                value={formData.driver_name}
                                                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                            />
                                        </label>
                                    </div>

                                    <div className="form-grid two">
                                        <label>
                                            <span>연락처</span>
                                            <input
                                                type="tel"
                                                className="input"
                                                placeholder="010-0000-0000"
                                                value={formData.driver_contact}
                                                onChange={(e) => setFormData({ ...formData, driver_contact: e.target.value })}
                                            />
                                        </label>
                                        <label>
                                            <span>자재 종류 *</span>
                                            <select
                                                className="input"
                                                value={formData.material_type_id}
                                                onChange={(e) => setFormData({ ...formData, material_type_id: e.target.value })}
                                                required
                                            >
                                                <option value="">선택하세요</option>
                                                {materialTypes.map((mt) => (
                                                    <option key={mt.id} value={mt.id}>
                                                        [{mt.category}] {mt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="form-grid two">
                                        <label>
                                            <span>거래처</span>
                                            <select
                                                className="input"
                                                value={formData.vendor_id}
                                                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                            >
                                                <option value="">선택하세요</option>
                                                {vendors.map((v) => (
                                                    <option key={v.id} value={v.id}>
                                                        [{v.type}] {v.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>총중량 (톤) *</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                placeholder="0.00"
                                                value={formData.gross_weight}
                                                onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })}
                                                required
                                            />
                                        </label>
                                    </div>
                                    <div className="form-grid two">
                                        <label>
                                            <span>공차중량 (톤) *</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                placeholder="0.00"
                                                value={formData.tare_weight}
                                                onChange={(e) => setFormData({ ...formData, tare_weight: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            <span>순중량 (톤)</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                value={netWeight.toFixed(2)}
                                                disabled
                                                style={{ background: 'var(--bg-surface)', fontWeight: 'bold' }}
                                            />
                                        </label>
                                    </div>

                                    <label>
                                        <span>비고</span>
                                        <textarea
                                            className="input"
                                            rows={3}
                                            placeholder="추가 메모사항"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                        취소
                                    </button>
                                    <button type="submit" className="btn-primary">
                                        {editingId ? '수정' : '등록'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
