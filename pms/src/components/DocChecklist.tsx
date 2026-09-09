import { useCallback, useEffect, useState } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, RefreshCw, Check } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useToast } from './ToastProvider'
import './DocChecklist.css'

// 프로젝트 문서 체크리스트.
//
// 무엇을 내야 하고 그 양식이 무엇인지 한 화면에서 본다.
// 프로젝트를 먼저 열고 양식은 정해지는 대로 행마다 붙인다.
//
// 체크리스트 출처
//   발주처 프로파일 > 크로스 기본. 신규 발주처라 프로파일이 없어도
//   기본 목록으로 착수할 수 있어야 한다.
//
// 양식 출처
//   현장 전용 > 발주처 > 기본. 어느 것이 걸렸는지 화면에 같이 표시한다.
//   감추면 "왜 이 양식이 나오지?" 를 확인할 방법이 없다.

// 데이터를 채워 출력하는 양식. 열 매핑을 확인해야 해서 여기서 올리지 않는다.
const RENDERABLE = ['RA', 'TBM']

interface Item {
    id: number
    scope: string
    doc_type_code: string | null
    doc_type_name: string | null
    doc_label: string | null
    category_code: string | null
    is_required: boolean
    is_personal_data: boolean | null
    require_approval: boolean | null
    template_id: number | null
    template_name: string | null
    template_source: 'PROJECT' | 'CLIENT' | 'DEFAULT' | null
    engine: string | null
    storage_key: string | null
}

interface Result {
    project: { id: string; code: string; name: string; client_id: number | null }
    profile: { id: number; profile_name: string; client_id: number | null } | null
    source: 'CLIENT' | 'DEFAULT' | 'NONE'
    items: Item[]
}

const SOURCE_LABEL: Record<string, string> = {
    PROJECT: '현장 전용',
    CLIENT: '발주처',
    DEFAULT: '기본',
}

const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] || '')
        r.onerror = reject
        r.readAsDataURL(file)
    })

export default function DocChecklist({ projectId }: { projectId: string }) {
    const { show } = useToast()
    const [data, setData] = useState<Result | null>(null)
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<number | null>(null)

    const load = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        try {
            const res = await apiClient.get<Result>(`/master/projects/${projectId}/doc-checklist`)
            setData(res.data)
        } catch {
            show('문서 체크리스트를 불러오지 못했습니다.', 'error')
            setData(null)
        } finally {
            setLoading(false)
        }
    }, [projectId, show])

    useEffect(() => { load() }, [load])

    const upload = async (item: Item, file: File) => {
        if (!item.doc_type_code) return
        setBusyId(item.id)
        try {
            const fileBase64 = await fileToBase64(file)
            await apiClient.post('/master/doc-templates', {
                docTypeCode: item.doc_type_code,
                name: item.doc_label || item.doc_type_name,
                projectId,                       // 이 현장 전용으로 등록한다
                fileBase64,
                fileName: file.name,
            })
            show('양식을 등록했습니다.', 'success')
            await load()
        } catch (e: any) {
            show(e?.response?.data?.error || '양식 등록에 실패했습니다.', 'error')
        } finally {
            setBusyId(null)
        }
    }

    if (loading) return <p className="dc-muted">문서 체크리스트를 불러오는 중…</p>
    if (!data) return null

    if (data.source === 'NONE') {
        return <p className="dc-muted">적용할 문서 체크리스트가 없습니다.</p>
    }

    const total = data.items.length
    const done = data.items.filter(i => i.template_id).length
    const missingRequired = data.items.filter(i => i.is_required && !i.template_id).length

    // 대분류로 묶어 보여 준다. 문서 분류 체계는 DMS 폴더와 같다.
    const groups: { key: string; items: Item[] }[] = []
    data.items.forEach(i => {
        const k = i.category_code || '99_미분류'
        const g = groups.find(x => x.key === k)
        if (g) g.items.push(i)
        else groups.push({ key: k, items: [i] })
    })

    return (
        <div className="dc">
            <div className="dc-head">
                <div>
                    <p className="dc-title">표준문서 체크리스트</p>
                    <p className="dc-sub">
                        {data.source === 'CLIENT'
                            ? `발주처 프로파일 · ${data.profile?.profile_name}`
                            : `발주처 미지정 — 크로스 기본 프로파일을 적용했습니다`}
                    </p>
                </div>
                <div className="dc-head-right">
                    <span className="dc-count">양식 {done} / {total}</span>
                    {missingRequired > 0 && (
                        <span className="dc-warn">
                            <AlertTriangle size={14} /> 필수 {missingRequired}건 미등록
                        </span>
                    )}
                    <button className="dc-icon" onClick={load} title="새로고침">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* 대분류마다 표를 따로 그리면 표마다 열 너비를 제각각 계산해
                열이 좌우로 어긋난다. 표 하나에 구분줄만 끼워 넣는다. */}
            <table className="dc-table">
                <colgroup>
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 60 }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: 150 }} />
                </colgroup>
                <thead>
                    <tr>
                        <th>문서</th>
                        <th>구분</th>
                        <th>필수</th>
                        <th>양식</th>
                        <th>등록</th>
                    </tr>
                </thead>
                {groups.map(g => (
                    <tbody key={g.key}>
                        <tr className="dc-group-row">
                            <td colSpan={5}>{g.key}</td>
                        </tr>
                        {g.items.map(item => {
                                const renderable = item.doc_type_code && RENDERABLE.includes(item.doc_type_code)
                                return (
                                    <tr key={item.id}>
                                        <td>
                                            {item.doc_label || item.doc_type_name}
                                            {item.is_personal_data && (
                                                <span className="dc-tag dc-tag-warn">개인정보</span>
                                            )}
                                        </td>
                                        <td className="dc-dim">{item.scope}</td>
                                        <td>{item.is_required
                                            ? <span className="dc-tag dc-tag-req">필수</span>
                                            : <span className="dc-dim">선택</span>}</td>
                                        <td>
                                            {item.template_id ? (
                                                <>
                                                    <FileSpreadsheet size={13} className="dc-ok-icon" />
                                                    <span className="dc-tpl">{item.template_name}</span>
                                                    <span className="dc-src">
                                                        {SOURCE_LABEL[item.template_source || ''] || ''}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className={item.is_required ? 'dc-missing' : 'dc-dim'}>
                                                    미등록
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {renderable ? (
                                                // 데이터를 채워 출력하는 양식은 열 매핑을 확인해야 한다.
                                                // 파일만 올려 두면 출력이 어긋난다.
                                                <span className="dc-dim dc-hint">
                                                    안전관리 &gt; 마스터에서 등록
                                                </span>
                                            ) : (
                                                <label className="dc-upload">
                                                    {busyId === item.id
                                                        ? <><Check size={13} /> 올리는 중</>
                                                        : <><Upload size={13} /> 양식 올리기</>}
                                                    <input
                                                        type="file"
                                                        style={{ display: 'none' }}
                                                        disabled={busyId === item.id}
                                                        onChange={e => {
                                                            const f = e.target.files?.[0]
                                                            if (f) upload(item, f)
                                                            e.target.value = ''
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </td>
                                    </tr>
                            )
                        })}
                    </tbody>
                ))}
            </table>

            <p className="dc-foot">
                여기서 올린 양식은 <strong>이 현장 전용</strong>으로 등록됩니다.
                같은 발주처의 모든 현장에 쓸 양식은 안전관리 &gt; 마스터에서 발주처를 지정해 등록하십시오.
            </p>
        </div>
    )
}
