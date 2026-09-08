import { useState } from 'react'
import {
    LayoutGrid, List, Search, Plus, FileText,
    Folder, FolderOpen, ChevronRight, ChevronDown, RefreshCw, X, MoreVertical, CheckSquare, Settings, Download, Forward
} from 'lucide-react'
import './DMSDashboard.css'
import DocumentUploadModal from '../components/DocumentUploadModal'

// Tree Node Component matches screenshot's sidebar
const TreeNode = ({ label, count, children, isOpen, isActive, onToggle, onClick }: any) => {
    return (
        <div className="tree-container">
            <div className={`tree-node ${isActive ? 'active' : ''}`} onClick={onClick}>
                <div className="tree-toggle" onClick={(e) => { e.stopPropagation(); onToggle?.(); }}>
                    {children ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : <span style={{ width: 14 }} />}
                </div>
                {isOpen || isActive ? <FolderOpen size={16} className="tree-icon" /> : <Folder size={16} className="tree-icon" />}
                <span className="tree-label">{label}</span>
                {count !== undefined && <span style={{ fontSize: '0.75rem', color: '#868e96', marginLeft: 'auto' }}>{count}</span>}
            </div>
            {isOpen && children && (
                <div className="tree-children">
                    {children}
                </div>
            )}
        </div>
    )
}

export default function DMSDashboard() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [selectedDoc, setSelectedDoc] = useState<any>(null)
    const [filterClient, setFilterClient] = useState(false)

    // Tree State
    const [expandedNodes, setExpandedNodes] = useState<string[]>(['root-00', 'root-01'])
    const [activeNode, setActiveNode] = useState<string>('root-00')

    const toggleNode = (id: string) => {
        setExpandedNodes(prev =>
            prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
        )
    }

    // Docs Data matching screenshot
    const docs = [
        {
            id: 'd1', title: '사업자등록증_2025.jpg', desc: '삼성물산등록증', size: '500 KB', date: '2025-01-01',
            type: 'image', client: true, status: 'approved'
        },
        {
            id: 'd2', title: '착공계_서류_일체.zip', desc: '삼성물산계획서', size: '15 MB', date: '2026-01-10',
            type: 'zip', client: true, status: 'pending'
        },
        {
            id: 'd3', title: '현장대리인_선임계.jpg', desc: '삼성물산공문', size: '2 MB', date: '2026-01-11',
            type: 'image', client: false, status: 'approved'
        },
        {
            id: 'd4', title: '건설기술인_경력증명서.pdf', desc: '삼성물산증명서', size: '1 MB', date: '2026-01-12',
            type: 'pdf', client: true, status: 'approved'
        },
    ]

    return (
        <div className="dms-dashboard">
            {/* 1. Header with User Profile (Simulated) */}
            <header className="dash-header">
                <div>
                    <div className="dash-eyebrow">문서 관리 시스템</div>
                    <h1 className="dash-title">프로젝트 통합 문서관리</h1>
                    <p className="dash-desc">서초동 사옥의 문서를 중앙에서 통합 관리하고 발주처 제출을 자동화합니다.</p>
                </div>
                <div className="dash-actions">
                    <button className="btn-secondary">새로고침</button>
                    <button className="btn-primary" onClick={() => setIsUploadOpen(true)}>문서 등록</button>
                </div>
            </header>

            {/* 2. Main Layout Split */}
            <div className="content-split">
                {/* Left Sidebar: 문서 탐색기 */}
                <aside className="nav-panel card">
                    <div className="panel-header">
                        <h3>문서 탐색기</h3>
                    </div>

                    <div className="sidebar-section">
                        <label className="sidebar-label">프로젝트 선택</label>
                        <select className="project-select">
                            <option>서초동 사옥 (PJ-001)</option>
                            <option>파주 LGD 라인 철거</option>
                        </select>
                    </div>

                    <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <label className="sidebar-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            공종별 분류 <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>(우클릭하여 관리)</span>
                        </label>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <TreeNode
                                label="00_공무_행정"
                                isOpen={expandedNodes.includes('root-00')}
                                onToggle={() => toggleNode('root-00')}
                                isActive={activeNode === 'root-00'}
                                onClick={() => setActiveNode('root-00')}
                            >
                                <TreeNode label="01_사업자_현황" count={1} />
                                <TreeNode label="02_계약_서약" count={1} />
                                <TreeNode label="03_선임_조직" count={1} />
                                <TreeNode label="04_인력_출역" count={1} />
                                <TreeNode label="05_내역_정산" count={0} />
                            </TreeNode>

                            <TreeNode
                                label="01_안전_보건"
                                isOpen={expandedNodes.includes('root-01')}
                                onToggle={() => toggleNode('root-01')}
                            >
                                <TreeNode label="01_안전교육" count={1} />
                                <TreeNode label="02_위험성평가" count={1} />
                                <TreeNode label="03_안전점검" count={0} />
                                <TreeNode label="04_TBM_회의" count={1} />
                                <TreeNode label="05_보호구_장구" count={0} />
                                <TreeNode label="06_산업보건" count={0} />
                                <TreeNode label="07_사고_재해" count={0} />
                            </TreeNode>

                            <TreeNode className="inactive" label="02_공사_작업" isOpen={false} />
                            <TreeNode className="inactive" label="03_장비_공도구" isOpen={false} />
                            <TreeNode className="inactive" label="04_기록_자료" isOpen={false} />
                        </div>
                    </div>

                    <div className="sidebar-footer">
                        <label className="sidebar-label">발주처 대응 관리</label>
                        <div className="client-filter" onClick={() => setFilterClient(!filterClient)}>
                            <div style={{
                                width: 16, height: 16, borderRadius: 3, border: '1px solid #adb5bd',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: filterClient ? '#4dabf7' : 'transparent',
                                borderColor: filterClient ? '#4dabf7' : '#adb5bd'
                            }}>
                                {filterClient && <CheckSquare size={12} color="white" />}
                            </div>
                            <label>제출용 문서만 모아보기</label>
                        </div>
                    </div>
                </aside>

                {/* Center Panel: Content */}
                <main className="doc-panel card">
                    <div className="panel-header action-header">
                        <div className="header-breadcrumbs">
                            <span>서초동 사옥</span> <ChevronRight size={14} />
                            <span style={{ color: '#fff' }}>00_공무_행정</span>
                        </div>
                        <div className="header-tools">
                            <div className="search-wrap">
                                <Search size={16} />
                                <input placeholder="문서 검색..." />
                            </div>
                            <button className="btn-secondary">상세 검색</button>
                            <div className="view-toggles">
                                <button className={`btn-mode ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /></button>
                                <button className={`btn-mode ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={16} /></button>
                            </div>
                        </div>
                    </div>

                    {/* New Doc Button Floating in Center Panel (as per screenshot) is actually in header, but user screenshot shows a button in empty space or toolbar. 
                       Actually screenshot shows '새 문서 등록' blue button in the content area toolbar or somewhere? 
                       Wait, screenshot shows "새 문서 등록" is floating right aligned in a secondary toolbar inside the panel?
                       In screenshot, under "서초동 사옥 > 00_공무_행정", there is a black bar with "새 문서 등록" button on the right.
                       Let's mimic that.
                    */}
                    <div style={{ padding: '0 1.25rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '20px' }} onClick={() => setIsUploadOpen(true)}>
                            <RefreshCw size={14} style={{ marginRight: 8 }} /> 새 문서 등록
                        </button>
                    </div>


                    <div className={`doc-container ${viewMode}`}>
                        {docs.map(doc => (
                            <div
                                key={doc.id}
                                className={`doc-item ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
                                onClick={() => setSelectedDoc(doc)}
                            >
                                {/* Badges */}
                                {doc.client && <div className="badge-client">제출용</div>}
                                <button className="card-ctx-btn"><MoreVertical size={16} /></button>

                                {/* Visual */}
                                <div className="doc-visual">
                                    <FileText size={32} color={doc.type === 'pdf' ? '#ff6b6b' : doc.type === 'xls' || doc.type === 'zip' ? '#20c997' : '#4dabf7'} />
                                </div>

                                {/* Content */}
                                <div className="doc-details">
                                    <div className="doc-title" style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{doc.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#dee2e6', marginBottom: '0.5rem' }}>{doc.desc}</div>
                                    <div className="doc-sub">
                                        <span>{doc.date}</span>
                                        <span>{doc.size}</span>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className={`badge-status ${doc.status === 'approved' ? 'approved' : 'pending'}`}>
                                    {doc.status === 'approved' ? '승인완료' : '결재중'}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                {/* Right Panel: Detail */}
                {selectedDoc && (
                    <aside className="detail-panel">
                        <div className="detail-header" style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>문서 상세 정보</span>
                            <button onClick={() => setSelectedDoc(null)} style={{ background: 'none', border: 'none', color: '#868e96', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div className="detail-content">
                            {/* Preview */}
                            <div className="detail-preview" style={{ background: '#fff', position: 'relative' }}>
                                <div className="preview-placeholder pdf">
                                    <FileText size={48} color="#fa5252" />
                                    <p style={{ color: '#fa5252', marginTop: '1rem', fontWeight: 600 }}>PDF 미리보기</p>
                                    <span style={{
                                        marginTop: '0.5rem', background: '#f1f3f5', padding: '4px 12px', borderRadius: '12px',
                                        fontSize: '0.8rem', color: '#868e96'
                                    }}>1 / 15 Pages</span>
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="detail-title">{docTitle(selectedDoc.title)}</h3>

                            {/* Meta Grid */}
                            <div className="detail-meta-grid">
                                <div className="meta-item">
                                    <label>문서 유형</label>
                                    <span>{getDocTypeLabel(selectedDoc.type)}</span>
                                </div>
                                <div className="meta-item">
                                    <label>등록일</label>
                                    <span>{selectedDoc.date}</span>
                                </div>
                                <div className="meta-item">
                                    <label>파일 크기</label>
                                    <span>{selectedDoc.size}</span>
                                </div>
                                <div className="meta-item">
                                    <label>작성자</label>
                                    <span>삼성물산</span>
                                </div>
                            </div>

                            <div className="meta-item" style={{ marginBottom: '2rem' }}>
                                <label>상태</label>
                                <span style={{
                                    display: 'inline-block', marginTop: '4px',
                                    color: selectedDoc.status === 'approved' ? '#40c057' : '#fab005',
                                    background: selectedDoc.status === 'approved' ? 'rgba(64,192,87,0.1)' : 'rgba(250,176,5,0.1)',
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, width: 'fit-content'
                                }}>
                                    {selectedDoc.status === 'approved' ? '승인완료' : '결재중'}
                                </span>
                            </div>

                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.85rem', color: '#dee2e6' }}>부속 서류 (Attachments)</label>
                                <span className="count-badge">0</span>
                            </div>
                            <div style={{
                                padding: '1rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px',
                                textAlign: 'center', fontSize: '0.8rem', color: '#495057', marginBottom: 'auto'
                            }}>
                                등록된 부속 서류가 없습니다.
                            </div>


                            <div className="detail-actions" style={{ gap: '0.75rem' }}>
                                <button className="btn-secondary full" style={{ justifyContent: 'center' }}>
                                    <Download size={16} /> 다운로드
                                </button>
                                <button className="btn-primary full" style={{ justifyContent: 'center', background: '#339af0' }}>
                                    결재/승인 요청
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            <DocumentUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
            />
        </div>
    )
}

// Helpers
function getDocTypeLabel(type: string) {
    if (type === 'pdf') return '증명서' // Matching screenshot
    if (type === 'zip') return '압축파일'
    if (type === 'image') return '이미지'
    return '일반문서'
}

function docTitle(filename: string) {
    return filename.split('.')[0]
}
