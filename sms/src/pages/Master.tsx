import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Plus, Check, X, Pencil, Download, Settings } from 'lucide-react'
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
// 화면 구성
//   1차 탭(성격) → 2차 탭(마스터·건수) → 칩(분류·건수) → 표
//   세로 탭으로 두면 항목이 늘 때마다 화면 왼쪽이 길어진다. 가로로 눕히면
//   건수를 함께 보여 주면서도 자리를 먹지 않는다.
//
// 편집 범위
//   공통코드만 이 화면에서 고친다. 나머지는 조회 전용이다.
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

type Col = {
    key: string
    label: string
    width?: number
    align?: 'left' | 'right' | 'center'
    render: (row: any) => React.ReactNode
    text: (row: any) => string     // 내려받기용 값. render 는 요소라 그대로 쓸 수 없다.
}

type Tab = {
    key: string
    label: string
    group: string
    path: string
    desc: string
    chipField?: string             // 이 필드 값으로 칩 필터를 만든다
    chipLabel?: (v: string) => string
    cols: Col[]
}

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

const ymd = (v: unknown) => {
    if (!v) return '-'
    const d = new Date(String(v))
    return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10)
}

/* ── 탭 정의 ────────────────────────────────────────────────
   탭마다 화면을 따로 만들면 같은 표를 아홉 번 쓴다.
   조회 주소와 열 구성만 다르므로 데이터로 두고 표 하나로 그린다. */
const TABS: Tab[] = [
    {
        key: 'clients',
        label: '발주처',
        group: '기준정보',
        path: '/master/clients',
        desc: '발주처별 코드 체계와 필수서류 프로파일의 기준이 됩니다.',
        chipField: 'regulation_type',
        cols: [
            { key: 'code', label: '코드', width: 110, render: r => dash(r.client_code), text: r => dash(r.client_code) },
            { key: 'name', label: '발주처명', render: r => r.name, text: r => r.name },
            { key: 'short', label: '약칭', width: 100, render: r => dash(r.short_name), text: r => dash(r.short_name) },
            { key: 'reg', label: '규제 유형', width: 120, render: r => dash(r.regulation_type), text: r => dash(r.regulation_type) },
            { key: 'prof', label: '프로파일', width: 80, align: 'right', render: r => r.profile_count ?? 0, text: r => String(r.profile_count ?? 0) },
        ],
    },
    {
        key: 'work-types',
        label: '공종',
        group: '기준정보',
        path: '/master/work-types',
        desc: '위험요인 라이브러리가 공종별로 묶입니다. 검수 대기분은 평가서에 담기지 않습니다.',
        chipField: 'parent_code',
        chipLabel: v => (v ? v : '대분류'),
        cols: [
            { key: 'code', label: '공종 코드', width: 150, render: r => r.work_type_code, text: r => r.work_type_code },
            { key: 'name', label: '공종명', render: r => r.name, text: r => r.name },
            { key: 'parent', label: '상위', width: 130, render: r => dash(r.parent_code), text: r => dash(r.parent_code) },
            { key: 'active', label: '검수 완료', width: 90, align: 'right', render: r => r.active_count ?? 0, text: r => String(r.active_count ?? 0) },
            {
                key: 'pending', label: '검수 대기', width: 90, align: 'right',
                render: r => (r.pending_count ? <span className="badge badge-tag">{r.pending_count}</span> : 0),
                text: r => String(r.pending_count ?? 0),
            },
        ],
    },
    {
        key: 'locations',
        label: '현장·위치',
        group: '기준정보',
        path: '/master/locations',
        desc: '크로스 자체 코드가 정본입니다. 발주처 표기는 매핑에서 끌어 씁니다.',
        chipField: 'level_type',
        cols: [
            { key: 'full', label: '전체 코드', width: 150, render: r => dash(r.full_code), text: r => dash(r.full_code) },
            { key: 'level', label: '단계', width: 90, render: r => dash(r.level_type), text: r => dash(r.level_type) },
            { key: 'name', label: '명칭', render: r => r.name, text: r => r.name },
            { key: 'ccode', label: '발주처 코드', width: 130, render: r => dash(r.client_code), text: r => dash(r.client_code) },
        ],
    },
    {
        key: 'companies',
        label: '협력업체',
        group: '조직·인력',
        path: '/master/companies',
        desc: '업체 구분은 공통코드 COMPANY_TYPE 을 따릅니다.',
        chipField: 'company_type',
        cols: [
            { key: 'code', label: '코드', width: 110, render: r => dash(r.company_code), text: r => dash(r.company_code) },
            { key: 'name', label: '업체명', render: r => r.name, text: r => r.name },
            { key: 'type', label: '구분', width: 100, render: r => dash(r.company_type), text: r => dash(r.company_type) },
            { key: 'ceo', label: '대표', width: 90, render: r => dash(r.ceo_name), text: r => dash(r.ceo_name) },
            { key: 'biz', label: '사업자번호', width: 130, render: r => dash(r.biz_reg_no), text: r => dash(r.biz_reg_no) },
            { key: 'contact', label: '담당자', width: 140, render: r => dash(r.contact_name), text: r => dash(r.contact_name) },
        ],
    },
    {
        key: 'workers',
        label: '인력',
        group: '조직·인력',
        path: '/master/workers',
        desc: '자격 유효기간은 만료 알림에서 관리합니다.',
        chipField: 'company_name',
        cols: [
            { key: 'code', label: '코드', width: 110, render: r => dash(r.worker_code), text: r => dash(r.worker_code) },
            { key: 'name', label: '성명', width: 110, render: r => r.name, text: r => r.name },
            { key: 'company', label: '소속', render: r => dash(r.company_name), text: r => dash(r.company_name) },
            { key: 'job', label: '직종', width: 120, render: r => dash(r.job_type), text: r => dash(r.job_type) },
            { key: 'status', label: '상태', width: 90, render: r => dash(r.status), text: r => dash(r.status) },
            { key: 'qual', label: '자격', width: 70, align: 'right', render: r => r.qual_count ?? 0, text: r => String(r.qual_count ?? 0) },
        ],
    },
    {
        key: 'equipment',
        label: '장비',
        group: '조직·인력',
        path: '/master/equipment',
        desc: '등록·정비 이력은 장비관리(EMS)에서 관리합니다.',
        chipField: 'category',
        cols: [
            { key: 'code', label: '관리번호', width: 130, render: r => dash(r.equipment_id), text: r => dash(r.equipment_id) },
            { key: 'name', label: '장비명', render: r => dash(r.name), text: r => dash(r.name) },
            { key: 'cat', label: '분류', width: 110, render: r => dash(r.category), text: r => dash(r.category) },
            { key: 'model', label: '모델', width: 130, render: r => dash(r.model), text: r => dash(r.model) },
            { key: 'site', label: '배치 현장', width: 140, render: r => dash(r.assigned_site), text: r => dash(r.assigned_site) },
            { key: 'insp', label: '차기 검사', width: 110, render: r => ymd(r.next_inspection_date), text: r => ymd(r.next_inspection_date) },
        ],
    },
    {
        key: 'roles',
        label: '권한',
        group: '조직·인력',
        path: '/master/roles',
        desc: '역할별 권한 상세는 role_permission 에 있습니다.',
        chipField: 'scope_type',
        cols: [
            { key: 'code', label: '역할 코드', width: 160, render: r => r.role_code, text: r => r.role_code },
            { key: 'name', label: '역할명', width: 160, render: r => r.role_name, text: r => r.role_name },
            { key: 'scope', label: '범위', width: 120, render: r => dash(r.scope_type), text: r => dash(r.scope_type) },
            { key: 'desc', label: '설명', render: r => dash(r.description), text: r => dash(r.description) },
            { key: 'perm', label: '권한 수', width: 80, align: 'right', render: r => r.permission_count ?? 0, text: r => String(r.permission_count ?? 0) },
        ],
    },
    {
        key: 'doc-types',
        label: '문서유형',
        group: '문서·양식',
        path: '/master/doc-types',
        desc: '보존연한은 문서 보존정책에서 옵니다. 자격 유효기간과는 다른 개념입니다.',
        chipField: 'category_code',
        cols: [
            { key: 'code', label: '유형 코드', width: 150, render: r => r.doc_type_code, text: r => r.doc_type_code },
            { key: 'name', label: '문서유형', render: r => r.name, text: r => r.name },
            { key: 'cat', label: '대분류', width: 110, render: r => dash(r.category_code), text: r => dash(r.category_code) },
            { key: 'pattern', label: '생성패턴', width: 110, render: r => dash(r.pattern_code), text: r => dash(r.pattern_code) },
            {
                key: 'years', label: '보존(년)', width: 85, align: 'right',
                render: r => dash(r.policy_years ?? r.retention_years),
                text: r => dash(r.policy_years ?? r.retention_years),
            },
            {
                key: 'pd', label: '개인정보', width: 85, align: 'center',
                render: r => (r.is_personal_data ? <span className="badge badge-alert">포함</span> : '-'),
                text: r => (r.is_personal_data ? '포함' : '-'),
            },
        ],
    },
    {
        key: 'ra-templates',
        label: 'RA 양식',
        group: '문서·양식',
        path: '/master/ra-templates',
        desc: '현장 전용 > 발주처 > 기본 순으로 골라 엑셀을 출력합니다.',
        chipField: 'grade_scale',
        cols: [
            { key: 'code', label: '양식 코드', width: 150, render: r => r.template_code, text: r => r.template_code },
            { key: 'name', label: '양식명', render: r => r.name, text: r => r.name },
            { key: 'client', label: '발주처', width: 130, render: r => dash(r.client_name), text: r => dash(r.client_name) },
            { key: 'project', label: '전용 현장', width: 140, render: r => dash(r.project_name), text: r => dash(r.project_name) },
            { key: 'scale', label: '등급 표기', width: 110, render: r => dash(r.grade_scale), text: r => dash(r.grade_scale) },
            {
                key: 'rows', label: '머리글/데이터', width: 110, align: 'center',
                render: r => `${dash(r.header_row)} / ${dash(r.data_start_row)}`,
                text: r => `${dash(r.header_row)} / ${dash(r.data_start_row)}`,
            },
        ],
    },
]

const GROUPS = ['기준정보', '조직·인력', '문서·양식']

// 표를 CSV 로 내린다.
// 엑셀이 UTF-8 을 알아보도록 BOM 을 붙인다. 없으면 한글이 깨진다.
function downloadCsv(fileName: string, header: string[], rows: string[][]) {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const body = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
}

function DataTable({ cols, rows }: { cols: Col[]; rows: any[] }) {
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

/* ── 공통코드 ─────────────────────────────────────────────
   칩이 코드군, 표가 그 코드군의 코드다.
   그룹 목록을 옆에 따로 두면 화면이 좌우로 갈려 표가 좁아진다. */
function CodePanel({ onCount }: { onCount: (n: number) => void }) {
    const { show: showToast } = useToast()
    const [groups, setGroups] = useState<CodeGroup[]>([])
    const [selected, setSelected] = useState('')
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
            onCount(data.reduce((s, g) => s + (g.code_count || 0), 0))
            setSelected(prev => prev || data[0]?.group_code || '')
        } catch {
            showToast('코드그룹을 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }, [showToast, onCount])

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

    return (
        <>
            <p className="master-desc">
                화면의 선택 목록이 여기서 나옵니다. 코드값을 소스에 박지 않습니다.
                「공통」 표시가 붙은 코드군은 협력업체·위치처럼 여러 모듈이 함께 쓰는 자료가
                참조하므로 본사 마스터에서만 수정할 수 있습니다.
            </p>

            <div className="master-actions">
                {current?.editable ? (
                    <>
                        <input
                            className="input"
                            placeholder="코드 (예: FALL)"
                            value={newCode}
                            onChange={e => setNewCode(e.target.value)}
                            style={{ width: 150 }}
                        />
                        <input
                            className="input"
                            placeholder="명칭 (예: 떨어짐)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{ width: 200 }}
                        />
                        <button className="btn-primary" onClick={add}>
                            <Plus size={15} /> 코드 추가
                        </button>
                    </>
                ) : (
                    <span className="master-readonly">읽기 전용 코드군</span>
                )}
                <button
                    className="btn-secondary"
                    onClick={() => downloadCsv(
                        `공통코드_${selected}.csv`,
                        ['코드', '명칭', '순서', '속성'],
                        codes.map(c => [c.code, c.name, String(c.sort_order ?? ''), c.attr ? JSON.stringify(c.attr) : '']),
                    )}
                >
                    <Download size={15} /> 목록 내려받기
                </button>
                <p className="master-hint">
                    코드는 지우지 않고 사용 중지합니다. 지난 문서가 그 코드를 참조하고 있습니다.
                </p>
            </div>

            <div className="master-chips">
                {groups.map(g => (
                    <button
                        key={g.group_code}
                        className={`master-chip ${selected === g.group_code ? 'active' : ''}`}
                        onClick={() => setSelected(g.group_code)}
                        title={g.group_code}
                    >
                        <span>{g.group_name}</span>
                        <span className="master-chip-count">{g.code_count}</span>
                        {g.module === 'COMMON' && <span className="master-chip-lock">공통</span>}
                    </button>
                ))}
            </div>

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
                                {current?.editable && <th style={{ width: 110 }}>작업</th>}
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
                                    <td className="master-dim">{c.attr ? JSON.stringify(c.attr) : '-'}</td>
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
        </>
    )
}

/* ── 조회 전용 탭 ─────────────────────────────────────────── */
function ReadonlyPanel({ tab, rows, loading }: { tab: Tab; rows: any[]; loading: boolean }) {
    const [chip, setChip] = useState('')

    useEffect(() => { setChip('') }, [tab.key])

    // 칩은 실제 값에서 만든다. 없는 분류를 미리 적어 두면 빈 칩이 남는다.
    const chips = useMemo(() => {
        if (!tab.chipField) return []
        const map = new Map<string, number>()
        rows.forEach(r => {
            const v = r[tab.chipField!]
            map.set(v === null || v === undefined || v === '' ? '' : String(v),
                (map.get(v === null || v === undefined || v === '' ? '' : String(v)) || 0) + 1)
        })
        return [...map.entries()].sort((a, b) => b[1] - a[1])
    }, [rows, tab.chipField])

    const shown = chip
        ? rows.filter(r => String(r[tab.chipField!] ?? '') === chip)
        : rows

    return (
        <>
            <p className="master-desc">{tab.desc}</p>

            <div className="master-actions">
                <span className="master-readonly">조회 전용</span>
                <button
                    className="btn-secondary"
                    onClick={() => downloadCsv(
                        `${tab.label}.csv`,
                        tab.cols.map(c => c.label),
                        shown.map(r => tab.cols.map(c => c.text(r))),
                    )}
                >
                    <Download size={15} /> 목록 내려받기
                </button>
                <p className="master-hint">
                    등록·수정은 현장 개설·근로자 배치 같은 업무 흐름 안에서 합니다.
                    여기서 고치면 누가 왜 바꿨는지 남지 않습니다.
                </p>
            </div>

            {chips.length > 1 && (
                <div className="master-chips">
                    <button
                        className={`master-chip ${chip === '' ? 'active' : ''}`}
                        onClick={() => setChip('')}
                    >
                        <span>전체</span>
                        <span className="master-chip-count">{rows.length}</span>
                    </button>
                    {chips.map(([k, n]) => (
                        <button
                            key={k || '_'}
                            className={`master-chip ${chip === k ? 'active' : ''}`}
                            onClick={() => setChip(k)}
                        >
                            <span>{tab.chipLabel ? tab.chipLabel(k) : (k || '미지정')}</span>
                            <span className="master-chip-count">{n}</span>
                        </button>
                    ))}
                </div>
            )}

            {loading ? <p className="muted">불러오는 중…</p> : <DataTable cols={tab.cols} rows={shown} />}
        </>
    )
}

/* ── 화면 ─────────────────────────────────────────────────── */
export default function Master() {
    const { show: showToast } = useToast()
    const [group, setGroup] = useState(GROUPS[0])
    const [tabKey, setTabKey] = useState('codes')
    const [data, setData] = useState<Record<string, any[]>>({})
    const [codeCount, setCodeCount] = useState(0)
    const [loading, setLoading] = useState(true)

    // 2차 탭에 건수를 함께 보여 주려면 켤 때 다 읽어야 한다.
    // 탭을 누를 때 읽으면 누르기 전에는 건수를 쓸 수 없다. 목록이 작아 한 번에 받는다.
    useEffect(() => {
        let alive = true
        Promise.all(TABS.map(async t => {
            try {
                const { data } = await apiClient.get(t.path)
                return [t.key, Array.isArray(data) ? data : []] as const
            } catch {
                return [t.key, null] as const
            }
        })).then(pairs => {
            if (!alive) return
            const next: Record<string, any[]> = {}
            const failed: string[] = []
            pairs.forEach(([k, v]) => {
                if (v === null) failed.push(TABS.find(t => t.key === k)!.label)
                else next[k] = v
            })
            setData(next)
            setLoading(false)
            if (failed.length) showToast(`${failed.join('·')} 조회에 실패했습니다.`, 'error')
        })
        return () => { alive = false }
    }, [showToast])

    const groupTabs = TABS.filter(t => t.group === group)
    const activeTab = TABS.find(t => t.key === tabKey)

    const selectGroup = (g: string) => {
        setGroup(g)
        // 1차 탭을 바꾸면 그 안의 첫 항목으로 옮긴다. 빈 화면이 남지 않게.
        setTabKey(g === GROUPS[0] ? 'codes' : TABS.find(t => t.group === g)!.key)
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">마스터</p>
                    <h1 className="master-title"><Settings size={22} /> 기준정보</h1>
                </div>
            </div>

            {/* 1차 탭 — 성격별 묶음 */}
            <nav className="master-tabs1">
                {GROUPS.map(g => (
                    <button
                        key={g}
                        className={`master-tab1 ${group === g ? 'active' : ''}`}
                        onClick={() => selectGroup(g)}
                    >
                        {g}
                    </button>
                ))}
            </nav>

            {/* 2차 탭 — 마스터별. 건수를 함께 보여 준다. */}
            <nav className="master-tabs2">
                {group === GROUPS[0] && (
                    <button
                        className={`master-tab2 ${tabKey === 'codes' ? 'active' : ''}`}
                        onClick={() => setTabKey('codes')}
                    >
                        <span>공통코드</span>
                        <span className="master-tab-count">{codeCount}</span>
                    </button>
                )}
                {groupTabs.map(t => (
                    <button
                        key={t.key}
                        className={`master-tab2 ${tabKey === t.key ? 'active' : ''}`}
                        onClick={() => setTabKey(t.key)}
                    >
                        <span>{t.label}</span>
                        <span className="master-tab-count">{data[t.key]?.length ?? 0}</span>
                    </button>
                ))}
            </nav>

            {tabKey === 'codes'
                ? <CodePanel onCount={setCodeCount} />
                : activeTab && (
                    <ReadonlyPanel
                        tab={activeTab}
                        rows={data[activeTab.key] || []}
                        loading={loading}
                    />
                )}
        </div>
    )
}
