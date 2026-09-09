import { useCallback, useEffect, useState } from 'react'
import { Plus, Check, Pencil, Download, RefreshCw, Database } from 'lucide-react'
import { useToast } from './ToastProvider'
import { apiClient } from '../lib/api'
import './ClientPanel.css'

// 발주처 마스터.
//
// 왜 PMS 에 두는가
//   발주처는 프로젝트의 상위 개념이고 수주·계약 흐름이 PMS 에 있다.
//   안전관리(SMS)가 발주처를 만드는 것은 자리가 맞지 않는다.
//   다른 모듈은 조회만 한다.
//
// 신규 발주처는 이름만 있으면 착수할 수 있어야 한다. 양식·필수서류
// 프로파일·위치 코드가 없어도 전부 기본값으로 동작하도록 설계돼 있다.
// 등록해 두면 프로젝트에 지정할 수 있고, 그 순간부터 양식(현장 전용 >
// 발주처 > 기본)과 필수서류 체크리스트가 따라온다.

interface Client {
    id: number
    client_code: string | null
    name: string
    short_name: string | null
    regulation_type: string | null
    memo: string | null
    profile_count: number
}

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

export default function ClientPanel() {
    const { show: showToast } = useToast()
    const [list, setList] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [adding, setAdding] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [form, setForm] = useState({ clientCode: '', name: '', shortName: '', regulationType: '' })

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await apiClient.get<Client[]>('/master/clients')
            setList(data)
        } catch {
            showToast('발주처를 불러오지 못했습니다.', 'error')
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => { load() }, [load])

    const reset = () => {
        setForm({ clientCode: '', name: '', shortName: '', regulationType: '' })
        setAdding(false)
        setEditId(null)
    }

    const save = async () => {
        if (!form.name.trim()) {
            showToast('발주처명을 입력하십시오.', 'warning')
            return
        }
        setBusy(true)
        try {
            const body = {
                clientCode: form.clientCode.trim() || null,
                name: form.name.trim(),
                shortName: form.shortName.trim() || null,
                regulationType: form.regulationType.trim() || null,
            }
            if (editId) await apiClient.patch(`/master/clients/${editId}`, body)
            else await apiClient.post('/master/clients', body)
            showToast(editId ? '수정했습니다.' : '발주처를 등록했습니다.', 'success')
            reset()
            await load()
        } catch (e: any) {
            showToast(e?.response?.data?.error || '저장에 실패했습니다.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const startEdit = (c: Client) => {
        setEditId(c.id)
        setAdding(false)
        setForm({
            clientCode: c.client_code || '',
            name: c.name,
            shortName: c.short_name || '',
            regulationType: c.regulation_type || '',
        })
    }

    const csv = () => {
        const rows = [['코드', '발주처명', '약칭', '규제 유형', '프로파일']]
            .concat(list.map(c => [
                dash(c.client_code), c.name, dash(c.short_name),
                dash(c.regulation_type), String(c.profile_count ?? 0),
            ]))
        const body = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n')
        const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' }))
        const a = document.createElement('a')
        a.href = url; a.download = '발주처.csv'; a.click()
        URL.revokeObjectURL(url)
    }

    const editing = adding || editId !== null

    return (
        <>
            <p className="cp-desc">
                발주처별 코드 체계와 필수서류 프로파일의 기준이 됩니다.
                신규 발주처는 이름만 등록해 두면 착수할 수 있습니다.
                양식·필수서류가 없으면 크로스 기본값으로 동작합니다.
            </p>

            <div className="cp-actions">
                {editing ? (
                    <>
                        <input className="cp-input" placeholder="코드 (예: SS)" value={form.clientCode}
                            onChange={e => setForm({ ...form, clientCode: e.target.value })} style={{ width: 110 }} />
                        <input className="cp-input" placeholder="발주처명" value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: 200 }} />
                        <input className="cp-input" placeholder="약칭" value={form.shortName}
                            onChange={e => setForm({ ...form, shortName: e.target.value })} style={{ width: 120 }} />
                        <input className="cp-input" placeholder="규제 유형" value={form.regulationType}
                            onChange={e => setForm({ ...form, regulationType: e.target.value })} style={{ width: 140 }} />
                        <button className="cp-btn cp-btn-primary" onClick={save} disabled={busy}>
                            <Check size={15} /> {editId ? '저장' : '등록'}
                        </button>
                        <button className="cp-btn" onClick={reset} disabled={busy}>취소</button>
                    </>
                ) : (
                    <>
                        <button className="cp-btn cp-btn-primary" onClick={() => setAdding(true)}>
                            <Plus size={15} /> 발주처 등록
                        </button>
                        <button className="cp-btn" onClick={csv}>
                            <Download size={15} /> 목록 내려받기
                        </button>
                        <button className="cp-icon" onClick={load} title="새로고침">
                            <RefreshCw size={15} />
                        </button>
                        <p className="cp-hint">
                            발주처를 등록하면 프로젝트에 지정할 수 있고, 그때부터 양식과 필수서류가 따라옵니다.
                        </p>
                    </>
                )}
            </div>

            {loading ? <p className="cp-dim">불러오는 중…</p> : list.length === 0 ? (
                <div className="cp-empty">
                    <Database className="cp-empty-icon" size={28} />
                    <p className="cp-dim">등록된 발주처가 없습니다.</p>
                </div>
            ) : (
                <div className="cp-scroll">
                    <table className="cp-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 110 }}>코드</th>
                                <th>발주처명</th>
                                <th style={{ width: 120 }}>약칭</th>
                                <th style={{ width: 140 }}>규제 유형</th>
                                <th style={{ width: 90, textAlign: 'right' }}>프로파일</th>
                                <th style={{ width: 70 }}>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((c, i) => (
                                <tr key={c.id}>
                                    <td className="cp-dim">{i + 1}</td>
                                    <td>{dash(c.client_code)}</td>
                                    <td>{c.name}</td>
                                    <td>{dash(c.short_name)}</td>
                                    <td>{dash(c.regulation_type)}</td>
                                    <td className="cp-num">
                                        {c.profile_count
                                            ? c.profile_count
                                            // 프로파일이 없으면 크로스 기본 체크리스트를 쓴다.
                                            : <span className="cp-dim">기본</span>}
                                    </td>
                                    <td>
                                        <div className="cp-rowact">
                                            <button className="cp-icon" onClick={() => startEdit(c)} title="수정">
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
        </>
    )
}
