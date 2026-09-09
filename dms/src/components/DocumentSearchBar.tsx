import { useState } from 'react'
import { Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { SearchFilters } from './DocumentSearchModal'

// 문서 검색 필터.
//
// 왜 모달이 아닌가
//   모달로 두면 무엇을 걸어 두고 보는지 화면에서 사라진다. 결과만 남고
//   조건은 안 보여, 조건 하나를 바꾸려면 모달을 다시 열어 전부 다시 봐야 한다.
//   필터를 화면에 붙여 두면 지금 걸린 조건이 늘 보이고 한 칸만 고쳐 다시 찾는다.
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
    open: boolean
    onToggle: () => void
    onSearch: (filters: SearchFilters) => void
    onClear: () => void
    resultCount: number | null
}

export default function DocumentSearchBar({ open, onToggle, onSearch, onClear, resultCount }: Props) {
    const [f, setF] = useState<SearchFilters>(EMPTY)

    const set = (k: keyof SearchFilters, v: string) => setF(prev => ({ ...prev, [k]: v }))

    // 지금 걸려 있는 조건을 세어 접었을 때도 보여 준다.
    const activeCount = (Object.keys(EMPTY) as (keyof SearchFilters)[])
        .filter(k => f[k] && f[k] !== EMPTY[k]).length

    const reset = () => {
        setF(EMPTY)
        onClear()
    }

    return (
        <section className="doc-filter">
            <button className="doc-filter-head" onClick={onToggle}>
                <Search size={16} />
                <span>문서 검색</span>
                {activeCount > 0 && <span className="doc-filter-badge">조건 {activeCount}</span>}
                {resultCount !== null && <span className="doc-filter-badge">결과 {resultCount}건</span>}
                <span className="doc-filter-chev">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            </button>

            {open && (
                <>
                    <div className="doc-filter-grid">
                        <label>
                            <span>검색어</span>
                            <input
                                className="input-std"
                                value={f.search}
                                onChange={e => set('search', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') onSearch(f) }}
                                placeholder="문서명·내용"
                            />
                        </label>
                        <label>
                            <span>대분류</span>
                            <select className="input-std" value={f.category} onChange={e => set('category', e.target.value)}>
                                <option value="">전체</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>중분류</span>
                            <input className="input-std" value={f.subCategory}
                                onChange={e => set('subCategory', e.target.value)} placeholder="예: 01_사업자_면허" />
                        </label>
                        <label>
                            <span>상태</span>
                            <select className="input-std" value={f.status} onChange={e => set('status', e.target.value)}>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>공식 문서명</span>
                            <input className="input-std" value={f.officialName}
                                onChange={e => set('officialName', e.target.value)} />
                        </label>
                        <label>
                            <span>고객사</span>
                            <input className="input-std" value={f.client}
                                onChange={e => set('client', e.target.value)} />
                        </label>
                        <label>
                            <span>작성일</span>
                            <input className="input-std" type="date" value={f.productionDate}
                                onChange={e => set('productionDate', e.target.value)} />
                        </label>
                        <label>
                            <span>사업연도</span>
                            <input className="input-std" value={f.projectYear}
                                onChange={e => set('projectYear', e.target.value)} placeholder="예: 2026" />
                        </label>
                        <label>
                            <span>태그</span>
                            <input className="input-std" value={f.tags}
                                onChange={e => set('tags', e.target.value)} />
                        </label>
                    </div>

                    <div className="doc-filter-actions">
                        <button className="doc-filter-btn primary" onClick={() => onSearch(f)}>
                            <Search size={15} /> 검색
                        </button>
                        <button className="doc-filter-btn" onClick={reset}>
                            <RotateCcw size={15} /> 초기화
                        </button>
                        <span className="doc-filter-hint">
                            검색은 선택한 프로젝트에 매이지 않습니다. 전 현장·본사 문서를 함께 찾습니다.
                        </span>
                    </div>
                </>
            )}
        </section>
    )
}
