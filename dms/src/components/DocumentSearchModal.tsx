import { useState } from 'react'
import { X, Search, Calendar, Tag } from 'lucide-react'
import './DocumentUploadModal.css'

export interface SearchFilters {
    search: string
    client: string
    projectYear: string
    category: string
    subCategory: string
    status: string
    officialName: string
    productionDate: string
    tags: string
    fileType: string
}

interface DocumentSearchModalProps {
    isOpen: boolean
    onClose: () => void
    onSearch: (filters: SearchFilters) => void
}

export default function DocumentSearchModal({ isOpen, onClose, onSearch }: DocumentSearchModalProps) {
    if (!isOpen) return null

    const [filters, setFilters] = useState<SearchFilters>({
        search: '',
        client: '',
        projectYear: '',
        category: '',
        subCategory: '',
        status: '전체',
        officialName: '',
        productionDate: '',
        tags: '',
        fileType: '전체'
    })

    const handleChange = (field: keyof SearchFilters, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }))
    }

    const handleSearch = () => {
        onSearch(filters)
        onClose()
    }

    const handleReset = () => {
        setFilters({
            search: '',
            client: '',
            projectYear: '',
            category: '',
            subCategory: '',
            status: '전체',
            officialName: '',
            productionDate: '',
            tags: '',
            fileType: '전체'
        })
    }

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '700px', height: 'auto', maxHeight: '95vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <div className="header-title-group">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={22} color="#1c7ed6" />
                            <h2>통합 문서 상세 검색</h2>
                        </div>
                        <span className="header-sub">전체 프로젝트를 대상으로 정밀 검색을 수행합니다.</span>
                    </div>
                    <button onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="meta-form">
                        {/* 기본 검색 */}
                        <div className="form-group">
                            <label>문서 제목 / 핵심 키워드</label>
                            <div className="input-with-icon">
                                <Search size={16} />
                                <input
                                    type="text"
                                    className="input-std"
                                    placeholder="검색어를 입력하세요 (예: 위험성평가, 도면...)"
                                    value={filters.search}
                                    onChange={e => handleChange('search', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group-row">
                            <div className="form-group">
                                <label>고객사 (발주처)</label>
                                <input
                                    type="text"
                                    className="input-std"
                                    placeholder="고객사명 입력"
                                    value={filters.client}
                                    onChange={e => handleChange('client', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>프로젝트 시작 년도</label>
                                <select className="input-std" value={filters.projectYear} onChange={e => handleChange('projectYear', e.target.value)}>
                                    <option value="">전체 연도</option>
                                    {[2026, 2025, 2024, 2023, 2022].map(y => (
                                        <option key={y} value={y.toString()}>{y}년</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group-row">
                            <div className="form-group">
                                <label>공종 (대분류)</label>
                                <input
                                    type="text"
                                    className="input-std"
                                    placeholder="공종명 입력"
                                    value={filters.category}
                                    onChange={e => handleChange('category', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>하위 공종</label>
                                <input
                                    type="text"
                                    className="input-std"
                                    placeholder="하위 공종명 입력"
                                    value={filters.subCategory}
                                    onChange={e => handleChange('subCategory', e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ borderTop: '1px dashed #2d3139', margin: '20px 0', paddingTop: '20px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#1c7ed6', fontWeight: 700, marginBottom: '12px', display: 'block' }}>정밀 메타데이터 검색</span>
                            
                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>공식 문서명</label>
                                    <input
                                        type="text"
                                        className="input-std"
                                        placeholder="공식 명칭 입력"
                                        value={filters.officialName}
                                        onChange={e => handleChange('officialName', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>작성년월 (생산년월)</label>
                                    <div className="input-with-icon">
                                        <Calendar size={16} />
                                        <input
                                            type="month"
                                            className="input-std"
                                            value={filters.productionDate}
                                            onChange={e => handleChange('productionDate', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>해시태그 (# 검색어)</label>
                                <div className="input-with-icon">
                                    <Tag size={16} />
                                    <input
                                        type="text"
                                        className="input-std"
                                        placeholder="태그 입력 (콤마로 구분)"
                                        value={filters.tags}
                                        onChange={e => handleChange('tags', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group-row" style={{ background: 'rgba(28, 126, 214, 0.05)', padding: '15px', borderRadius: '8px' }}>
                            <div className="form-group">
                                <label>진행 상태 (추천)</label>
                                <select className="input-std" value={filters.status} onChange={e => handleChange('status', e.target.value)}>
                                    <option value="전체">전체 상태</option>
                                    <option value="초안작성">초안작성</option>
                                    <option value="작성중">작성중</option>
                                    <option value="최종제출">최종제출</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>파일 유형 (추천)</label>
                                <select className="input-std" value={filters.fileType} onChange={e => handleChange('fileType', e.target.value)}>
                                    <option value="전체">전체 파일</option>
                                    <option value="PDF">PDF</option>
                                    <option value="이미지">이미지 (JPG, PNG...)</option>
                                    <option value="워드">워드 (DOCX)</option>
                                    <option value="엑셀">엑셀 (XLSX)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-actions" style={{ marginTop: '2rem' }}>
                            <button onClick={handleReset} className="btn-cancel">초기화</button>
                            <button onClick={handleSearch} className="btn-submit" style={{ padding: '0.8rem 2.5rem' }}>
                                <Search size={18} style={{ marginRight: 8 }} />
                                통합 검색 실행
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
