import { useState } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import './Page.css' // Reuse existing page styles


// Check Item Interface
interface ChecklistItem {
    id: string
    content: string
}

// Template Interface
interface ChecklistTemplate {
    id: string
    title: string
    items: ChecklistItem[]
    category?: string
    updatedAt: string
}

// Initial Mock Data (Moved from SMS)
const INITIAL_TEMPLATES: ChecklistTemplate[] = [
    {
        id: 'TPL001',
        title: '고소작업차 작업 전 점검',
        items: [
            { id: '1', content: '아우트리거 설치 및 지반 상태 확인' },
            { id: '2', content: '작업대 난간 및 안전장치 작동 여부확인' },
            { id: '3', content: '안전대 부착설비 상태 및 체결 확인' },
            { id: '4', content: '신호수 배치 및 작업 반경 통제' },
            { id: '5', content: '작업자 안전모 및 보호구 착용 상태' }
        ],
        updatedAt: '2023-10-01'
    },
    {
        id: 'TPL002',
        title: '굴착기 작업 안전 점검',
        items: [
            { id: '1', content: '작업 반경 내 접근 금지 조치 및 유도원 배치' },
            { id: '2', content: '후방 카메라 및 경보장치 작동 확인' },
            { id: '3', content: '버켓 연결핀 및 안전핀 체결 상태' },
            { id: '4', content: '지반 침하 우려 구간 보강 조치' },
            { id: '5', content: '운전자 자격 및 보험 가입 여부 확인' }
        ],
        updatedAt: '2023-10-05'
    },
    {
        id: 'TPL003',
        title: '가설 전기 분전반 점검',
        items: [
            { id: '1', content: '누전차단기 작동 테스트 (시험 버튼)' },
            { id: '2', content: '외함 접지 연결 상태 확인' },
            { id: '3', content: '케이블 피복 손상 여부 및 결선 상태' },
            { id: '4', content: '충전부 방호 조치 (덮개 등)' },
            { id: '5', content: '분전반 앞 적재물 없음 확인' }
        ],
        updatedAt: '2023-10-10'
    }
]

export default function SystemChecklist() {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>(INITIAL_TEMPLATES)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)

    // Form State
    const [formTitle, setFormTitle] = useState('')
    const [formItems, setFormItems] = useState<ChecklistItem[]>([{ id: Date.now().toString(), content: '' }])

    const openCreateModal = () => {
        setEditingTemplate(null)
        setFormTitle('')
        setFormItems([{ id: Date.now().toString(), content: '' }])
        setIsModalOpen(true)
    }

    const openEditModal = (tpl: ChecklistTemplate) => {
        setEditingTemplate(tpl)
        setFormTitle(tpl.title)
        setFormItems([...tpl.items])
        setIsModalOpen(true)
    }

    const handleAddItem = () => {
        setFormItems([...formItems, { id: Date.now().toString(), content: '' }])
    }

    const handleRemoveItem = (idx: number) => {
        setFormItems(formItems.filter((_, i) => i !== idx))
    }

    const handleItemChange = (idx: number, val: string) => {
        const newItems = [...formItems]
        newItems[idx].content = val
        setFormItems(newItems)
    }

    const handleSave = () => {
        if (!formTitle.trim()) {
            alert('템플릿 제목을 입력해주세요.')
            return
        }

        const cleanItems = formItems.filter(i => i.content.trim() !== '')
        if (cleanItems.length === 0) {
            alert('적어도 하나의 점검 항목이 필요합니다.')
            return
        }

        if (editingTemplate) {
            // Update
            setTemplates(templates.map(t =>
                t.id === editingTemplate.id
                    ? { ...t, title: formTitle, items: cleanItems, updatedAt: new Date().toISOString().split('T')[0] }
                    : t
            ))
        } else {
            // Create
            const newTpl: ChecklistTemplate = {
                id: `TPL${String(templates.length + 1).padStart(3, '0')}`,
                title: formTitle,
                items: cleanItems,
                updatedAt: new Date().toISOString().split('T')[0]
            }
            setTemplates([...templates, newTpl])
        }
        setIsModalOpen(false)
    }

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setTemplates(templates.filter(t => t.id !== id))
        }
    }

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <p className="eyebrow">System Admin</p>
                    <h1>체크리스트 표준 템플릿 관리</h1>
                    <p className="muted">전사 공통 안전 점검 항목을 표준화하여 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={openCreateModal}>
                    <Plus size={18} /> 새 템플릿 등록
                </button>
            </header>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: '100px' }}>ID</th>
                            <th>템플릿 명</th>
                            <th>점검 항목 수</th>
                            <th>최종 수정일</th>
                            <th style={{ width: '120px', textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {templates.map(tpl => (
                            <tr key={tpl.id}>
                                <td><span className="badge badge-tag">{tpl.id}</span></td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{tpl.title}</div>
                                    <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                        {tpl.items.slice(0, 2).map(i => i.content).join(', ')}
                                        {tpl.items.length > 2 && ' ...'}
                                    </div>
                                </td>
                                <td>{tpl.items.length}개 항목</td>
                                <td>{tpl.updatedAt}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <button className="btn-icon" onClick={() => openEditModal(tpl)}><Edit2 size={16} /></button>
                                    <button className="btn-icon danger" onClick={() => handleDelete(tpl.id)}><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <header className="modal-header">
                            <h2>{editingTemplate ? '템플릿 수정' : '새 템플릿 등록'}</h2>
                            <button className="btn-text" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </header>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>템플릿 제목</label>
                                <input
                                    className="input"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="예: 지게차 작업 전 안전 점검"
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    점검 항목
                                    <button className="btn-secondary small" onClick={handleAddItem}><Plus size={14} /> 항목 추가</button>
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {formItems.map((item, idx) => (
                                        <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span className="badge badge-tag" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                                            <input
                                                className="input"
                                                value={item.content}
                                                onChange={e => handleItemChange(idx, e.target.value)}
                                                placeholder="점검 항목을 입력하세요"
                                                style={{ marginBottom: 0 }}
                                            />
                                            <button className="btn-icon danger" onClick={() => handleRemoveItem(idx)}><X size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
                            <button className="btn-primary" onClick={handleSave}><Save size={18} /> 저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
