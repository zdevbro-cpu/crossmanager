import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import './Page.css' // Reuse existing page styles
import axios from 'axios'

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

export default function SystemChecklist() {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)

    // Form State
    const [formTitle, setFormTitle] = useState('')
    const [formItems, setFormItems] = useState<ChecklistItem[]>([{ id: Date.now().toString(), content: '' }])

    // Fetch Templates from Backend
    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/sms/checklist-templates')
            // Map DB fields (snake_case) to Frontend (camelCase)
            const mapped = res.data.map((t: any) => ({
                id: t.id,
                title: t.title,
                items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items, // Handle JSONB parsing if needed
                category: t.category,
                updatedAt: t.updated_at ? t.updated_at.split('T')[0] : ''
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
                    category: editingTemplate.category
                })
            } else {
                // Create (POST)
                await axios.post('/api/sms/checklist-templates', {
                    title: formTitle,
                    items: cleanItems,
                    category: 'General' // Default category
                })
            }
            // Refresh list
            await fetchTemplates()
            setIsModalOpen(false)
        } catch (err) {
            console.error('Failed to save template:', err)
            alert('저장에 실패했습니다.')
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
                        {templates.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                    등록된 템플릿이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            templates.map(tpl => (
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
                            ))
                        )}
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
