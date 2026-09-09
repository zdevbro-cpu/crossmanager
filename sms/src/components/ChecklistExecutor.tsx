import { useState, useEffect } from 'react'
import axios from 'axios'
import { CheckSquare, X } from 'lucide-react'

interface Template {
    id: string;
    title: string;
    items: { id: string, content: string }[];
}

export default function ChecklistExecutor({ templateId, projectId, author, onClose }: {
    templateId: string
    projectId: string
    author?: string
    onClose: () => void
}) {
    const [template, setTemplate] = useState<Template | null>(null)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    // 점검을 실제로 한 날. 어제 한 점검을 오늘 입력하는 일이 흔하다.
    // 기본값은 오늘이고 바꿀 수 있다.
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

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

        if (!projectId) { alert('프로젝트를 먼저 선택하십시오.'); return }
        if (!confirm('제출 하시겠습니까? 제출 후에는 수정할 수 없습니다.')) return;

        try {
            // 프로젝트는 화면에서 고른 것을 쓴다. 예전에는 'p1' 이 박혀 있어
            // 저장 자체가 되지 않았다(uuid 가 아니다).
            await axios.post('/api/sms/checklists/submit', {
                project_id: projectId,
                template_id: template.id,
                title: template.title,
                date,
                results: answers,
                meta_info: {
                    author: author || '미상',
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
                    {/* 점검 일자를 먼저 정한다. 어제 한 점검을 오늘 입력하면
                        입력일로 남아 달력에 하루 뒤로 찍힌다. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>점검 일자</label>
                        <input
                            className="input-std"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            style={{ width: 170 }}
                        />
                    </div>
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
