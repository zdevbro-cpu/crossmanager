import { useCallback, useEffect, useState } from 'react'
import { Upload, Check, X, FileSpreadsheet, Pencil, RefreshCw } from 'lucide-react'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'

// TBM 양식 등록.
//
// 왜 RA 등록 화면을 그대로 쓰지 않는가
//   RA 는 '행이 반복되는 표' 하나라 열 번호만 정하면 된다.
//   TBM 은 라벨-값 머리글 + 위험요인 몇 줄 + 참석자 서명 격자가 한 장에
//   섞여 있어 열 번호로는 어디에 무엇을 쓸지 정할 수 없다.
//   그래서 여기서는 '값을 쓸 칸의 행·열 좌표'를 지정한다.
//
// 자동 인식은 추정값이다. 실측한 양식 6종에서 머리글은 전부 잡혔지만
// 위험요인·참석자 블록은 양식 편차가 커서 사람이 확인해야 한다.
// 한 칸만 어긋나도 출력물이 현장에서 못 쓰는 문서가 된다.

interface Cell { r: number; c: number }

interface HazardBlock {
    startRow: number
    rowStep: number
    count: number
    descCol: number
    measureCol: number
    measureStartRow?: number   // 대책이 아래 별도 블록에 있는 양식용
}

interface AttendeeBlock {
    startRow: number
    nameCols: number[]
    rowStep: number      // 이름 칸이 2행 병합인 양식이 있다
    rowCount: number
}

interface Template {
    id: number
    template_code: string
    name: string
    client_id: number | null
    project_id: string | null
    client_name: string | null
    project_name: string | null
    sheet_index: number | null
    storage_key: string | null
    headerCells?: Record<string, Cell>
    hazardBlock?: HazardBlock | null
    attendeeBlock?: AttendeeBlock | null
}

interface Analysis {
    detected: boolean
    message?: string
    sheets: { name: string; rows: number; cols: number }[]
    sheetIndex?: number
    sheetName?: string
    headerCells?: Record<string, Cell>
    hazardBlock?: HazardBlock | null
    attendeeBlock?: AttendeeBlock | null
    fieldLabels?: Record<string, string>
}

// 머리글 항목 순서. 양식에서 위에서 아래로 나오는 차례를 따랐다.
const FIELD_ORDER = ['projectName', 'company', 'date', 'location', 'workName', 'workContent', 'leader', 'attendeesCount']

const FALLBACK_LABELS: Record<string, string> = {
    projectName: '현장명',
    company: '소속(협력업체)',
    date: '일시',
    location: '장소',
    workName: '작업명·공종',
    workContent: '작업내용',
    leader: 'TBM 리더·강사',
    attendeesCount: '참석인원',
}

const HAZARD_LABELS: Record<string, string> = {
    startRow: '위험 시작 행',
    rowStep: '행 간격',
    count: '줄 수',
    descCol: '위험 열',
    measureStartRow: '대책 시작 행',
    measureCol: '대책 열',
}

const EMPTY_HAZARD: HazardBlock = { startRow: 0, rowStep: 1, count: 0, descCol: 0, measureCol: 0, measureStartRow: 0 }
const EMPTY_ATTENDEE: AttendeeBlock = { startRow: 0, nameCols: [], rowStep: 1, rowCount: 10 }

const colLetter = (n?: number) => {
    if (!n || n < 1) return '-'
    let s = ''
    let v = n
    while (v > 0) {
        const r = (v - 1) % 26
        s = String.fromCharCode(65 + r) + s
        v = Math.floor((v - 1) / 26)
    }
    return s
}

const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] || '')
        r.onerror = reject
        r.readAsDataURL(file)
    })

export default function TbmTemplatePanel() {
    const { show: showToast } = useToast()

    const [list, setList] = useState<Template[]>([])
    const [clients, setClients] = useState<{ id: number; name: string }[]>([])
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)

    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [b64, setB64] = useState('')
    const [analysis, setAnalysis] = useState<Analysis | null>(null)

    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [clientId, setClientId] = useState('')
    const [projectId, setProjectId] = useState('')
    const [sheetIndex, setSheetIndex] = useState(0)
    const [cells, setCells] = useState<Record<string, Cell | undefined>>({})
    const [hazard, setHazard] = useState<HazardBlock | null>(null)
    const [attendee, setAttendee] = useState<AttendeeBlock | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [t, c, p] = await Promise.all([
                apiClient.get<Template[]>('/master/tbm-templates'),
                apiClient.get<{ id: number; name: string }[]>('/master/clients'),
                apiClient.get<{ id: string; name: string }[]>('/projects'),
            ])
            setList(t.data)
            setClients(c.data)
            setProjects(p.data)
        } catch {
            showToast('TBM 양식 목록을 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => { load() }, [load])

    const reset = () => {
        setFile(null); setB64(''); setAnalysis(null)
        setCode(''); setName(''); setClientId(''); setProjectId('')
        setSheetIndex(0); setCells({}); setHazard(null); setAttendee(null)
    }

    const pickFile = async (f: File) => {
        setBusy(true)
        setFile(f)
        try {
            const data = await fileToBase64(f)
            setB64(data)
            const { data: a } = await apiClient.post<Analysis>('/master/tbm-templates/analyze', { fileBase64: data })
            setAnalysis(a)
            if (a.detected) {
                setSheetIndex(a.sheetIndex ?? 0)
                setCells(a.headerCells || {})
                setHazard(a.hazardBlock || null)
                setAttendee(a.attendeeBlock || null)
                setName(f.name.replace(/\.(xlsx|xlsm)$/i, ''))
                showToast('양식을 분석했습니다. 좌표를 확인하십시오.', 'success')
            } else {
                showToast(a.message || '인식하지 못했습니다. 직접 지정하십시오.', 'warning')
            }
        } catch (e: any) {
            showToast(e?.response?.data?.error || '양식 분석에 실패했습니다.', 'error')
            setAnalysis(null)
        } finally {
            setBusy(false)
        }
    }

    // 행·열 둘 중 하나라도 비면 쓸 수 없는 좌표다. 그 항목은 지운다.
    const setCell = (key: string, part: 'r' | 'c', v: string) => {
        setCells(prev => {
            const cur = prev[key] || { r: 0, c: 0 }
            const next: Cell = { ...cur, [part]: v ? Number(v) : 0 }
            if (!next.r || !next.c) return { ...prev, [key]: undefined }
            return { ...prev, [key]: next }
        })
    }

    const setHazardField = (k: keyof HazardBlock, v: string) => {
        const n = v ? Number(v) : 0
        setHazard(prev => ({ ...(prev || EMPTY_HAZARD), [k]: n }))
    }

    const submit = async () => {
        if (!code.trim() || !name.trim()) {
            showToast('양식 코드와 이름을 입력하십시오.', 'warning')
            return
        }
        const headerCells: Record<string, Cell> = {}
        Object.entries(cells).forEach(([k, v]) => { if (v && v.r && v.c) headerCells[k] = v })
        if (!Object.keys(headerCells).length) {
            showToast('머리글 항목을 하나 이상 지정하십시오.', 'warning')
            return
        }
        setBusy(true)
        try {
            await apiClient.post('/master/tbm-templates', {
                templateCode: code.trim().toUpperCase(),
                name: name.trim(),
                clientId: clientId ? Number(clientId) : null,
                projectId: projectId || null,
                fileBase64: b64 || undefined,
                fileName: file?.name,
                sheetIndex,
                headerCells,
                // 시작 행이 없으면 채울 자리가 없다. 비운 것으로 본다.
                hazardBlock: hazard && hazard.startRow ? hazard : null,
                attendeeBlock: attendee && attendee.startRow ? attendee : null,
            })
            showToast('TBM 양식을 등록했습니다.', 'success')
            setOpen(false)
            reset()
            await load()
        } catch (e: any) {
            showToast(e?.response?.data?.error || '등록에 실패했습니다.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const editTemplate = async (t: Template) => {
        try {
            const { data } = await apiClient.get<Template>(`/master/tbm-templates/${t.id}`)
            setCode(data.template_code)
            setName(data.name)
            setClientId(data.client_id ? String(data.client_id) : '')
            setProjectId(data.project_id || '')
            setSheetIndex(data.sheet_index ?? 0)
            setCells(data.headerCells || {})
            setHazard(data.hazardBlock || null)
            setAttendee(data.attendeeBlock || null)
            setFile(null)
            setB64('')          // 파일을 다시 올리지 않으면 등록된 양식을 그대로 쓴다
            setAnalysis(null)
            setOpen(true)
        } catch {
            showToast('양식을 불러오지 못했습니다.', 'error')
        }
    }

    const labels = analysis?.fieldLabels || FALLBACK_LABELS
    const num = (v: number | undefined) => (v ? String(v) : '')

    return (
        <>
            <p className="master-desc">
                TBM 일지는 머리글·위험요인·참석자가 한 장에 섞여 있어 열 번호로는 채울 수 없습니다.
                값을 쓸 칸의 <strong>행·열 좌표</strong>를 지정합니다.
                출력할 때는 <strong>현장 전용 &gt; 발주처 &gt; 기본</strong> 순으로 고릅니다.
            </p>

            <div className="master-actions">
                <button className="btn-primary" onClick={() => { reset(); setOpen(true) }}>
                    <Upload size={15} /> TBM 양식 등록
                </button>
                <button className="btn-text" onClick={load} title="새로고침">
                    <RefreshCw size={15} />
                </button>
                <p className="master-hint">
                    자동 인식은 추정값입니다. 한 칸만 어긋나도 출력물을 현장에서 쓸 수 없습니다.
                </p>
            </div>

            {loading ? <p className="muted">불러오는 중…</p> : (
                <div className="master-scroll">
                    <table className="master-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 160 }}>양식 코드</th>
                                <th>양식명</th>
                                <th style={{ width: 120 }}>발주처</th>
                                <th style={{ width: 130 }}>전용 현장</th>
                                <th style={{ width: 70 }}>파일</th>
                                <th style={{ width: 70 }}>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr><td colSpan={7} className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                    등록된 TBM 양식이 없습니다. 등록해야 TBM 일지를 엑셀로 내보낼 수 있습니다.
                                </td></tr>
                            ) : list.map((t, i) => (
                                <tr key={t.id}>
                                    <td className="master-dim">{i + 1}</td>
                                    <td>{t.template_code}</td>
                                    <td>{t.name}</td>
                                    <td>{t.client_name || <span className="master-dim">전체</span>}</td>
                                    <td>{t.project_name || <span className="master-dim">-</span>}</td>
                                    <td>
                                        {t.storage_key
                                            ? <FileSpreadsheet size={15} style={{ color: '#9cf0c8' }} />
                                            : <span className="master-dim">없음</span>}
                                    </td>
                                    <td>
                                        <div className="master-rowact">
                                            <button className="btn-text" onClick={() => editTemplate(t)} title="수정">
                                                <Pencil size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {open && (
                <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
                    <div className="modal-content" style={{ maxWidth: 760, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>TBM 양식 등록</h3>
                            <button className="btn-text" onClick={() => setOpen(false)}><X size={18} /></button>
                        </header>

                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>1. 양식 파일</p>
                        <div className="master-actions" style={{ margin: '0 0 1rem' }}>
                            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                                <Upload size={15} /> 파일 선택
                                <input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
                            </label>
                            <span className="master-note">
                                {file ? file.name : '기존 양식을 수정할 때는 다시 올리지 않아도 됩니다.'}
                            </span>
                        </div>

                        {busy && <p className="muted">처리 중…</p>}
                        {analysis && !analysis.detected && (
                            <p className="master-hint" style={{ marginBottom: '1rem' }}>⚠ {analysis.message}</p>
                        )}

                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>2. 기본 정보</p>
                        <div className="master-actions" style={{ margin: '0 0 0.5rem' }}>
                            <input className="input" placeholder="양식 코드 (예: TBM_DWFC)" value={code}
                                onChange={e => setCode(e.target.value)} style={{ width: 200 }} />
                            <input className="input" placeholder="양식명" value={name}
                                onChange={e => setName(e.target.value)} style={{ width: 300 }} />
                        </div>
                        <div className="master-actions" style={{ margin: '0 0 1rem' }}>
                            <select className="input" value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: 220 }}>
                                <option value="">발주처 — 지정 안 함(기본 양식)</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: 250 }}>
                                <option value="">전용 현장 — 지정 안 함</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select className="input" value={sheetIndex} onChange={e => setSheetIndex(Number(e.target.value))} style={{ width: 200 }}>
                                {(analysis?.sheets || []).map((s, i) => <option key={i} value={i}>{i + 1}. {s.name}</option>)}
                                {!analysis && <option value={sheetIndex}>시트 {sheetIndex + 1}</option>}
                            </select>
                        </div>

                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>
                            3. 머리글 좌표 — 값을 쓸 칸(비우면 그 항목은 출력하지 않습니다)
                        </p>
                        <div className="master-scroll" style={{ marginTop: 0 }}>
                            <table className="master-table">
                                <thead>
                                    <tr>
                                        <th>항목</th>
                                        <th style={{ width: 90 }}>행</th>
                                        <th style={{ width: 90 }}>열</th>
                                        <th style={{ width: 80 }}>셀</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FIELD_ORDER.map(f => (
                                        <tr key={f}>
                                            <td>{labels[f] || FALLBACK_LABELS[f] || f}</td>
                                            <td>
                                                <input className="input" type="number" min={1} style={{ width: 70 }}
                                                    value={num(cells[f]?.r)} onChange={e => setCell(f, 'r', e.target.value)} />
                                            </td>
                                            <td>
                                                <input className="input" type="number" min={1} style={{ width: 70 }}
                                                    value={num(cells[f]?.c)} onChange={e => setCell(f, 'c', e.target.value)} />
                                            </td>
                                            <td className="master-dim">
                                                {cells[f]?.r ? `${colLetter(cells[f]!.c)}${cells[f]!.r}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="sidebar-group-label" style={{ margin: '1rem 0 0.4rem' }}>
                            4. 위험요인 반복 — 시작 행을 비우면 출력하지 않습니다.
                            대책이 아래 별도 블록에 있으면 「대책 시작 행」을 적습니다(같은 줄이면 비워 둡니다)
                        </p>
                        <div className="master-actions" style={{ margin: 0 }}>
                            {(['startRow', 'rowStep', 'count', 'descCol', 'measureStartRow', 'measureCol'] as (keyof HazardBlock)[]).map(k => (
                                <label key={k} className="master-note">
                                    {HAZARD_LABELS[k]}
                                    <input className="input" type="number" min={0} style={{ width: 70, marginLeft: '0.4rem' }}
                                        value={hazard ? num(hazard[k] as number) : ''}
                                        onChange={e => setHazardField(k, e.target.value)} />
                                </label>
                            ))}
                        </div>

                        <p className="sidebar-group-label" style={{ margin: '1rem 0 0.4rem' }}>
                            5. 참석자 명단 — 성명 칸이 가로로 여러 벌이면 열을 쉼표로 적습니다
                        </p>
                        <div className="master-actions" style={{ margin: 0 }}>
                            <label className="master-note">시작 행
                                <input className="input" type="number" min={0} style={{ width: 70, marginLeft: '0.4rem' }}
                                    value={attendee ? num(attendee.startRow) : ''}
                                    onChange={e => setAttendee(prev => ({
                                        ...(prev || EMPTY_ATTENDEE),
                                        startRow: e.target.value ? Number(e.target.value) : 0,
                                    }))} />
                            </label>
                            <label className="master-note">성명 열
                                <input className="input" style={{ width: 130, marginLeft: '0.4rem' }}
                                    placeholder="예: 2,8,14"
                                    value={attendee ? (attendee.nameCols || []).join(',') : ''}
                                    onChange={e => setAttendee(prev => ({
                                        ...(prev || EMPTY_ATTENDEE),
                                        nameCols: e.target.value.split(',').map(x => Number(x.trim())).filter(Boolean),
                                    }))} />
                            </label>
                            <label className="master-note">행 간격
                                <input className="input" type="number" min={1} style={{ width: 70, marginLeft: '0.4rem' }}
                                    value={attendee ? num(attendee.rowStep) : ''}
                                    onChange={e => setAttendee(prev => ({
                                        ...(prev || EMPTY_ATTENDEE),
                                        rowStep: e.target.value ? Number(e.target.value) : 1,
                                    }))} />
                            </label>
                            <label className="master-note">한 벌 줄 수
                                <input className="input" type="number" min={1} style={{ width: 70, marginLeft: '0.4rem' }}
                                    value={attendee ? num(attendee.rowCount) : ''}
                                    onChange={e => setAttendee(prev => ({
                                        ...(prev || EMPTY_ATTENDEE),
                                        rowCount: e.target.value ? Number(e.target.value) : 10,
                                    }))} />
                            </label>
                        </div>

                        <div className="master-actions" style={{ marginTop: '1.25rem' }}>
                            <button className="btn-primary" onClick={submit} disabled={busy}>
                                <Check size={15} /> 등록
                            </button>
                            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>취소</button>
                            <p className="master-hint">같은 양식 코드로 저장하면 기존 등록을 덮어씁니다.</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
