import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Plus, Check, X, Pencil, RefreshCw } from 'lucide-react'
import { useToast } from '../components/ToastProvider'
import { apiClient } from '../lib/api'
import './Page.css'
import './Master.css'

// 기준정보(마스터) — 흩어져 있던 마스터를 한자리에 모아 보여 준다.
//
// 왜 한 화면인가
//   발주처·협력업체·위치·근로자·공종·문서유형은 각각 API 는 있는데 화면이 없어
//   DB 에 직접 넣어야 했다. 성격이 같은 것을 메뉴마다 흩어 두면 어디서 고치는지
//   찾을 수 없다.
//
// 편집 범위
//   공통코드와 RA 양식만 이 화면에서 고친다. 나머지는 조회 전용이다.
//   등록·수정은 각 업무 흐름(현장 개설, 근로자 배치 등) 안에서 이뤄져야 하고,
//   여기서 아무 데이터나 고치게 하면 이력이 남지 않는다.
//
// 공통코드의 COMMON 그룹은 company·location 처럼 여러 모듈이 함께 쓰는 마스터가
// 참조하므로 SMS 화면에서 고칠 수 없다(서버에서도 막는다).

const MODULE = 'SMS'

interface CodeGroup {
    group_code: string
    group_name: string
    description: string | null
    module: string
    is_system: boolean
    code_count: number
    editable: boolean
}

interface CodeRow {
    id: number
    group_code: string
    code: string
    name: string
    sort_order: number | null
    attr: unknown
    module: string
}

type Col<T> = {
    key: string
    label: string
    width?: number
    align?: 'left' | 'right' | 'center'
    render: (row: T) => React.ReactNode
}

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

const ymd = (v: unknown) => {
    if (!v) return '-'
    const d = new Date(String(v))
    return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10)
}

/* ── 조회 전용 탭 정의 ──────────────────────────────────────
   탭마다 화면을 따로 만들면 같은 표를 열 번 쓴다.
   조회하는 주소와 열 구성만 다르므로 데이터로 두고 표 하나로 그린다. */
const READONLY_TABS: {
    key: string
    label: string
    path: string
    note: string
    cols: Col<any>[]
}[] = [
        {
            key: 'clients',
            label: '발주처',
            path: '/master/clients',
            note: '발주처별 코드 체계와 필수서류 프로파일의 기준이 된다.',
            cols: [
                { key: 'code', label: '코드', width: 110, render: r => dash(r.client_code) },
                { key: 'name', label: '발주처명', render: r => r.name },
                { key: 'short', label: '약칭', width: 100, render: r => dash(r.short_name) },
                { key: 'reg', label: '규제 유형', width: 120, render: r => dash(r.regulation_type) },
                { key: 'prof', label: '프로파일', width: 80, align: 'right', render: r => r.profile_count ?? 0 },
            ],
        },
        {
            key: 'companies',
            label: '협력업체',
            path: '/master/companies',
            note: '업체 구분은 공통코드 COMPANY_TYPE 을 따른다.',
            cols: [
                { key: 'code', label: '코드', width: 110, render: r => dash(r.company_code) },
                { key: 'name', label: '업체명', render: r => r.name },
                { key: 'type', label: '구분', width: 100, render: r => dash(r.company_type) },
                { key: 'ceo', label: '대표', width: 90, render: r => dash(r.ceo_name) },
                { key: 'biz', label: '사업자번호', width: 130, render: r => dash(r.biz_reg_no) },
                { key: 'contact', label: '담당자', width: 140, render: r => dash(r.contact_name) },
            ],
        },
        {
            key: 'locations',
            label: '현장·위치',
            path: '/master/locations',
            note: '크로스 자체 코드가 정본이다. 발주처 표기는 매핑에서 끌어 쓴다.',
            cols: [
                { key: 'full', label: '전체 코드', width: 150, render: r => dash(r.full_code) },
                { key: 'level', label: '단계', width: 90, render: r => dash(r.level_type) },
                { key: 'name', label: '명칭', render: r => r.name },
                { key: 'ccode', label: '발주처 코드', width: 130, render: r => dash(r.client_code) },
            ],
        },
        {
            key: 'workers',
            label: '인력',
            path: '/master/workers',
            note: '자격 유효기간은 만료 알림에서 관리한다.',
            cols: [
                { key: 'code', label: '코드', width: 110, render: r => dash(r.worker_code) },
                { key: 'name', label: '성명', width: 110, render: r => r.name },
                { key: 'company', label: '소속', render: r => dash(r.company_name) },
                { key: 'job', label: '직종', width: 120, render: r => dash(r.job_type) },
                { key: 'status', label: '상태', width: 90, render: r => dash(r.status) },
                { key: 'qual', label: '자격', width: 70, align: 'right', render: r => r.qual_count ?? 0 },
            ],
        },
        {
            key: 'equipment',
            label: '장비',
            path: '/master/equipment',
            note: '등록·정비 이력은 장비관리(EMS)에서 관리한다.',
            cols: [
                { key: 'code', label: '관리번호', width: 130, render: r => dash(r.equipment_id) },
                { key: 'name', label: '장비명', render: r => dash(r.name) },
                { key: 'cat', label: '분류', width: 110, render: r => dash(r.category) },
                { key: 'model', label: '모델', width: 130, render: r => dash(r.model) },
                { key: 'site', label: '배치 현장', width: 140, render: r => dash(r.assigned_site) },
                { key: 'insp', label: '차기 검사', width: 110, render: r => ymd(r.next_inspection_date) },
            ],
        },
        {
            key: 'work-types',
            label: '공종',
            path: '/master/work-types',
            note: '위험요인 라이브러리가 공종별로 묶인다. 검수 대기분은 평가서에 담기지 않는다.',
            cols: [
                { key: 'code', label: '공종 코드', width: 150, render: r => r.work_type_code },
                { key: 'name', label: '공종명', render: r => r.name },
                { key: 'parent', label: '상위', width: 130, render: r => dash(r.parent_code) },
                { key: 'active', label: '검수 완료', width: 90, align: 'right', render: r => r.active_count ?? 0 },
                {
                    key: 'pending', label: '검수 대기', width: 90, align: 'right',
                    render: r => (r.pending_count ? <span className="badge badge-tag">{r.pending_count}</span> : 0),
                },
            ],
        },
        {
            key: 'doc-types',
            label: '문서유형',
            path: '/master/doc-types',
            note: '보존연한은 문서 보존정책(retention_policy)에서 온다. 자격 유효기간과는 다른 개념이다.',
            cols: [
                { key: 'code', label: '유형 코드', width: 150, render: r => r.doc_type_code },
                { key: 'name', label: '문서유형', render: r => r.name },
                { key: 'cat', label: '대분류', width: 110, render: r => dash(r.category_code) },
                { key: 'pattern', label: '생성패턴', width: 110, render: r => dash(r.pattern_code) },
                { key: 'years', label: '보존(년)', width: 85, align: 'right', render: r => dash(r.policy_years ?? r.retention_years) },
                {
                    key: 'pd', label: '개인정보', width: 85, align: 'center',
                    render: r => (r.is_personal_data ? <span className="badge badge-alert">포함</span> : '-'),
                },
            ],
        },
        {
            key: 'roles',
            label: '권한',
            path: '/master/roles',
            note: '역할별 권한 상세는 role_permission 에 있다.',
            cols: [
                { key: 'code', label: '역할 코드', width: 160, render: r => r.role_code },
                { key: 'name', label: '역할명', width: 160, render: r => r.role_name },
                { key: 'scope', label: '범위', width: 120, render: r => dash(r.scope_type) },
                { key: 'desc', label: '설명', render: r => dash(r.description) },
                { key: 'perm', label: '권한 수', width: 80, align: 'right', render: r => r.permission_count ?? 0 },
            ],
        },
        {
            key: 'ra-templates',
            label: 'RA 양식',
            path: '/master/ra-templates',
            note: '현장 전용 > 발주처 > 기본 순으로 골라 엑셀을 출력한다.',
            cols: [
                { key: 'code', label: '양식 코드', width: 150, render: r => r.template_code },
                { key: 'name', label: '양식명', render: r => r.name },
                { key: 'client', label: '발주처', width: 130, render: r => dash(r.client_name) },
                { key: 'project', label: '전용 현장', width: 140, render: r => dash(r.project_name) },
                { key: 'scale', label: '등급 표기', width: 110, render: r => dash(r.grade_scale) },
                {
                    key: 'rows', label: '머리글/데이터', width: 110, align: 'center',
                    render: r => `${dash(r.header_row)} / ${dash(r.data_start_row)}`,
                },
            ],
        },
    ]

function DataTable({ cols, rows }: { cols: Col<any>[]; rows: any[] }) {
    if (!rows.length) {
        return (
            <div className="empty-state">
                <Database className="empty-icon" size={28} />
                <p className="muted">등록된 자료가 없습니다.</p>
            </div>
        )
    }
    return (
        <div className="master-scroll">
            <table className="master-table">
                <thead>
                    <tr>
                        <th style={{ width: 40 }}>#</th>
                        {cols.map(c => (
                            <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={row.id ?? row.role_code ?? row.work_type_code ?? row.doc_type_code ?? i}>
                            <td className="master-dim">{i + 1}</td>
                            {cols.map(c => (
                                <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render(row)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/* ── 공통코드 ─────────────────────────────────────────────── */
function CodePanel() {
    const { show: showToast } = useToast()
    const [groups, setGroups] = useState<CodeGroup[]>([])
    const [selected, setSelected] = useState<string>('')
    const [codes, setCodes] = useState<CodeRow[]>([])
    const [loading, setLoading] = useState(true)

    const [newCode, setNewCode] = useState('')
    const [newName, setNewName] = useState('')
    const [editId, setEditId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')

    const current = groups.find(g => g.group_code === selected)

    const loadGroups = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await apiClient.get<CodeGroup[]>('/master/code-groups', {
                params: { module: MODULE },
            })
            setGroups(data)
            setSelected(prev => prev || data[0]?.group_code || '')
        } catch {
            showToast('코드그룹을 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }, [showToast])

    const loadCodes = useCallback(async (group: string) => {
        if (!group) return
        try {
            const { data } = await apiClient.get<CodeRow[]>('/master/codes', { params: { group } })
            setCodes(data)
        } catch {
            showToast('코드를 불러오지 못했습니다.', 'error')
        }
    }, [showToast])

    useEffect(() => { loadGroups() }, [loadGroups])
    useEffect(() => { loadCodes(selected) }, [selected, loadCodes])

    const add = async () => {
        if (!newCode.trim() || !newName.trim()) {
            showToast('코드와 명칭을 모두 입력하십시오.', 'warning')
            return
        }
        try {
            await apiClient.post('/master/codes', {
                groupCode: selected,
                code: newCode.trim().toUpperCase(),
                name: newName.trim(),
                sortOrder: codes.length + 1,
                module: MODULE,
            })
            setNewCode(''); setNewName('')
            await Promise.all([loadCodes(selected), loadGroups()])
            showToast('코드를 등록했습니다.', 'success')
        } catch (e: any) {
            showToast(e?.response?.data?.error || '코드 등록에 실패했습니다.', 'error')
        }
    }

    const saveName = async (id: number) => {
        try {
            await apiClient.patch(`/master/codes/${id}`, { name: editName.trim(), module: MODULE })
            setEditId(null)
            await loadCodes(selected)
            showToast('수정했습니다.', 'success')
        } catch (e: any) {
            showToast(e?.response?.data?.error || '수정에 실패했습니다.', 'error')
        }
    }

    const deactivate = async (id: number) => {
        try {
            // 지우지 않고 비활성으로 둔다. 지난 문서가 이 코드를 참조하고 있다.
            await apiClient.patch(`/master/codes/${id}`, { isActive: false, module: MODULE })
            await Promise.all([loadCodes(selected), loadGroups()])
            showToast('사용 중지했습니다.', 'success')
        } catch (e: any) {
            showToast(e?.response?.data?.error || '처리에 실패했습니다.', 'error')
        }
    }

    if (loading) return <p className="muted">불러오는 중…</p>

    const owned = groups.filter(g => g.module === MODULE)
    const common = groups.filter(g => g.module === 'COMMON')

    const groupButton = (g: CodeGroup) => (
        <button
            key={g.group_code}
            className={`master-group-item ${selected === g.group_code ? 'active' : ''}`}
            onClick={() => setSelected(g.group_code)}
        >
            <span>
                {g.group_name}
                <span className="master-group-code">{g.group_code}</span>
            </span>
            <span className="master-tab-count">{g.code_count}</span>
        </button>
    )

    return (
        <div className="master-code-split">
            <div>
                <p className="sidebar-group-label" style={{ margin: '0 0 0.35rem 0.55rem' }}>SMS 코드</p>
                {owned.map(groupButton)}
                <p className="sidebar-group-label" style={{ margin: '0.9rem 0 0.35rem 0.55rem' }}>공통 (읽기 전용)</p>
                {common.map(groupButton)}
            </div>

            <div className="card">
                <div className="master-panel-head">
                    <h2>
                        {current?.group_name || '코드'}
                        {current && !current.editable && <span className="master-readonly">읽기 전용</span>}
                    </h2>
                    <p className="master-note">{current?.description || current?.group_code}</p>
                </div>

                {current?.editable && (
                    <div className="master-inline-form">
                        <input
                            className="input"
                            placeholder="코드 (예: FALL)"
                            value={newCode}
                            onChange={e => setNewCode(e.target.value)}
                            style={{ width: 160 }}
                        />
                        <input
                            className="input"
                            placeholder="명칭 (예: 떨어짐)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{ width: 220 }}
                        />
                        <button className="btn-primary" onClick={add}>
                            <Plus size={15} /> 추가
                        </button>
                    </div>
                )}

                {!current?.editable && (
                    <p className="master-note" style={{ marginBottom: '0.75rem' }}>
                        공통 코드는 협력업체·위치처럼 여러 모듈이 함께 쓰는 자료가 참조합니다.
                        본사 마스터에서만 수정할 수 있습니다.
                    </p>
                )}

                {codes.length === 0 ? (
                    <div className="empty-state">
                        <Database className="empty-icon" size={28} />
                        <p className="muted">등록된 코드가 없습니다.</p>
                    </div>
                ) : (
                    <div className="master-scroll">
                        <table className="master-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 150 }}>코드</th>
                                    <th>명칭</th>
                                    <th style={{ width: 70, textAlign: 'right' }}>순서</th>
                                    <th style={{ width: 190 }}>속성</th>
                                    {current?.editable && <th style={{ width: 120 }}>작업</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {codes.map(c => (
                                    <tr key={c.id}>
                                        <td>{c.code}</td>
                                        <td>
                                            {editId === c.id ? (
                                                <input
                                                    className="input"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    style={{ width: '100%' }}
                                                />
                                            ) : c.name}
                                        </td>
                                        <td className="master-num master-dim">{dash(c.sort_order)}</td>
                                        <td className="master-dim">
                                            {c.attr ? JSON.stringify(c.attr) : '-'}
                                        </td>
                                        {current?.editable && (
                                            <td>
                                                {editId === c.id ? (
                                                    <>
                                                        <button className="btn-text" onClick={() => saveName(c.id)} title="저장">
                                                            <Check size={15} />
                                                        </button>
                                                        <button className="btn-text" onClick={() => setEditId(null)} title="취소">
                                                            <X size={15} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            className="btn-text"
                                                            onClick={() => { setEditId(c.id); setEditName(c.name) }}
                                                            title="이름 수정"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button className="btn-text" onClick={() => deactivate(c.id)} title="사용 중지">
                                                            <X size={15} />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── 화면 ─────────────────────────────────────────────────── */
export default function Master() {
    const { show: showToast } = useToast()
    const [tab, setTab] = useState('codes')
    const [rows, setRows] = useState<any[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)

    const active = useMemo(() => READONLY_TABS.find(t => t.key === tab), [tab])

    const load = useCallback(async () => {
        if (!active) return
        setLoading(true)
        try {
            const { data } = await apiClient.get(active.path)
            setRows(Array.isArray(data) ? data : [])
            setCounts(prev => ({ ...prev, [active.key]: Array.isArray(data) ? data.length : 0 }))
        } catch {
            setRows([])
            showToast(`${active.label} 조회에 실패했습니다.`, 'error')
        } finally {
            setLoading(false)
        }
    }, [active, showToast])

    useEffect(() => { load() }, [load])

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">마스터</p>
                    <h1>기준정보</h1>
                    <p className="muted">
                        모듈에 흩어져 있던 기준정보를 한자리에 모았습니다.
                        공통코드와 RA 양식만 여기서 수정하고, 나머지는 조회 전용입니다.
                    </p>
                </div>
            </div>

            <div className="master-layout">
                <nav className="master-tabs">
                    <button
                        className={`master-tab ${tab === 'codes' ? 'active' : ''}`}
                        onClick={() => setTab('codes')}
                    >
                        <span>공통코드</span>
                    </button>
                    {READONLY_TABS.map(t => (
                        <button
                            key={t.key}
                            className={`master-tab ${tab === t.key ? 'active' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            <span>{t.label}</span>
                            {counts[t.key] !== undefined && (
                                <span className="master-tab-count">{counts[t.key]}</span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="master-panel">
                    {tab === 'codes' ? (
                        <CodePanel />
                    ) : (
                        <div className="card">
                            <div className="master-panel-head">
                                <h2>
                                    {active?.label}
                                    <span className="master-readonly">조회 전용</span>
                                </h2>
                                <button className="btn-text" onClick={load} title="새로고침">
                                    <RefreshCw size={15} />
                                </button>
                            </div>
                            <p className="master-note" style={{ marginBottom: '0.75rem' }}>{active?.note}</p>
                            {loading
                                ? <p className="muted">불러오는 중…</p>
                                : <DataTable cols={active?.cols || []} rows={rows} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
