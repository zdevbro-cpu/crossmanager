import { useState, useRef } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import type { SearchFilters } from './DocumentSearchModal'

// 문서 검색 필터.
//
// 왜 모달이 아닌가
//   모달로 두면 무엇을 걸어 두고 보는지 화면에서 사라진다. 결과만 남고
//   조건은 안 보여, 조건 하나를 바꾸려면 모달을 다시 열어 전부 다시 봐야 한다.
//   화면에 붙여 두면 지금 걸린 조건이 늘 보이고 한 칸만 고쳐 다시 찾는다.
//
// 접지도 않는다. 접어 두면 결국 모달과 같아진다.
//
// 여기 항목은 서버가 실제로 거르는 것만 둔다. 걸리지 않는 칸을 두면
// 값을 넣어도 결과가 그대로라 사람이 원인을 찾지 못한다.

const CATEGORIES = ['00_공무_행정', '01_안전_보건', '02_공사_작업', '03_장비_공도구', '04_기록_자료']
const STATUSES = ['전체', '작성중', '검토중', '최종제출', '승인']

const EMPTY: SearchFilters = {
    search: '', client: '', projectYear: '', category: '', subCategory: '',
    status: '전체', officialName: '', productionDate: '', tags: '', fileType: '전체',
}

interface Props {
    onSearch: (filters: SearchFilters) => void
    onClear: () => void
    resultCount: number | null
}

export default function DocumentSearchBar({ onSearch, onClear, resultCount }: Props) {
    const [f, setF] = useState<SearchFilters>(EMPTY)
    const firstRef = useRef<HTMLInputElement>(null)

    // 헤더의 「문서 검색」은 여닫을 것이 없으므로 검색어 칸으로 보내기만 한다.
    ;(window as any).openGlobalSearch = () => firstRef.current?.focus()

    const set = (k: keyof SearchFilters, v: string) => setF(prev => ({ ...prev, [k]: v }))

    // 지금 몇 개를 걸고 보는지 세어 준다.
    const activeCount = (Object.keys(EMPTY) as (keyof SearchFilters)[])
        .filter(k => f[k] && f[k] !== EMPTY[k]).length

    const reset = () => {
        setF(EMPTY)
        onClear()
    }

    return (
        <section className="doc-filter">
            {/* 두 줄 · 한 줄에 다섯 칸.
                칸마다 폭을 따로 주면 화면 폭이 바뀔 때 줄 끝이 들쭉날쭉해진다.
                같은 너비의 5열 그리드로 두면 두 줄의 오른쪽 끝이 맞는다.
                라벨을 위에 쌓으면 네 줄을 먹으므로 placeholder 로 대신한다. */}
            <div className="doc-filter-head">
                <span className="doc-filter-title">
                    <Search size={15} /> 문서 검색
                </span>
                {activeCount > 0 && <span className="doc-filter-badge">조건 {activeCount}</span>}
                {resultCount !== null && <span className="doc-filter-badge">결과 {resultCount}건</span>}
                <span className="doc-filter-hint">
                    선택한 프로젝트에 매이지 않습니다. 전 현장·본사 문서를 함께 찾습니다.
                </span>
            </div>

            <div className="doc-filter-grid">
                <input
                    ref={firstRef}
                    className="input-std"
                    title="검색어 — 문서명·내용"
                    value={f.search}
                    onChange={e => set('search', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onSearch(f) }}
                    placeholder="검색어 (문서명·내용)"
                />
                <select className="input-std" title="대분류"
                    value={f.category} onChange={e => set('category', e.target.value)}>
                    <option value="">대분류 전체</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="input-std" title="중분류" placeholder="중분류"
                    value={f.subCategory} onChange={e => set('subCategory', e.target.value)} />
                <select className="input-std" title="상태"
                    value={f.status} onChange={e => set('status', e.target.value)}>
                    {STATUSES.map(s2 => <option key={s2} value={s2}>{s2 === '전체' ? '상태 전체' : s2}</option>)}
                </select>
                <input className="input-std" title="공식 문서명" placeholder="공식 문서명"
                    value={f.officialName} onChange={e => set('officialName', e.target.value)} />

                <input className="input-std" title="고객사" placeholder="고객사"
                    value={f.client} onChange={e => set('client', e.target.value)} />
                <input className="input-std" type="date" title="작성일"
                    value={f.productionDate} onChange={e => set('productionDate', e.target.value)} />
                <input className="input-std" title="사업연도" placeholder="사업연도 (예: 2026)"
                    value={f.projectYear} onChange={e => set('projectYear', e.target.value)} />
                <input className="input-std" title="태그" placeholder="태그"
                    value={f.tags} onChange={e => set('tags', e.target.value)} />

                <div className="doc-filter-actions">
                    <button className="doc-filter-btn primary" onClick={() => onSearch(f)}>
                        <Search size={15} /> 검색
                    </button>
                    <button className="doc-filter-btn" onClick={reset} title="조건 초기화">
                        <RotateCcw size={15} /> 초기화
                    </button>
                </div>
            </div>
        </section>
    )
}
