import { useCallback, useEffect, useState } from 'react'
import { Upload, Check, X, FileSpreadsheet, Pencil, RefreshCw } from 'lucide-react'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'

// RA 양식 등록.
//
// 왜 자동 인식 후 사람이 확인하는가
//   양식은 발주처마다 다르다. 실측해 보니 머리글 행·열 배치·시트 수는 물론
//   등급 표기까지 달랐다(크로스 A~E, 표준템플릿 상·중·하).
//   자동 인식은 대개 맞지만 늘 맞지는 않는다. 틀린 채로 등록되면 출력물의
//   열이 어긋나 현장에서 못 쓴다. 그래서 추정값을 보여 주고 고칠 수 있게 한다.
//
// 등록하면 그 양식 그대로 위험성평가서를 출력한다(개요서 3.1 — 표준화 대상은
// 데이터이고, 서류는 데이터를 발주처 양식으로 렌더링한 결과물이다).

interface Template {
    id: number
    template_code: string
    name: string
    client_id: number | null
    project_id: string | null
    client_name: string | null
    project_name: string | null
    grade_scale: string | null
    header_row: number | null
    data_start_row: number | null
    sheet_index: number | null
    tail_marker: string | null
    storage_key: string | null
    columns?: Record<string, number>
}

interface Analysis {
    detected: boolean
    message?: string
    sheets: { name: string; rows: number; cols: number }[]
    sheetIndex?: number
    sheetName?: string
    headerRow?: number
    dataStartRow?: number
    columns?: Record<string, number>
    headerCells?: Record<string, { r: number; c: number }>
    gradeScale?: string
    tailMarker?: string | null
    fieldLabels?: Record<string, string>
}

// 매핑 화면에 보여 줄 순서. 현장 양식의 열 순서를 따랐다.
const FIELD_ORDER = [
    'process', 'location', 'hazardClass', 'hazardDesc', 'accident',
    'legal', 'control', 'freq', 'sev', 'grade', 'measure',
    'resFreq', 'resSev', 'resGrade',
]

const FALLBACK_LABELS: Record<string, string> = {
    process: '세부공정',
    location: '작업위치',
    hazardClass: '위험분류',
    hazardDesc: '위험발생 상황 및 결과',
    accident: '재해형태',
    legal: '관련근거(법적기준)',
    control: '현재의 안전보건조치',
    freq: '가능성(빈도)',
    sev: '중대성(강도)',
    grade: '위험성',
    measure: '위험성 감소대책',
    resFreq: '개선 후 가능성',
    resSev: '개선 후 중대성',
    resGrade: '개선 후 위험성',
}

const GRADE_SCALES = [
    { value: 'A_E', label: 'A ~ E' },
    { value: 'HIGH_MID_LOW', label: '상 · 중 · 하' },
    { value: 'NUMERIC', label: '숫자' },
]

// 엑셀 열 번호 → 문자(1=A). 사람은 A·B·C 로 세지 숫자로 세지 않는다.
const colLetter = (n: number | undefined) => {
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

export default function RaTemplatePanel() {
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

    // 등록 입력값
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [clientId, setClientId] = useState('')
    const [projectId, setProjectId] = useState('')
    const [sheetIndex, setSheetIndex] = useState(0)
    const [headerRow, setHeaderRow] = useState<number | ''>('')
    const [dataStartRow, setDataStartRow] = useState<number | ''>('')
    const [gradeScale, setGradeScale] = useState('A_E')
    const [columns, setColumns] = useState<Record<string, number | ''>>({})

    const [detailOf, setDetailOf] = useState<Template | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [t, c, p] = await Promise.all([
                apiClient.get<Template[]>('/master/ra-templates'),
                apiClient.get<{ id: number; name: string }[]>('/master/clients'),
                apiClient.get<{ id: string; name: string }[]>('/projects'),
            ])
            setList(t.data)
            setClients(c.data)
            setProjects(p.data)
        } catch {
            showToast('양식 목록을 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => { load() }, [load])

    const reset = () => {
        setFile(null); setB64(''); setAnalysis(null)
        setCode(''); setName(''); setClientId(''); setProjectId('')
        setSheetIndex(0); setHeaderRow(''); setDataStartRow('')
        setGradeScale('A_E'); setColumns({})
    }

    const pickFile = async (f: File) => {
        setBusy(true)
        setFile(f)
        try {
            const data = await fileToBase64(f)
            setB64(data)
            const { data: a } = await apiClient.post<Analysis>('/master/ra-templates/analyze', {
                fileBase64: data,
            })
            setAnalysis(a)

            if (a.detected) {
                setSheetIndex(a.sheetIndex ?? 0)
                setHeaderRow(a.headerRow ?? '')
                setDataStartRow(a.dataStartRow ?? '')
                setGradeScale(a.gradeScale || 'A_E')
                setColumns(a.columns || {})
                // 파일명에서 이름을 미리 채운다. 어차피 고칠 수 있다.
                setName(f.name.replace(/\.(xlsx|xlsm)$/i, ''))
                showToast('양식을 분석했습니다. 내용을 확인하십시오.', 'success')
            } else {
                showToast(a.message || '머리글을 찾지 못했습니다. 직접 지정하십시오.', 'warning')
            }
        } catch (e: any) {
            showToast(e?.response?.data?.error || '양식 분석에 실패했습니다.', 'error')
            setAnalysis(null)
        } finally {
            setBusy(false)
        }
    }

    const submit = async () => {
        if (!code.trim() || !name.trim()) {
            showToast('양식 코드와 이름을 입력하십시오.', 'warning')
            return
        }
        if (!columns.hazardDesc) {
            // 이 열이 없으면 무엇을 어디에 쓸지 정할 수 없다.
            showToast('「위험발생 상황 및 결과」 열은 반드시 지정해야 합니다.', 'warning')
            return
        }
        setBusy(true)
        try {
            const cleaned: Record<string, number> = {}
            Object.entries(columns).forEach(([k, v]) => { if (v) cleaned[k] = Number(v) })

            await apiClient.post('/master/ra-templates', {
                templateCode: code.trim().toUpperCase(),
                name: name.trim(),
                clientId: clientId ? Number(clientId) : null,
                projectId: projectId || null,
                fileBase64: b64 || undefined,
                fileName: file?.name,
                sheetIndex,
                headerRow: headerRow || null,
                dataStartRow: dataStartRow || null,
                columns: cleaned,
                headerCells: analysis?.headerCells || {},
                gradeScale,
                tailMarker: analysis?.tailMarker || null,
            })
            showToast('양식을 등록했습니다.', 'success')
            setOpen(false)
            reset()
            await load()
        } catch (e: any) {
            showToast(e?.response?.data?.error || '양식 등록에 실패했습니다.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const openDetail = async (t: Template) => {
        try {
            const { data } = await apiClient.get<Template>(`/master/ra-templates/${t.id}`)
            setDetailOf(data)
        } catch {
            showToast('양식 상세를 불러오지 못했습니다.', 'error')
        }
    }

    // 등록된 양식을 다시 불러 고친다. 같은 코드로 저장하면 덮어쓴다.
    const editTemplate = async (t: Template) => {
        try {
            const { data } = await apiClient.get<Template>(`/master/ra-templates/${t.id}`)
            setCode(data.template_code)
            setName(data.name)
            setClientId(data.client_id ? String(data.client_id) : '')
            setProjectId(data.project_id || '')
            setSheetIndex(data.sheet_index ?? 0)
            setHeaderRow(data.header_row ?? '')
            setDataStartRow(data.data_start_row ?? '')
            setGradeScale(data.grade_scale || 'A_E')
            setColumns(data.columns || {})
            setFile(null)
            setB64('')          // 파일을 다시 올리지 않으면 기존 양식 파일을 그대로 쓴다
            setAnalysis(null)
            setOpen(true)
            setDetailOf(null)
        } catch {
            showToast('양식을 불러오지 못했습니다.', 'error')
        }
    }

    const labels = analysis?.fieldLabels || FALLBACK_LABELS

    return (
        <>
            <p className="master-desc">
                발주처마다 위험성평가표 양식이 다릅니다. 양식 파일을 올리면 구조를 읽어
                그 양식 그대로 평가서를 출력합니다.
                출력할 때는 <strong>현장 전용 &gt; 발주처 &gt; 기본</strong> 순으로 고릅니다.
            </p>

            <div className="master-actions">
                <button className="btn-primary" onClick={() => { reset(); setOpen(true) }}>
                    <Upload size={15} /> 양식 등록
                </button>
                <button className="btn-text" onClick={load} title="새로고침">
                    <RefreshCw size={15} />
                </button>
                <p className="master-hint">
                    자동 인식 결과를 확인한 뒤 저장합니다. 열이 어긋나면 출력물이 현장에서 쓸 수 없습니다.
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
                                <th style={{ width: 90 }}>등급 표기</th>
                                <th style={{ width: 110, textAlign: 'center' }}>머리글/데이터</th>
                                <th style={{ width: 70 }}>파일</th>
                                <th style={{ width: 90 }}>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr><td colSpan={9} className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                    등록된 양식이 없습니다. 「양식 등록」으로 추가하십시오.
                                </td></tr>
                            ) : list.map((t, i) => (
                                <tr key={t.id}>
                                    <td className="master-dim">{i + 1}</td>
                                    <td>{t.template_code}</td>
                                    <td>{t.name}</td>
                                    <td>{t.client_name || <span className="master-dim">전체</span>}</td>
                                    <td>{t.project_name || <span className="master-dim">-</span>}</td>
                                    <td>{t.grade_scale}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {t.header_row ?? '-'} / {t.data_start_row ?? '-'}
                                    </td>
                                    <td>
                                        {t.storage_key
                                            ? <FileSpreadsheet size={15} style={{ color: '#9cf0c8' }} />
                                            : <span className="master-dim">없음</span>}
                                    </td>
                                    <td>
                                        <div className="master-rowact">
                                            <button className="btn-text" onClick={() => openDetail(t)} title="매핑 보기">
                                                <FileSpreadsheet size={15} />
                                            </button>
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

            {/* 매핑 보기 */}
            {detailOf && (
                <div className="modal-overlay" onClick={() => setDetailOf(null)}>
                    <div className="modal-content" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>{detailOf.name}</h3>
                            <button className="btn-text" onClick={() => setDetailOf(null)}><X size={18} /></button>
                        </header>
                        <p className="master-note" style={{ marginBottom: '0.75rem' }}>
                            {detailOf.template_code} · 시트 {(detailOf.sheet_index ?? 0) + 1}번 ·
                            머리글 {detailOf.header_row}행 · 데이터 {detailOf.data_start_row}행 ·
                            등급 {detailOf.grade_scale}
                        </p>
                        <table className="master-table">
                            <thead>
                                <tr><th>항목</th><th style={{ width: 90 }}>엑셀 열</th></tr>
                            </thead>
                            <tbody>
                                {FIELD_ORDER.filter(f => detailOf.columns?.[f]).map(f => (
                                    <tr key={f}>
                                        <td>{FALLBACK_LABELS[f]}</td>
                                        <td>{colLetter(detailOf.columns?.[f])}
                                            <span className="master-dim"> ({detailOf.columns?.[f]})</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 등록 · 수정 */}
            {open && (
                <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
                    <div className="modal-content" style={{ maxWidth: 720, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>RA 양식 등록</h3>
                            <button className="btn-text" onClick={() => setOpen(false)}><X size={18} /></button>
                        </header>

                        {/* 1. 파일 */}
                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>1. 양식 파일</p>
                        <div className="master-actions" style={{ margin: '0 0 1rem' }}>
                            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                                <Upload size={15} /> 파일 선택
                                <input
                                    type="file"
                                    accept=".xlsx,.xlsm"
                                    style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
                                />
                            </label>
                            <span className="master-note">
                                {file ? file.name : '기존 양식을 수정할 때는 파일을 다시 올리지 않아도 됩니다.'}
                            </span>
                        </div>

                        {busy && <p className="muted">처리 중…</p>}

                        {analysis && !analysis.detected && (
                            <p className="master-hint" style={{ marginBottom: '1rem' }}>
                                ⚠ {analysis.message} 머리글 행과 열을 직접 지정하십시오.
                            </p>
                        )}

                        {/* 2. 기본 정보 */}
                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>2. 기본 정보</p>
                        <div className="master-actions" style={{ margin: '0 0 0.5rem' }}>
                            <input className="input" placeholder="양식 코드 (예: RA_LGD)" value={code}
                                onChange={e => setCode(e.target.value)} style={{ width: 200 }} />
                            <input className="input" placeholder="양식명" value={name}
                                onChange={e => setName(e.target.value)} style={{ width: 300 }} />
                        </div>
                        <div className="master-actions" style={{ margin: '0 0 1rem' }}>
                            <select className="input" value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: 220 }}>
                                <option value="">발주처 — 지정 안 함(기본 양식)</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: 260 }}>
                                <option value="">전용 현장 — 지정 안 함</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* 3. 구조 */}
                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>3. 구조 (자동 인식값 · 확인 후 수정)</p>
                        <div className="master-actions" style={{ margin: '0 0 1rem' }}>
                            <select className="input" value={sheetIndex} onChange={e => setSheetIndex(Number(e.target.value))} style={{ width: 200 }}>
                                {(analysis?.sheets || []).map((s, i) => (
                                    <option key={i} value={i}>{i + 1}. {s.name}</option>
                                ))}
                                {!analysis && <option value={sheetIndex}>시트 {sheetIndex + 1}</option>}
                            </select>
                            <label className="master-note">머리글 행
                                <input className="input" type="number" min={1} value={headerRow}
                                    onChange={e => setHeaderRow(e.target.value ? Number(e.target.value) : '')}
                                    style={{ width: 80, marginLeft: '0.4rem' }} />
                            </label>
                            <label className="master-note">데이터 시작 행
                                <input className="input" type="number" min={1} value={dataStartRow}
                                    onChange={e => setDataStartRow(e.target.value ? Number(e.target.value) : '')}
                                    style={{ width: 80, marginLeft: '0.4rem' }} />
                            </label>
                            <select className="input" value={gradeScale} onChange={e => setGradeScale(e.target.value)} style={{ width: 140 }}>
                                {GRADE_SCALES.map(g => <option key={g.value} value={g.value}>등급 {g.label}</option>)}
                            </select>
                        </div>

                        {/* 4. 열 매핑 */}
                        <p className="sidebar-group-label" style={{ margin: '0 0 0.4rem' }}>
                            4. 열 매핑 — 비워 두면 그 항목은 출력하지 않습니다
                        </p>
                        <div className="master-scroll" style={{ marginTop: 0 }}>
                            <table className="master-table">
                                <thead>
                                    <tr>
                                        <th>항목</th>
                                        <th style={{ width: 110 }}>엑셀 열 번호</th>
                                        <th style={{ width: 70 }}>열 문자</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FIELD_ORDER.map(f => (
                                        <tr key={f}>
                                            <td>
                                                {labels[f] || f}
                                                {f === 'hazardDesc' && <span className="badge badge-alert" style={{ marginLeft: '0.4rem' }}>필수</span>}
                                            </td>
                                            <td>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    min={1}
                                                    value={columns[f] ?? ''}
                                                    onChange={e => setColumns(prev => ({
                                                        ...prev,
                                                        [f]: e.target.value ? Number(e.target.value) : '',
                                                    }))}
                                                    style={{ width: 90 }}
                                                />
                                            </td>
                                            <td className="master-dim">{colLetter(columns[f] as number)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="master-actions" style={{ marginTop: '1.25rem' }}>
                            <button className="btn-primary" onClick={submit} disabled={busy}>
                                <Check size={15} /> 등록
                            </button>
                            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
                                취소
                            </button>
                            <p className="master-hint">
                                같은 양식 코드로 저장하면 기존 등록을 덮어씁니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
