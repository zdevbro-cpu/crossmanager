import { useState, useEffect } from 'react'
import axios from 'axios'
import { CheckSquare, X } from 'lucide-react'

interface Template {
    id: string;
    title: string;
    items: { id: string, content: string }[];
}

export default function ChecklistExecutor({ templateId, onClose }: { templateId: string, onClose: () => void }) {
    const [template, setTemplate] = useState<Template | null>(null)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTpl = async () => {
            // Re-using the list endpoint for now or finding from list
            // Ideally we have a GET /templates/:id, but for speed we can filter client side if passed full obj,
            // or just fetch list. Let's fetch list and find.
            try {
                const res = await axios.get('/api/sms/checklist-templates')
                // Parse items
                const found = res.data.find((t: any) => t.id === templateId)
                if (found) {
                    found.items = typeof found.items === 'string' ? JSON.parse(found.items) : found.items
                    setTemplate(found)
                    // Init answers
                    const initial: Record<string, string> = {}
                    found.items.forEach((i: any) => initial[i.id] = 'Pass')
                    setAnswers(initial)
                }
            } catch (e) {
                console.error("Failed to fetch template", e)
            }
            setLoading(false)
        }
        fetchTpl()
    }, [templateId])

    const handleSubmit = async () => {
        if (!template) return;

        if (!confirm('제출 하시겠습니까? 제출 후에는 수정할 수 없습니다.')) return;

        try {
            await axios.post('/api/sms/checklists/submit', {
                project_id: 'p1', // Mock Project
                template_id: template.id,
                title: template.title,
                results: answers,
                meta_info: {
                    author: '홍길동(현장소장)',
                    location: { lat: 37.5, lng: 127.0, site: 'A-Zone' },
                    weather: { condition: 'Sunny', temp: 24 }
                }
            })
            alert('안전 점검 결과가 제출되었습니다.')
            onClose()
        } catch (e) {
            console.error(e)
            alert('제출 실패')
        }
    }

    if (loading) return <div>Loading...</div>
    if (!template) return <div>Template not found</div>

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <header className="modal-header">
                    <h3>[현장 모드] {template.title}</h3>
                    <button className="icon-button" onClick={onClose}><X size={24} /></button>
                </header>
                <div className="modal-body">
                    <div className="alert-box" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        ℹ️ 이 화면은 현장 작업자가 태블릿/모바일에서 보는 화면입니다. <br />
                        제출 시 <strong>'불변 스냅샷'</strong>이 생성되어 PMS로 전송됩니다.
                    </div>

                    <div className="checklist-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60dvh', overflowY: 'auto' }}>
                        {template.items.map(item => (
                            <div key={item.id} style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '0.8rem', fontSize: '1rem', lineHeight: '1.4', wordBreak: 'keep-all' }}>
                                    {item.content}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    {[
                                        { label: '양호', value: 'Pass', activeClass: 'badge-live' },
                                        { label: '불량', value: 'Fail', activeClass: 'badge-alert' },
                                        { label: '해당없음', value: 'N/A', activeClass: 'badge-neutral' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setAnswers({ ...answers, [item.id]: opt.value })}
                                            className={`badge ${answers[item.id] === opt.value ? opt.activeClass : 'badge-outline'}`}
                                            style={{
                                                cursor: 'pointer',
                                                justifyContent: 'center',
                                                padding: '0.6rem 0',
                                                fontSize: '0.9rem',
                                                height: 'auto',
                                                borderRadius: '6px'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>취소</button>
                    <button className="btn-primary" onClick={handleSubmit}>
                        <CheckSquare size={16} /> 제출 (Submit)
                    </button>
                </div>
            </div>
        </div>
    )
}
