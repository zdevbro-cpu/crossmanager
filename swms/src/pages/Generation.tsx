import { useState, useEffect } from 'react'
import { Plus, Package, Edit2, Trash2, X } from 'lucide-react'
import { useSite } from '../contexts/SiteContext'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import { useToast } from '../components/ToastProvider'
import './Page.css'

interface MaterialType {
    id: string
    code: string
    name: string
    category: string
    unit: string
    unit_price: number
}

interface Generation {
    id: string
    site_id: string
    project_id?: string
    generation_date: string
    material_type_id: string
    material_name: string
    material_category: string
    material_unit: string
    process_name: string
    quantity: number | string
    unit: string
    location: string
    notes: string
    status: string
    created_by: string
    created_at: string
}

export default function GenerationPage() {
    const { currentSite } = useSite()
    const { projects } = useProject()
    const { show } = useToast()
    const [generations, setGenerations] = useState<Generation[]>([])
    const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        generation_date: new Date().toISOString().split('T')[0],
        project_id: '',
        material_type_id: '',
        process_name: '',
        quantity: '',
        location: '',
        notes: ''
    })
    const [filterCategory, setFilterCategory] = useState<string>('ALL')

    useEffect(() => {
        if (currentSite) {
            fetchData()
        }
    }, [currentSite, filterCategory])

    const fetchData = async () => {
        if (!currentSite) return
        setLoading(true)
        try {
            console.log('🔍 Fetching generations data...', { siteId: currentSite.id })
            const [genRes, mtRes] = await Promise.all([
                apiClient.get(`/swms/generations?site_id=${currentSite.id}`),
                apiClient.get('/swms/material-types')
            ])
            console.log('✅ Generations response:', genRes.data.length, 'items')
            setGenerations(genRes.data)
            setMaterialTypes(mtRes.data)
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
        if (!formData.material_type_id || !formData.process_name || !formData.quantity) {
            show('필수 항목을 입력하세요', 'warning')
            return
        }

        try {
            const selectedMaterial = materialTypes.find(mt => mt.id === formData.material_type_id)
            const payload = {
                site_id: currentSite.id,
                project_id: formData.project_id || null,
                generation_date: formData.generation_date,
                material_type_id: formData.material_type_id,
                process_name: formData.process_name,
                quantity: parseFloat(formData.quantity),
                unit: selectedMaterial?.unit || '톤',
                location: formData.location,
                notes: formData.notes,
                created_by: '관리자' // TODO: Get from auth
            }

            if (editingId) {
                await apiClient.put(`/swms/generations/${editingId}`, payload)
                show('발생 정보가 수정되었습니다', 'success')
            } else {
                await apiClient.post('/swms/generations', payload)
                show('발생 정보가 등록되었습니다', 'success')
            }

            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err: any) {
            console.error(err)
            show(err.response?.data?.error || '저장 실패', 'error')
        }
    }

    const handleEdit = (gen: Generation) => {
        setEditingId(gen.id)
        setFormData({
            generation_date: gen.generation_date,
            project_id: gen.project_id || '',
            material_type_id: gen.material_type_id,
            process_name: gen.process_name,
            quantity: gen.quantity.toString(),
            location: gen.location || '',
            notes: gen.notes || ''
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return

        try {
            await apiClient.delete(`/swms/generations/${id}`)
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
            generation_date: new Date().toISOString().split('T')[0],
            project_id: '',
            material_type_id: '',
            process_name: '',
            quantity: '',
            location: '',
            notes: ''
        })
    }

    const openNewModal = () => {
        resetForm()
        setShowModal(true)
    }

    // 통계 계산
    const stats = generations.reduce((acc, gen) => {
        const category = gen.material_category || '기타'
        if (!acc[category]) {
            acc[category] = { count: 0, quantity: 0 }
        }
        acc[category].count++
        acc[category].quantity += Number(gen.quantity) || 0
        return acc
    }, {} as Record<string, { count: number; quantity: number }>)

    // 필터링된 데이터
    const filteredGenerations = filterCategory === 'ALL'
        ? generations
        : generations.filter(g => g.material_category === filterCategory)

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
                    <h1>발생 관리</h1>
                    <p className="muted">{currentSite.name} - 공정별 스크랩 및 폐기물 발생량을 등록하고 관리합니다.</p>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                        * 구분: 고철/폐기물 등 자재 분류 | 공정: 자재가 발생한 작업 단계 (예: 용접, 절단)
                    </p>
                </div>
                <button className="btn-primary" onClick={openNewModal}>
                    <Plus size={18} />
                    발생 등록
                </button>
            </header>

            {/* 통계 카드 */}
            {Object.keys(stats).length > 0 && (
                <div className="grid three" style={{ marginBottom: '1.5rem' }}>
                    {Object.entries(stats).map(([category, data]) => (
                        <div key={category} className="card">
                            <p className="eyebrow">{category}</p>
                            <h3>{Number(data.quantity).toFixed(2)} 톤</h3>
                            <p className="muted">{data.count}건 발생</p>
                        </div>
                    ))}
                </div>
            )}

            {/* 필터 */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button
                    className="pill pill-outline"
                    onClick={() => setFilterCategory('ALL')}
                    style={filterCategory === 'ALL' ? {
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
                    onClick={() => setFilterCategory('스크랩')}
                    style={filterCategory === '스크랩' ? {
                        background: 'rgba(139, 211, 255, 0.18)',
                        color: '#8bd3ff',
                        borderColor: 'rgba(139, 211, 255, 0.5)',
                        borderRadius: '8px'
                    } : { borderRadius: '8px' }}
                >
                    스크랩
                </button>
                <button
                    className="pill pill-outline"
                    onClick={() => setFilterCategory('폐기물')}
                    style={filterCategory === '폐기물' ? {
                        background: 'rgba(139, 211, 255, 0.18)',
                        color: '#8bd3ff',
                        borderColor: 'rgba(139, 211, 255, 0.5)',
                        borderRadius: '8px'
                    } : { borderRadius: '8px' }}
                >
                    폐기물
                </button>
            </div>

            {/* 발생 목록 */}
            {filteredGenerations.length === 0 ? (
                <section className="empty-state">
                    <Package size={48} className="empty-icon" />
                    <h3>등록된 발생 정보가 없습니다</h3>
                    <p>상단의 "발생 등록" 버튼을 클릭하여 첫 발생 정보를 등록하세요.</p>
                </section>
            ) : (
                <div className="table-container no-scrollbar">
                    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '75px' }}>발생일</th>
                                <th style={{ width: '60px' }}>구분</th>
                                <th style={{ width: '90px', paddingLeft: '1.5rem' }}>자재명</th>
                                <th style={{ width: '125px' }}>프로젝트</th>
                                <th style={{ width: '75px' }}>공정</th>
                                <th style={{ width: '60px', textAlign: 'right' }}>발생량(톤)</th>
                                <th style={{ width: '65px' }}>위치</th>
                                <th style={{ width: '75px', textAlign: 'center' }}>상태</th>
                                <th style={{ width: '75px', textAlign: 'center' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGenerations.map((gen) => {
                                const project = projects.find(p => p.id === gen.project_id)
                                return (
                                    <tr key={gen.id}>
                                        <td>{gen.generation_date ? gen.generation_date.split('T')[0] : '-'}</td>
                                        <td>
                                            <strong>{gen.material_category || '-'}</strong>
                                        </td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '1.5rem' }} title={gen.material_name}>
                                            <strong>{gen.material_name}</strong>
                                        </td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project ? project.name : '-'}>
                                            {project ? project.name : '-'}
                                        </td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={gen.process_name}>
                                            {gen.process_name}
                                        </td>
                                        <td style={{ textAlign: 'right' }}><strong>{Number(gen.quantity).toFixed(2)}</strong></td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gen.location || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-info">{gen.status}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button className="btn-icon" onClick={() => handleEdit(gen)} title="수정">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" onClick={() => handleDelete(gen.id)} title="삭제">
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
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '발생 정보 수정' : '발생 정보 등록'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid two">
                                    <label>
                                        <span>발생일 *</span>
                                        <input
                                            type="date"
                                            className="input"
                                            value={formData.generation_date}
                                            onChange={(e) => setFormData({ ...formData, generation_date: e.target.value })}
                                            required
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
                                        <span>현장 (프로젝트)</span>
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
                                        <span>발생 공정 *</span>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="예: 용접, 절단, 조립"
                                            value={formData.process_name}
                                            onChange={(e) => setFormData({ ...formData, process_name: e.target.value })}
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="form-grid two">
                                    <label>
                                        <span>발생량 *</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            placeholder="0.00"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label>
                                        <span>발생 위치</span>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="예: A동 1층, 야적장"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
            )}
        </div>
    )
}
