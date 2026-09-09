import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, X } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import './Milestones.css'

// 마일스톤 — 프로젝트별 일정을 달력에 등록한다.
//
// 왜 간트(WBS)가 아니라 달력인가
//   WBS 는 선후행·가중치·공정률 롤업을 다 채워야 그림이 나온다. 하나라도
//   비면 간트가 깨진다. 철거·해체 현장은 작업이 자주 바뀌어 그 상태를
//   유지하기 어렵다. 실제로는 입력이 안 되고 화면이 비어 있게 된다.
//
//   달력은 「제목 + 기간」만 있으면 선다. 입력 부담이 작아 실제로 쓰인다.
//   TBM·점검·제출기한처럼 날짜를 축으로 하는 다른 일정과도 같은 화면에
//   얹을 수 있다.
//
// 저장은 기존 tasks 테이블을 그대로 쓴다. 달력에 필요한 것은
// name·start_date·end_date 뿐이고 predecessors·weight 는 비워 둔다.
// 나중에 WBS 가 필요해지면 그 두 칸만 채우면 되므로 버리는 것이 없다.

interface Task {
    id: string
    projectId: string
    name: string
    start: string | null
    end: string | null
    progress: number | null
    status: string | null
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 겹쳐 보는 다른 일정. 마일스톤 외에는 읽기 전용이다.
// 원본 화면에서 고쳐야 이력이 남는다. 여기서 고치게 하면 어디서 바뀌었는지
// 알 수 없어진다.
interface CalEvent {
    id: string
    source: 'MILESTONE' | 'TBM' | 'EDU' | 'RA' | 'EXPIRY'
    title: string
    start: string
    end: string
    project_code: string | null
    project_name: string | null
}

// 전체 보기에서는 어느 현장 일정인지 알아야 한다. 달력 칸이 좁아
// [PRJ-2401] 을 통째로 넣으면 제목이 잘리므로 뒤 네 자리만 배지로 붙인다.
// 전체 이름은 툴팁으로 본다.
const shortCode = (code?: string | null) => {
    if (!code) return ''
    const m = String(code).match(/(\d{3,})\s*$/)
    return m ? m[1] : String(code).slice(-4)
}

const SOURCE_META: Record<string, { label: string; cls: string }> = {
    TBM: { label: 'TBM', cls: 'tbm' },
    EDU: { label: '교육', cls: 'edu' },
    RA: { label: '위험성평가', cls: 'ra' },
    EXPIRY: { label: '만료', cls: 'expiry' },
}

const ymd = (d: Date) => {
    // toISOString 은 UTC 로 밀려 하루 전이 된다. 현지 날짜를 그대로 쓴다.
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
}

const addDays = (s: string, n: number) => {
    const d = new Date(s)
    d.setDate(d.getDate() + n)
    return ymd(d)
}

// 달력 격자에 필요한 날짜를 만든다. 앞뒤로 빈칸 없이 주 단위로 채운다.
function buildGrid(year: number, month: number) {
    const first = new Date(year, month, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        cells.push(d)
    }
    return cells
}

export default function MilestonesPage() {
    const { selectedId, projects } = useProjectContext()
    const { show } = useToast()

    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth())
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(false)

    const [editing, setEditing] = useState<Partial<Task> | null>(null)
    const [busy, setBusy] = useState(false)

    const [events, setEvents] = useState<CalEvent[]>([])
    const [showOthers, setShowOthers] = useState(true)

    const project = projects?.find((p: any) => p.id === selectedId)

    // 프로젝트를 고르면 그 현장만, 안 고르면 전 현장을 본다.
    // 본사에서 이번 주에 어느 현장에 무슨 일이 있는지 훑어야 할 때가 있다.
    const load = useCallback(async () => {
        setLoading(true)
        try {
            const q = selectedId ? `?projectId=${selectedId}` : ''
            const { data } = await apiClient.get<Task[]>(`/tasks${q}`)
            setTasks(Array.isArray(data) ? data : [])
        } catch {
            show('마일스톤을 불러오지 못했습니다.', 'error')
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [selectedId, show])

    useEffect(() => { load() }, [load])

    const cells = useMemo(() => buildGrid(year, month), [year, month])

    // 달력에 그려지는 범위(앞뒤 달 끝자락 포함)만 읽는다. 전체를 받으면
    // 쌓일수록 느려진다.
    useEffect(() => {
        if (!showOthers || !cells.length) { setEvents([]); return }
        const from = ymd(cells[0])
        const to = ymd(cells[cells.length - 1])
        const q = selectedId ? `&projectId=${selectedId}` : ''
        apiClient.get<CalEvent[]>(`/calendar?from=${from}&to=${to}${q}`)
            .then(r => setEvents(Array.isArray(r.data) ? r.data : []))
            .catch(() => setEvents([]))   // 겹쳐 보기가 안 돼도 마일스톤은 보여야 한다
    }, [cells, selectedId, showOthers, tasks])

    // 날짜별로 걸치는 일정을 모은다. 기간이 여러 날이면 그 날 전부에 나온다.
    const byDate = useMemo(() => {
        const map = new Map<string, Task[]>()
        tasks.forEach(t => {
            if (!t.start) return
            const end = t.end || t.start
            let cur = t.start.slice(0, 10)
            const last = end.slice(0, 10)
            let guard = 0
            while (cur <= last && guard++ < 400) {
                if (!map.has(cur)) map.set(cur, [])
                map.get(cur)!.push(t)
                cur = addDays(cur, 1)
            }
        })
        return map
    }, [tasks])

    // 전체 보기일 때 마일스톤에 붙일 현장 코드. 통합 조회 결과에서 찾는다.
    const codeOf = useMemo(() => {
        const m = new Map<string, { code: string; name: string }>()
        events.forEach(e => {
            if (e.project_code) m.set(e.id, { code: e.project_code, name: e.project_name || '' })
        })
        return m
    }, [events])

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalEvent[]>()
        events.filter(e => e.source !== 'MILESTONE').forEach(e => {
            let cur = e.start
            let guard = 0
            while (cur <= e.end && guard++ < 400) {
                if (!map.has(cur)) map.set(cur, [])
                map.get(cur)!.push(e)
                cur = addDays(cur, 1)
            }
        })
        return map
    }, [events])

    const move = (delta: number) => {
        const d = new Date(year, month + delta, 1)
        setYear(d.getFullYear())
        setMonth(d.getMonth())
    }

    const openNew = (dateStr: string) => {
        if (!selectedId) { show('프로젝트를 먼저 선택하십시오.', 'warning'); return }
        setEditing({ name: '', start: dateStr, end: dateStr, progress: 0 })
    }

    const save = async () => {
        if (!editing) return
        if (!editing.name?.trim()) { show('제목을 입력하십시오.', 'warning'); return }
        if (!editing.start || !editing.end) { show('기간을 입력하십시오.', 'warning'); return }
        if (editing.end < editing.start) { show('종료일이 시작일보다 빠릅니다.', 'warning'); return }

        setBusy(true)
        try {
            const body = {
                projectId: selectedId,
                name: editing.name.trim(),
                start: editing.start,
                end: editing.end,
                progress: Number(editing.progress) || 0,
            }
            if (editing.id) await apiClient.put(`/tasks/${editing.id}`, body)
            else await apiClient.post('/tasks', body)
            show(editing.id ? '수정했습니다.' : '마일스톤을 등록했습니다.', 'success')
            setEditing(null)
            await load()
        } catch (e: any) {
            show(e?.response?.data?.error || '저장에 실패했습니다.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        if (!editing?.id) return
        if (!confirm(`"${editing.name}" 을(를) 삭제하시겠습니까?`)) return
        setBusy(true)
        try {
            await apiClient.delete(`/tasks/${editing.id}`)
            show('삭제했습니다.', 'success')
            setEditing(null)
            await load()
        } catch {
            show('삭제에 실패했습니다.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const todayStr = ymd(today)

    return (
        <div className="page">
            <header className="section-header">
                <div>
                    <p className="eyebrow">프로젝트 일정</p>
                    <h2>마일스톤</h2>
                    <p className="muted">
                        {project
                            ? `[${project.code}] ${project.name} · 날짜를 누르면 등록, 일정을 누르면 수정합니다.`
                            : '전체 프로젝트 · 앞의 숫자는 현장 코드입니다. 등록하려면 상단에서 현장을 고르십시오.'}
                    </p>
                </div>
                <div className="ms-nav">
                    <button className="ms-btn" onClick={() => move(-1)} title="이전 달"><ChevronLeft size={16} /></button>
                    <strong className="ms-title">{year}. {String(month + 1).padStart(2, '0')}</strong>
                    <button className="ms-btn" onClick={() => move(1)} title="다음 달"><ChevronRight size={16} /></button>
                    <button className="ms-btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}>오늘</button>
                    <button
                        className={`ms-btn ${showOthers ? 'on' : ''}`}
                        onClick={() => setShowOthers(v => !v)}
                        title="TBM·교육·위험성평가·만료를 함께 표시합니다"
                    >
                        {showOthers ? '다른 일정 켬' : '다른 일정 끔'}
                    </button>
                    <button className="ms-btn primary" onClick={() => openNew(todayStr)}>
                        <Plus size={15} /> 마일스톤
                    </button>
                </div>
            </header>

            {loading && <p className="muted">불러오는 중…</p>}

            <div className="ms-grid">
                {WEEKDAYS.map((w, i) => (
                    <div key={w} className={`ms-head ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
                ))}

                {cells.map((d, i) => {
                    const key = ymd(d)
                    const inMonth = d.getMonth() === month
                    const items = byDate.get(key) || []
                    return (
                        <div
                            key={key + i}
                            className={`ms-cell ${inMonth ? '' : 'dim'} ${key === todayStr ? 'today' : ''}`}
                            onClick={() => openNew(key)}
                        >
                            <span className={`ms-day ${d.getDay() === 0 ? 'sun' : ''} ${d.getDay() === 6 ? 'sat' : ''}`}>
                                {d.getDate()}
                            </span>
                            {items.map(t => (
                                <button
                                    key={t.id + key}
                                    className="ms-item"
                                    title={[
                                        !selectedId && codeOf.get(t.id)
                                            ? `[${codeOf.get(t.id)!.code}] ${codeOf.get(t.id)!.name}`
                                            : '',
                                        `${t.name} (${t.start?.slice(0, 10)} ~ ${(t.end || t.start)?.slice(0, 10)})`,
                                    ].filter(Boolean).join(' · ')}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setEditing({
                                            id: t.id, name: t.name,
                                            start: t.start?.slice(0, 10), end: (t.end || t.start)?.slice(0, 10),
                                            progress: t.progress || 0,
                                        })
                                    }}
                                >
                                    {/* 전체 보기에서만 현장 배지를 붙인다.
                                        한 현장만 볼 때는 전부 같은 값이라 자리만 먹는다. */}
                                    {!selectedId && codeOf.get(t.id) && (
                                        <span className="ms-badge">{shortCode(codeOf.get(t.id)!.code)}</span>
                                    )}
                                    {t.name}
                                </button>
                            ))}

                            {/* 다른 모듈 일정은 읽기 전용이다. 눌러도 열리지 않는다.
                                여기서 고치게 하면 어디서 바뀌었는지 알 수 없어진다. */}
                            {(eventsByDate.get(key) || []).map(ev => {
                                const meta = SOURCE_META[ev.source]
                                if (!meta) return null
                                return (
                                    <span
                                        key={ev.source + ev.id + key}
                                        className={`ms-ev ${meta.cls}`}
                                        title={[
                                            !selectedId && ev.project_code
                                                ? `[${ev.project_code}] ${ev.project_name || ''}`
                                                : '',
                                            `[${meta.label}] ${ev.title} (${ev.start} ~ ${ev.end})`,
                                        ].filter(Boolean).join(' · ')}
                                    >
                                        {!selectedId && ev.project_code && (
                                            <span className="ms-badge">{shortCode(ev.project_code)}</span>
                                        )}
                                        {meta.label} · {ev.title}
                                    </span>
                                )
                            })}
                        </div>
                    )
                })}
            </div>

            {showOthers && (
                <div className="ms-legend">
                    <span className="ms-ev ms-legend-chip">마일스톤</span>
                    {Object.values(SOURCE_META).map(m => (
                        <span key={m.cls} className={`ms-ev ${m.cls} ms-legend-chip`}>{m.label}</span>
                    ))}
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                        마일스톤만 여기서 등록·수정합니다. 나머지는 각 화면에서 관리합니다.
                    </span>
                </div>
            )}

            {editing && (
                <div className="ms-modal" onClick={() => !busy && setEditing(null)}>
                    <div className="ms-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="ms-modal-head">
                            <p className="card-label">{editing.id ? '마일스톤 수정' : '마일스톤 등록'}</p>
                            <button className="ms-btn" onClick={() => setEditing(null)}><X size={16} /></button>
                        </div>

                        <label className="ms-field">
                            <span>제목*</span>
                            <input
                                value={editing.name || ''}
                                autoFocus
                                onChange={e => setEditing({ ...editing, name: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') save() }}
                                placeholder="예: 3동 해체 착수"
                            />
                        </label>

                        <div className="ms-field-row">
                            <label className="ms-field">
                                <span>시작일*</span>
                                <input type="date" value={editing.start || ''}
                                    onChange={e => setEditing({ ...editing, start: e.target.value })} />
                            </label>
                            <label className="ms-field">
                                <span>종료일*</span>
                                <input type="date" value={editing.end || ''}
                                    onChange={e => setEditing({ ...editing, end: e.target.value })} />
                            </label>
                            <label className="ms-field">
                                <span>진행률(%)</span>
                                <input type="number" min={0} max={100} value={editing.progress ?? 0}
                                    onChange={e => setEditing({ ...editing, progress: Number(e.target.value) })} />
                            </label>
                        </div>

                        <div className="ms-modal-foot">
                            {editing.id && (
                                <button className="ms-btn danger" onClick={remove} disabled={busy}>
                                    <Trash2 size={15} /> 삭제
                                </button>
                            )}
                            <span style={{ flex: 1 }} />
                            <button className="ms-btn" onClick={() => setEditing(null)} disabled={busy}>취소</button>
                            <button className="ms-btn primary" onClick={save} disabled={busy}>
                                <Check size={15} /> 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
