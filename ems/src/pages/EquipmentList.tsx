import './Page.css'
import './EMS.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { Plus, Search, Filter, Edit, Trash2 } from 'lucide-react'

interface Equipment {
    id: string
    equipment_id: string
    name: string
    category: string
    manufacturer: string
    equipment_status: string
    assigned_site: string
    created_at: string
}

function EquipmentListPage() {
    const { show } = useToast()
    const navigate = useNavigate()
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => {
        fetchEquipment()
    }, [])

    const fetchEquipment = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/equipment')
            if (res.ok) {
                const data = await res.json()
                setEquipment(data)
            }
        } catch (err) {
            console.error(err)
            show('장비 목록을 불러오는데 실패했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }

    const filteredEquipment = equipment.filter(eq => {
        const matchesSearch =
            eq.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.equipment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.category?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesFilter = filterStatus === 'all' || eq.equipment_status === filterStatus

        return matchesSearch && matchesFilter
    })

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`"${name}" 장비를 삭제하시겠습니까?`)) return

        try {
            const res = await fetch(`http://localhost:3000/api/equipment/${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                show('장비가 삭제되었습니다.', 'success')
                fetchEquipment()
            } else {
                show('삭제에 실패했습니다.', 'error')
            }
        } catch (err) {
            console.error(err)
            show('삭제 중 오류가 발생했습니다.', 'error')
        }
    }

    return (
        <div className="page">
            {/* Page Title */}
            <div style={{ marginBottom: '1.5rem' }}>
                <p className="eyebrow">Equipment Management System</p>
                <h2 style={{ margin: '0.25rem 0 0.5rem' }}>장비 목록</h2>
                <p className="muted">건설 장비의 전체 생명주기를 관리합니다.</p>
            </div>

            {/* Search & Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={18} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8', zIndex: 1 }} />
                        <input
                            type="text"
                            className="input-std"
                            placeholder="장비명, ID, 종류로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                paddingLeft: '2.5rem',
                                paddingRight: '0.7rem',
                                width: '100%',
                                height: '42px',
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Filter size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        <select
                            className="input-std"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{
                                minWidth: '150px',
                                height: '42px',
                                boxSizing: 'border-box',
                                padding: '0 0.7rem'
                            }}
                        >
                            <option value="all">전체 상태</option>
                            <option value="신품">신품</option>
                            <option value="중고">중고</option>
                            <option value="정비중">정비중</option>
                            <option value="폐기">폐기</option>
                        </select>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/equipment/new')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0 1rem',
                            height: '42px',
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}
                    >
                        <Plus size={18} />
                        신규 장비 등록
                    </button>
                </div>
            </div>

            {/* Equipment List */}
            <div className="card table-card">
                <div className="table-head">
                    <p className="card-label">장비 목록 ({filteredEquipment.length})</p>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        불러오는 중...
                    </div>
                ) : filteredEquipment.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        {searchTerm || filterStatus !== 'all' ? '검색 결과가 없습니다.' : '등록된 장비가 없습니다.'}
                    </div>
                ) : (
                    <div className="table">
                        <div className="table-row table-header" style={{ gridTemplateColumns: '1fr 1.5fr 0.7fr 0.7fr 0.7fr 1.5fr 100px' }}>
                            <span>장비 ID</span>
                            <span>장비명</span>
                            <span>종류</span>
                            <span>제조사</span>
                            <span>상태</span>
                            <span>배치 현장</span>
                            <span style={{ textAlign: 'center' }}>관리</span>
                        </div>
                        {filteredEquipment.map((eq) => (
                            <div
                                key={eq.id}
                                className="table-row"
                                style={{ gridTemplateColumns: '1fr 1.5fr 0.7fr 0.7fr 0.7fr 1.5fr 100px' }}
                            >
                                <span style={{ color: '#8bd3ff', fontWeight: 500 }}>{eq.equipment_id || '-'}</span>
                                <span style={{ fontWeight: 500 }}>{eq.name}</span>
                                <span>{eq.category || '-'}</span>
                                <span>{eq.manufacturer || '-'}</span>
                                <span>
                                    <span className={`badge ${eq.equipment_status === '신품' ? 'badge-live' :
                                        eq.equipment_status === '중고' ? 'badge-warning' :
                                            eq.equipment_status === '정비중' ? 'badge-alert' :
                                                'badge-outline'
                                        }`}>
                                        {eq.equipment_status || '미지정'}
                                    </span>
                                </span>
                                <span style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }} title={eq.assigned_site || '-'}>
                                    {eq.assigned_site || '-'}
                                </span>
                                <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/equipment/${eq.id}`)
                                        }}
                                        style={{
                                            padding: '0.5rem',
                                            background: 'transparent',
                                            border: '1px solid #334155',
                                            borderRadius: '6px',
                                            color: '#3b82f6',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="상세보기/수정"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(eq.id, eq.name)
                                        }}
                                        style={{
                                            padding: '0.5rem',
                                            background: 'transparent',
                                            border: '1px solid #334155',
                                            borderRadius: '6px',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="삭제"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default EquipmentListPage
