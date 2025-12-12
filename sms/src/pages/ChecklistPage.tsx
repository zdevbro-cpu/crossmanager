import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, FileText, AlertTriangle, Search, X } from 'lucide-react'
import ChecklistExecutor from '../components/ChecklistExecutor'

interface Checklist {
    id: string
    template_id: string
    title: string
    status: string // SUBMITTED, IN_PROGRESS
    created_at: string
    submitted_at?: string
    results: any
    created_by: string
}

interface Template {
    id: string
    title: string
    category: string
}

export default function ChecklistPage() {
    // State
    const [checklists, setChecklists] = useState<Checklist[]>([])
    const [templates, setTemplates] = useState<Template[]>([])

    // UI State
    const [isExecutorOpen, setIsExecutorOpen] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [filterStatus, setFilterStatus] = useState('ALL') // ALL, SUBMITTED

    const projectId = 'p1' // Mock Project ID

    // Fetch Data
    const fetchData = async () => {
        try {
            const [clRes, tplRes] = await Promise.all([
                axios.get(`/api/sms/checklists?project_id=${projectId}`),
                axios.get('/api/sms/checklist-templates')
            ])
            setChecklists(clRes.data)
            setTemplates(tplRes.data)
        } catch (e) {
            console.error('Failed to fetch data', e)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleStartChecklist = (tplId: string) => {
        setSelectedTemplateId(tplId)
        setIsTemplateModalOpen(false)
        setIsExecutorOpen(true)
    }

    const handleExecutorClose = () => {
        setIsExecutorOpen(false)
        setSelectedTemplateId(null)
        fetchData() // Refresh list
    }

    // Filter Logic
    const filteredChecklists = checklists.filter(c => {
        if (filterStatus === 'ALL') return true;
        return c.status === filterStatus;
    });

    return (
        <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div className="header-left">
                    <div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>안전 점검 (Checklist)</h2>
                        <p className="subtitle" style={{ color: 'var(--text-secondary)' }}>현장 안전 점검을 수행하고 이력을 관리합니다.</p>
                    </div>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="toolbar" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="search-box" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input className="input-std" type="text" placeholder="점검명 검색..." style={{ paddingRight: '32px' }} />
                    <Search size={16} style={{ position: 'absolute', right: '10px', color: '#9fb2cc' }} />
                </div>
                <select className="input-std" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
                    <option value="ALL">전체 상태</option>
                    <option value="SUBMITTED">제출 완료</option>
                </select>

                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn-secondary" onClick={() => setIsTemplateModalOpen(true)}>
                        <Plus size={16} /> 새 점검 시작
                    </button>
                </div>
            </div>

            {/* Checklist History Table */}
            <div className="card table-card">
                <div className="table">
                    <div className="table-row table-header">
                        <span style={{ flex: 2 }}>점검명</span>
                        <span style={{ flex: 1 }}>템플릿</span>
                        <span style={{ flex: 1 }}>점검자</span>
                        <span style={{ flex: 1 }}>상태</span>
                        <span style={{ flex: 1 }}>시행일시</span>
                        <span style={{ flex: 1 }}>결과</span>
                    </div>
                    {filteredChecklists.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            수행된 점검 이력이 없습니다.
                        </div>
                    ) : (
                        filteredChecklists.map(c => (
                            <div key={c.id} className="table-row">
                                <span style={{ flex: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={16} className="muted" />
                                    {c.title}
                                </span>
                                <span style={{ flex: 1 }} className="muted-text">
                                    {templates.find(t => t.id === c.template_id)?.title || c.template_id}
                                </span>
                                <span style={{ flex: 1 }}>{c.created_by}</span>
                                <span style={{ flex: 1 }}>
                                    <span className={`badge ${c.status === 'SUBMITTED' ? 'badge-success' : 'badge-neutral'}`}>
                                        {c.status === 'SUBMITTED' ? '제출완료' : '작성중'}
                                    </span>
                                </span>
                                <span style={{ flex: 1 }}>{new Date(c.submitted_at || c.created_at).toLocaleString()}</span>
                                <span style={{ flex: 1 }}>
                                    {/* Simple result summary logic */}
                                    {c.results && Object.values(c.results).includes('Fail') ? (
                                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <AlertTriangle size={14} /> 부적합 항목 존재
                                        </span>
                                    ) : (
                                        <span style={{ color: '#10b981' }}>적합</span>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Template Selection Modal */}
            {isTemplateModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>새 점검 시작 (템플릿 선택)</h3>
                            <button className="icon-button" onClick={() => setIsTemplateModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </header>
                        <div className="modal-body">
                            <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
                                {templates.map(t => (
                                    <li key={t.id}
                                        onClick={() => handleStartChecklist(t.id)}
                                        className="hover-bg"
                                        style={{
                                            padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
                                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', transition: 'background 0.2s', borderRadius: '8px'
                                        }}
                                    >
                                        <span>{t.title}</span>
                                        <span className="badge-outline">{t.category}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Executor Modal */}
            {isExecutorOpen && selectedTemplateId && (
                <ChecklistExecutor
                    templateId={selectedTemplateId}
                    onClose={handleExecutorClose}
                />
            )}
        </div>
    )
}
