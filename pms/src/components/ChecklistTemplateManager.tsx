import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import axios from 'axios'
import '../pages/Page.css' // Ensure styles are available

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

export default function ChecklistTemplateManager() {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)

    // Form State
    const [formTitle, setFormTitle] = useState('')
    const [formItems, setFormItems] = useState<ChecklistItem[]>([{ id: Date.now().toString(), content: '' }])
    const [formCategory, setFormCategory] = useState('General')

    // Fetch Templates from Backend
    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/sms/checklist-templates')
            // Map DB fields (snake_case) to Frontend (camelCase)
            const mapped = res.data.map((t: any) => ({
                id: t.id,
                title: t.title,
                items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items,
                category: t.category,
                updatedAt: t.updated_at ? new Date(t.updated_at).toLocaleDateString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).replace(/\. /g, '-').replace('.', '') : ''
            }))
            setTemplates(mapped)
        } catch (err) {
            console.error('Failed to fetch templates:', err)
        }
    }

    useEffect(() => {
        fetchTemplates()
    }, [])

    const openCreateModal = () => {
        setEditingTemplate(null)
        setFormTitle('')
        setFormItems([{ id: Date.now().toString(), content: '' }])
        setFormCategory('General')
        setIsModalOpen(true)
    }

    const openEditModal = (tpl: ChecklistTemplate) => {
        setEditingTemplate(tpl)
        setFormTitle(tpl.title)
        setFormItems([...tpl.items])
        setFormCategory(tpl.category || 'General')
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

    const handleSave = async () => {
        if (!formTitle.trim()) {
            alert('템플릿 제목을 입력해주세요.')
            return
        }

        const cleanItems = formItems.filter(i => i.content.trim() !== '')
        if (cleanItems.length === 0) {
            alert('적어도 하나의 점검 항목이 필요합니다.')
            return
        }

        try {
            if (editingTemplate) {
                // Update (PUT)
                await axios.put(`/api/sms/checklist-templates/${editingTemplate.id}`, {
                    title: formTitle,
                    items: cleanItems,
                    category: formCategory
                })
            } else {
                // Create (POST)
                await axios.post('/api/sms/checklist-templates', {
                    title: formTitle,
                    items: cleanItems,
                    category: formCategory
                })
            }
            // Refresh list
            await fetchTemplates()
            alert('템플릿이 성공적으로 저장되었습니다.')
            setIsModalOpen(false)
        } catch (err) {
            console.error('Failed to save template:', err)
            alert('저장 중 오류가 발생했습니다.')
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                await axios.delete(`/api/sms/checklist-templates/${id}`)
                await fetchTemplates()
            } catch (err) {
                console.error('Failed to delete template:', err)
                alert('삭제에 실패했습니다.')
            }
        }
    }

    return (
        <div className="checklist-manager">
            <header className="section-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3>표준 점검 템플릿</h3>
                    <p className="muted">전사 공통 안전 점검 항목을 표준화하여 관리합니다.</p>
                </div>
                <button className="btn-secondary" onClick={openCreateModal}>
                    <Plus size={16} /> 새 템플릿
                </button>
            </header>

            <div className="card table-card">
                <div className="table">
                    <div className="table-row table-header" style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ flex: '0.8', textAlign: 'center' }}>ID</span>
                        <span style={{ flex: '2.5', textAlign: 'left' }}>템플릿 명</span>
                        <span style={{ flex: '0.8', textAlign: 'center' }}>유형</span>
                        <span style={{ flex: '0.6', textAlign: 'center' }}>항목수</span>
                        <span style={{ flex: '0.8', textAlign: 'center' }}>수정일</span>
                        <span style={{ flex: '0.6', textAlign: 'center' }}>관리</span>
                    </div>
                    {templates.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                            등록된 템플릿이 없습니다.
                        </div>
                    ) : (
                        templates.map(tpl => (
                            <div key={tpl.id} className="table-row" style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ flex: '0.8', textAlign: 'center' }}>
                                    <span className="badge badge-tag" style={{ whiteSpace: 'nowrap' }}>{tpl.id}</span>
                                </span>
                                <span style={{ flex: '2.5', fontWeight: 600, textAlign: 'left' }}>{tpl.title}</span>
                                <span style={{ flex: '0.8', textAlign: 'center' }}>{tpl.category || '-'}</span>
                                <span style={{ flex: '0.6', textAlign: 'center' }}>{tpl.items.length}개</span>
                                <span style={{ flex: '0.8', textAlign: 'center' }}>{tpl.updatedAt}</span>
                                <span style={{ flex: '0.6', justifyContent: 'center' }} className="row-actions">
                                    <button className="icon-button" onClick={() => openEditModal(tpl)}><Edit2 size={16} /></button>
                                    <button className="icon-button danger" onClick={() => handleDelete(tpl.id)}><Trash2 size={16} /></button>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>{editingTemplate ? '템플릿 수정' : '새 템플릿 등록'}</h2>
                            <button className="icon-button" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </header>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>템플릿 명</label>
                                <input
                                    className="input-std"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="예: 지게차 작업 전 안전 점검"
                                />
                            </div>

                            <div className="form-group">
                                <label>작업 유형 (카테고리)</label>
                                <select className="input-std" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                                    <option value="General">일반</option>
                                    <option value="HighPlace">고소작업</option>
                                    <option value="Fire">화기작업</option>
                                    <option value="HeavyEq">중장비</option>
                                    <option value="Elec">전기작업</option>
                                    <option value="Confined">밀폐공간</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    점검 항목
                                    <button className="btn-secondary small" onClick={handleAddItem}><Plus size={14} /> 항목 추가</button>
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {formItems.map((item, idx) => (
                                        <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span className="badge badge-tag" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                                            <input
                                                className="input-std"
                                                value={item.content}
                                                onChange={e => handleItemChange(idx, e.target.value)}
                                                placeholder="점검 항목을 입력하세요"
                                                style={{ marginBottom: 0, flex: 1 }}
                                            />
                                            <button className="icon-button danger" onClick={() => handleRemoveItem(idx)}><X size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ display: 'flex', marginTop: '1.5rem', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                                className="btn-secondary"
                                onClick={handleSave}
                                style={{
                                    width: '160px',
                                    height: '45px',
                                    justifyContent: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: '#60a5fa', // Blue Text
                                    borderColor: '#3b82f6' // Blue Border
                                }}
                            >
                                <Save size={18} /> 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
