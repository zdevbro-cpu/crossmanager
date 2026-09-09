import { useState, useMemo, useEffect, useRef } from 'react'
import { useProjectContext } from '../context/ProjectContext'
import { useDocuments } from '../hooks/useDocuments'
import { useAuth } from '../hooks/useAuth'
import {
    Folder, FileText, Search,
    ChevronRight, ChevronDown,
    UploadCloud, File as FileIcon,
    FolderOpen, ExternalLink, X, Trash2,
    Scissors, Clipboard, Plus,
    AlertTriangle, HelpCircle,
    Lock, LockOpen, History, GitBranch
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { openPrintWindow } from '../utils/printWindow'
import './DMSDashboard.css'
import DocumentUploadModal from '../components/DocumentUploadModal'
import type { SearchFilters } from '../components/DocumentSearchModal'
import DocumentSearchBar from '../components/DocumentSearchBar'

// --- Premium Custom Modals (Glassmorphism + Modern UI) ---
const ModalConfirm = ({ isOpen, title, message, onConfirm, onClose, isDanger = false, confirmLabel = '확인', cancelLabel = '취소' }: any) => {
    if (!isOpen) return null
    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.2s ease-out' }}>
            <div className="modal-card" style={{ background: 'rgba(28, 31, 38, 0.95)', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', width: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', background: isDanger ? 'rgba(250, 82, 82, 0.15)' : 'rgba(51, 154, 240, 0.15)', padding: '16px', borderRadius: '50%', marginBottom: '20px' }}>
                    {isDanger ? <AlertTriangle color="#ff6b6b" size={32}/> : <HelpCircle color="#339af0" size={32}/>}
                </div>
                <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '1.4rem', fontWeight: 800 }}>{title}</h3>
                <p style={{ color: '#adb5bd', margin: '0 0 32px 0', lineHeight: 1.6, fontSize: '1rem', wordBreak: 'keep-all' }}>{message}</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} style={{ flex: 1, height: '48px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#dee2e6', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>{cancelLabel}</button>
                    <button onClick={onConfirm} style={{ flex: 1, height: '48px', background: isDanger ? 'linear-gradient(135deg, #fa5252 0%, #c2255c 100%)' : 'linear-gradient(135deg, #339af0 0%, #1c7ed6 100%)', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, boxShadow: isDanger ? '0 8px 16px rgba(250, 82, 82, 0.3)' : '0 8px 16px rgba(51, 154, 240, 0.3)' }}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}

const ModalInput = ({ isOpen, title, placeholder, onConfirm, onClose }: any) => {
    const [val, setVal] = useState('')
    if (!isOpen) return null
    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-card" style={{ background: 'rgba(28, 31, 38, 0.95)', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', width: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(51, 154, 240, 0.15)', padding: '10px', borderRadius: '12px' }}>
                        <Plus color="#339af0" size={24}/>
                    </div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: 800 }}>{title}</h3>
                </div>
                <input 
                    value={val} 
                    onChange={e => setVal(e.target.value)} 
                    placeholder={placeholder}
                    autoFocus
                    style={{ background: '#0b1221', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '100%', padding: '16px', borderRadius: '12px', marginBottom: '32px', fontSize: '1.05rem', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}
                    onKeyDown={e => e.key === 'Enter' && onConfirm(val)}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} style={{ flex: 1, height: '48px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#adb5bd', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>취소</button>
                    <button onClick={() => onConfirm(val)} style={{ flex: 1, height: '48px', background: 'linear-gradient(135deg, #1c7ed6 0%, #1971c2 100%)', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 8px 16px rgba(28, 126, 214, 0.3)' }}>폴더 생성</button>
                </div>
            </div>
        </div>
    )
}

// --- Checkin Modal ---
const STATUS_OPTIONS = [
    { value: 'DRAFT', label: '초안작성' },
    { value: 'PENDING', label: '작업중' },
    { value: 'APPROVED', label: '최종제출' },
]

const CheckinModal = ({ isOpen, doc, onClose, onSubmit }: { isOpen: boolean, doc: any, onClose: () => void, onSubmit: (fd: FormData) => Promise<void> }) => {
    const [version, setVersion] = useState('')
    const [status, setStatus] = useState('PENDING')
    const [changeLog, setChangeLog] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen && doc) {
            // Suggest next version
            const cur = doc.currentVersion || 'v0'
            const m = cur.match(/v?(\d+)\.?(\d*)/)
            if (m) {
                const major = parseInt(m[1]) || 0
                const minor = parseInt(m[2] || '0')
                setVersion(minor > 0 ? `v${major}.${minor + 1}` : `v${major}.1`)
            } else {
                setVersion('v1.0')
            }
            setStatus(doc.status || 'PENDING')
            setChangeLog('')
            setFile(null)
            setError('')
        }
    }, [isOpen, doc])

    if (!isOpen || !doc) return null

    const handleSubmit = async () => {
        if (!file) { setError('파일을 첨부해주세요.'); return }
        if (!version.trim()) { setError('버전 번호를 입력해주세요.'); return }
        setLoading(true); setError('')
        try {
            const fd = new FormData()
            fd.append('id', doc.id)
            fd.append('file', file)
            fd.append('version', version.trim())
            fd.append('status', status)
            fd.append('changeLog', changeLog)
            await onSubmit(fd)
            onClose()
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || '오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'rgba(28,31,38,0.98)', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', width: '480px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(64,192,87,0.15)', padding: '10px', borderRadius: '12px' }}>
                        <GitBranch color="#40c057" size={24}/>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>체크인 — 새 버전 등록</h3>
                        <div style={{ color: '#868e96', fontSize: '0.82rem', marginTop: '2px' }}>{doc.name}</div>
                    </div>
                </div>

                {/* 버전 번호 */}
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#868e96', marginBottom: '6px' }}>버전 번호 <span style={{ color: '#fa5252' }}>*</span></label>
                    <input value={version} onChange={e => setVersion(e.target.value)} placeholder="예: v1.0, v0.5" style={{ width: '100%', background: '#0b1221', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}/>
                    <div style={{ fontSize: '0.75rem', color: '#495057', marginTop: '4px' }}>현재: {doc.currentVersion || 'v1'} · 권장: 초안 v0.x, 검토 v0.5, 최종 v1.0</div>
                </div>

                {/* 진행 상태 */}
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#868e96', marginBottom: '6px' }}>진행 상태</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {STATUS_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setStatus(opt.value)} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: `1px solid ${status === opt.value ? '#1c7ed6' : 'rgba(255,255,255,0.1)'}`, background: status === opt.value ? 'rgba(28,126,214,0.2)' : 'transparent', color: status === opt.value ? '#4dabf7' : '#868e96', fontWeight: status === opt.value ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem' }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 변경 내용 */}
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#868e96', marginBottom: '6px' }}>변경 내용 (선택)</label>
                    <textarea value={changeLog} onChange={e => setChangeLog(e.target.value)} placeholder="이번 버전에서 변경된 내용을 입력하세요." rows={3} style={{ width: '100%', background: '#0b1221', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}/>
                </div>

                {/* 파일 첨부 */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#868e96', marginBottom: '6px' }}>파일 첨부 <span style={{ color: '#fa5252' }}>*</span></label>
                    <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${file ? '#40c057' : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(64,192,87,0.05)' : 'transparent' }}>
                        <UploadCloud size={24} color={file ? '#40c057' : '#495057'} style={{ marginBottom: '6px' }}/>
                        <div style={{ fontSize: '0.85rem', color: file ? '#40c057' : '#868e96' }}>{file ? file.name : '클릭하여 파일 선택'}</div>
                        {file && <div style={{ fontSize: '0.75rem', color: '#495057', marginTop: '2px' }}>{(file.size / 1024).toFixed(1)} KB</div>}
                    </div>
                    <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)}/>
                </div>

                {error && <div style={{ background: 'rgba(250,82,82,0.1)', border: '1px solid rgba(250,82,82,0.3)', color: '#fa5252', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} disabled={loading} style={{ flex: 1, height: '48px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#adb5bd', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>취소</button>
                    <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, height: '48px', background: loading ? '#2c3e50' : 'linear-gradient(135deg, #40c057 0%, #2f9e44 100%)', border: 'none', color: '#fff', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, boxShadow: '0 8px 16px rgba(64,192,87,0.3)' }}>
                        {loading ? '등록 중...' : '체크인 등록'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const STANDARD_CATEGORIES_DATA: Record<string, string[]> = {
  '00_공무_행정': ['01_사업자_면허', '02_계약_서약', '03_선임_조직', '04_인력_출력', '05_내역_정산'],
  '01_안전_보건': ['01_안전교육', '02_위험성평가', '03_안전점검', '04_TBM_회의', '05_보호구_장구', '06_산업보건', '07_사고_재해'],
  '02_공사_작업': ['01_작업계획서', '02_시공계획서', '03_공사일보', '04_작업허가서', '05_도면_설계'],
  '03_장비_공도구': ['01_장비서류', '02_중장비_점검', '03_공도구_관리'],
  '04_기록_자료': ['01_사진대지', '02_공문_수발신', '03_회의록_일반', '04_준공_인허가'],
  '05_기타': []
}

const PARENT_CATEGORIES = [
  { id: '00_공무_행정', label: '00_공무_행정' },
  { id: '01_안전_보건', label: '01_안전_보건' },
  { id: '02_공사_작업', label: '02_공사_작업' },
  { id: '03_장비_공도구', label: '03_장비_공도구' },
  { id: '04_기록_자료', label: '04_기록_자료' },
  { id: '05_기타', label: '05_기타' },
]

export default function DMSDashboard() {
    const { selectedId, setSelectedId, projects = [] } = useProjectContext()
    const { user } = useAuth()
    const selectedProj = projects?.find((p: any) => p.id === selectedId)
    const { data: rawDocs, deleteDocument, moveDocument, copyDocument, checkoutDocument, checkinDocument, unlockDocument, getVersionHistory, updateDocument, refresh } = useDocuments(selectedId)
    const safeDocs = Array.isArray(rawDocs) ? rawDocs : []

    // --- States ---
    const [dbCustomCategories, setDbCustomCategories] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('00_공무_행정')
    const [selectedSubFolderId, setSelectedSubFolderId] = useState<string | null>(null)
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
    const [clipboard, setClipboard] = useState<{ docId: string, action: 'cut' | 'copy' } | null>(null)
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['00_공무_행정']))
    const [ctxMenu, setCtxMenu] = useState<{ x: number, y: number, type: 'doc' | 'folder' | 'category', id: string, parentCat?: string } | null>(null)

    const [searchResults, setSearchResults] = useState<any[] | null>(null)

    // --- Inline Edit States (detail panel) ---
    const [editingType, setEditingType] = useState(false)
    const [typeValue, setTypeValue] = useState('')
    const [tagInput, setTagInput] = useState('')

    // --- Checkin/Version States ---
    const [isCheckinOpen, setIsCheckinOpen] = useState(false)
    const [checkinTargetDoc, setCheckinTargetDoc] = useState<any>(null)
    const [versionHistory, setVersionHistory] = useState<any[]>([])
    const [showHistory, setShowHistory] = useState(false)

    // --- Modern Modal States ---
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', isDanger: false, confirmLabel: '확인', cancelLabel: '취소', onConfirm: () => {} })
    const [inputModal, setInputModal] = useState({ isOpen: false, title: '', placeholder: '', onConfirm: (_v: string) => {} })

    useEffect(() => {
        return () => { delete (window as any).openGlobalSearch }
    }, [])

    const fetchCustomCategories = async () => {
        if (!selectedId) return
        try {
            const res = await apiClient.get(`/documents/categories?projectId=${selectedId}`)
            setDbCustomCategories(Array.isArray(res.data) ? res.data : [])
        } catch (err) { console.error(err) }
    }
    useEffect(() => { fetchCustomCategories() }, [selectedId])

    const categoryStructure = useMemo(() => {
        return PARENT_CATEGORIES.map(pc => {
            const standard = (STANDARD_CATEGORIES_DATA[pc.id] || []).map(name => ({ id: name, label: name, isStandard: true }))
            const custom = dbCustomCategories.filter(dbc => dbc.parent_category === pc.id).map(dbc => ({ id: dbc.name, label: dbc.name, isStandard: false, dbId: dbc.id }))
            return { ...pc, folders: [...standard, ...custom] }
        })
    }, [dbCustomCategories])

    const currentCategoryNode = useMemo(() => categoryStructure?.find(c => c.id === selectedCategory), [categoryStructure, selectedCategory])

    const toggleFolder = (catId: string) => {
        const next = new Set(expandedCategories)
        if (next.has(catId)) next.delete(catId)
        else next.add(catId)
        setExpandedCategories(next)
        setSelectedCategory(catId)
        setSelectedSubFolderId(null)
    }

    const handleContextMenu = (e: React.MouseEvent, type: any, id: string, parentCat?: string) => {
        e.preventDefault(); e.stopPropagation()
        setCtxMenu({ x: e.clientX, y: e.clientY, type, id, parentCat })
    }

    const handleDrop = async (e: React.DragEvent, targetCat: string, targetSub: string) => {
        e.preventDefault(); setDragOverFolder(null)
        const docId = e.dataTransfer.getData('docId')
        if (docId) {
            try {
                await moveDocument({ id: docId, category: targetCat, subCategory: targetSub })
                refresh?.()
            } catch (err) { }
        }
    }

    const getDocCount = (cat: string, sub?: string) => {
        return safeDocs.filter(d => 
            String(d.category || '').trim() === cat && 
            (!sub || String(d.subCategory || '').trim() === sub)
        ).length
    }

    // --- Action Handlers ---
    const onAddSubCategory = (parentCatId: string) => {
        setInputModal({
            isOpen: true,
            title: '하위 공종 폴더 추가',
            placeholder: '예: 06_계측_관리_보고서',
            onConfirm: async (val) => {
                if (!val || !selectedId) return
                try {
                    await apiClient.post('/documents/categories', {
                        projectId: selectedId,
                        parentCategory: parentCatId,
                        name: val.trim()
                    })
                    fetchCustomCategories()
                    setInputModal(prev => ({ ...prev, isOpen: false }))
                } catch (err) { }
            }
        })
    }

    const handleSearch = async (filters: SearchFilters) => {
        try {
            const params: any = {}
            if (filters.search) params.search = filters.search
            if (filters.category) params.category = filters.category
            if (filters.subCategory) params.subCategory = filters.subCategory
            if (filters.status && filters.status !== '전체') params.status = filters.status
            if (filters.officialName) params.officialName = filters.officialName
            if (filters.productionDate) params.productionDate = filters.productionDate
            if (filters.tags) params.tags = filters.tags
            if (filters.client) params.client = filters.client
            if (filters.projectYear) params.projectYear = filters.projectYear
            const res = await apiClient.get('/documents', { params })
            const docs = Array.isArray(res.data) ? res.data : (res.data.documents || [])
            setSearchResults(docs)
        } catch (err) {
            console.error('Search failed:', err)
            setSearchResults([])
        }
    }

    const onDeleteFolder = (folderName: string, dbId: string) => {
        setConfirmModal({
            isOpen: true, isDanger: true,
            confirmLabel: '삭제', cancelLabel: '취소',
            title: '폴더 삭제',
            message: `"${folderName}" 폴더를 삭제하시겠습니까? 폴더 안의 문서는 삭제되지 않습니다.`,
            onConfirm: async () => {
                try {
                    await apiClient.delete(`/documents/categories/${dbId}`)
                    if (selectedSubFolderId === folderName) setSelectedSubFolderId(null)
                    fetchCustomCategories()
                } catch (err) { console.error('Delete folder failed:', err) }
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }
        })
    }

    const onDeleteDoc = (id: string) => {
        setConfirmModal({
            isOpen: true, isDanger: true,
            confirmLabel: '영구 삭제', cancelLabel: '취소',
            title: '문서 영구 삭제',
            message: '정말로 이 문서를 삭제하시겠습니까? 삭제된 문서는 복구할 수 없으며 관련 파일도 모두 제거됩니다.',
            onConfirm: async () => {
                try {
                    await deleteDocument(id)
                    if (selectedDocId === id) setSelectedDocId(null)
                    refresh()
                } catch (err) {
                    console.error('Delete failed:', err)
                    refresh()
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }
        })
    }

    const onCheckout = (docId: string) => {
        // 1단계: 먼저 파일 다운로드
        window.location.href = `/api/download/${docId}`

        // 2단계: 다운로드 선택 여부 확인 후 잠금 처리
        setConfirmModal({
            isOpen: true, isDanger: false,
            confirmLabel: '체크아웃 완료', cancelLabel: '취소 (다운로드 안함)',
            title: '체크아웃 확인',
            message: '파일 다운로드 다이얼로그가 열렸습니다.\n저장 또는 열기를 선택하셨으면 "체크아웃 완료"를 클릭하세요.\n취소하셨으면 "취소"를 클릭하세요.',
            onConfirm: async () => {
                try {
                    await checkoutDocument({
                        id: docId,
                        userId: (user as any)?.uid || 'system',
                        userName: (user as any)?.displayName || (user as any)?.email || '담당자'
                    })
                    refresh()
                } catch (err: any) {
                    alert(err?.response?.data?.error || '체크아웃에 실패했습니다.')
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }
        })
    }

    const onUnlock = (docId: string) => {
        setConfirmModal({
            isOpen: true, isDanger: true,
            confirmLabel: '잠금 해제', cancelLabel: '취소',
            title: '잠금 강제 해제',
            message: '체크아웃을 강제 해제하시겠습니까? 진행 중인 작업 내용이 손실될 수 있습니다.',
            onConfirm: async () => {
                try {
                    await unlockDocument(docId)
                    refresh()
                } catch (err) { console.error(err) }
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }
        })
    }

    const onOpenCheckin = async (doc: any) => {
        try {
            const history = await getVersionHistory(doc.id)
            setVersionHistory(history)
        } catch { setVersionHistory([]) }
        setCheckinTargetDoc(doc)
        setIsCheckinOpen(true)
    }

    const onLoadHistory = async (docId: string) => {
        try {
            const history = await getVersionHistory(docId)
            setVersionHistory(history)
            setShowHistory(true)
        } catch { setVersionHistory([]) }
    }

    // 문서 메타 저장 (type, metadata 필드)
    const saveDocMeta = async (docId: string, patch: Record<string, any>) => {
        try {
            await updateDocument({ id: docId, ...patch } as any)
            refresh()
        } catch (err) { console.error('Meta save failed:', err) }
    }

    // 태그 파싱/직렬화
    const parseTags = (raw: string | string[] | undefined): string[] => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw.map(t => t.trim()).filter(Boolean)
        return String(raw).split(',').map(t => t.trim()).filter(Boolean)
    }

    const renderDocItem = (doc: any) => (
        <div
            key={doc.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('docId', doc.id)}
            className={`doc-item ${selectedDocId === doc.id ? 'selected' : ''} ${clipboard?.docId === doc.id && clipboard?.action === 'cut' ? 'cutting' : ''}`}
            onClick={(e) => { e.stopPropagation(); setSelectedDocId(doc.id); setShowHistory(false) }}
            onContextMenu={(e) => handleContextMenu(e, 'doc', doc.id)}
        >
            <div className="doc-visual">
                {String(doc.name || '').toLowerCase().endsWith('.pdf') ? <FileText size={40} color="#fa5252" /> : <FileIcon size={40} color="#4dabf7" />}
                {doc.lockedBy && <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1 }}><Lock size={14} color="#fcc419"/></div>}
                {doc.clientSubmit && <div className="badge-client" style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 1, background: '#20c997', color: '#000', fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', fontWeight: 800 }}>제출용</div>}
            </div>
            <div className="doc-title" title={doc.name}>{doc.name}</div>
            <div className="doc-sub">
                <span>{doc.currentVersion || 'v1'}</span>
                <span className={`status-dot ${doc.status === 'APPROVED' ? 'success' : 'warn'}`}>
                    {doc.status === 'APPROVED' ? '최종제출' : (doc.status === 'PENDING' ? '작업중' : '초안')}
                </span>
            </div>
        </div>
    )

    const renderFolderSection = (folder: { id: string, label: string }) => {
        const folderDocs = safeDocs.filter(d => 
            String(d.category || '').trim() === selectedCategory && 
            String(d.subCategory || '').trim() === folder.id &&
            true
        )
        if (folderDocs.length === 0 && selectedSubFolderId !== folder.id) return null

        return (
            <section 
                key={folder.id} 
                className={`folder-section ${dragOverFolder === folder.id ? 'over' : ''}`} 
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id); }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => handleDrop(e, selectedCategory, folder.id)}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, selectedCategory)}
            >
                <div className="section-title-row">
                    <div className="accent-bar" style={{ width: '4px', height: '16px', background: '#339af0', borderRadius: '2px' }} />
                    <span className="folder-label-text">{folder.label} ({folderDocs.length})</span>
                </div>
                <div className="doc-container grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    {folderDocs.map(doc => renderDocItem(doc))}
                </div>
            </section>
        )
    }

    const selectedDoc = useMemo(() => safeDocs?.find(d => d.id === selectedDocId), [safeDocs, selectedDocId])

    return (
        <div className="dms-dashboard" onClick={() => setCtxMenu(null)}>
            <header className="dash-header">
                <div>
                    <div className="dash-eyebrow">DOCUMENT MANAGEMENT</div>
                    <h2 className="dash-title">[{selectedProj?.code || '...'}] {selectedProj?.name || '프로젝트 선택'}</h2>
                </div>
                {/* 검색은 아래 문서 검색 필터가, 등록은 경로 옆 「이 분류에 문서 등록」이
                    맡는다. 같은 일을 하는 칸이 두 개면 어느 쪽이 무엇을 거는지 알 수 없다. */}
            </header>

            <div className="content-split">
                <nav className="nav-panel card sidebar-explorer">
                    <div className="sidebar-header" style={{ fontSize: '1.2rem', fontWeight: 800, padding: '20px', borderBottom: '1px solid #1f2228' }}>문서 탐색기</div>
                    <div className="nav-group" style={{ padding: '20px' }}>
                        <select className="project-select" value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}>
                            {projects?.map((p: any) => (<option key={p.id} value={p.id}>[{p.code}] {p.name}</option>))}
                        </select>
                    </div>
                    
                    <div className="nav-group" style={{ padding: '0 20px' }}>
                        <div className="category-tree" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                            {categoryStructure?.map(cat => (
                                <div key={cat.id} className="tree-node">
                                    <div 
                                        className={`tree-item parent ${selectedCategory === cat.id ? 'active' : ''}`}
                                        style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', borderRadius: '8px', marginBottom: '2px', background: selectedCategory === cat.id ? 'linear-gradient(90deg, #1c7ed6 0%, #1971c2 100%)' : 'transparent', color: '#fff', boxShadow: selectedCategory === cat.id ? '0 4px 12px rgba(28, 126, 214, 0.2)' : 'none' }}
                                        onClick={() => toggleFolder(cat.id)}
                                        onContextMenu={(e) => handleContextMenu(e, 'category', cat.id)}
                                    >
                                        {expandedCategories.has(cat.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                        <FolderOpen size={16} style={{ marginLeft: '4px', marginRight: '8px' }} color={selectedCategory === cat.id ? '#fff' : '#4dabf7'} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: selectedCategory === cat.id ? 700 : 400 }}>{cat.label}</span>
                                    </div>
                                    {expandedCategories.has(cat.id) && (
                                        <div className="tree-children" style={{ marginLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                            {cat.folders?.map(f => (
                                                <div 
                                                    key={f.id}
                                                    className={`tree-item child ${selectedSubFolderId === f.id ? 'active' : ''}`}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 8px 24px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setSelectedCategory(cat.id); 
                                                        setSelectedSubFolderId(f.id); 
                                                    }}
                                                    onContextMenu={(e) => handleContextMenu(e, 'folder', f.id, cat.id)}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Folder size={14} color={selectedSubFolderId === f.id ? '#339af0' : '#fcc419'} fill={selectedSubFolderId === f.id ? 'rgba(51, 154, 240, 0.2)' : 'rgba(252, 196, 25, 0.2)'} />
                                                        <span style={{ color: selectedSubFolderId === f.id ? '#339af0' : '#adb5bd', fontWeight: selectedSubFolderId === f.id ? 700 : 400 }}>{f.label}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: '#495057' }}>{getDocCount(cat.id, f.id)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </nav>

                <main className="doc-panel card main-content-area" style={{ flex: 1, padding: '32px', overflowY: 'auto', background: '#0b1221' }}>
                    <DocumentSearchBar
                        onSearch={handleSearch}
                        onClear={() => setSearchResults(null)}
                        resultCount={searchResults === null ? null : searchResults.length}
                    />

                    {searchResults !== null ? (
                        <>
                            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#4dabf7', fontSize: '1.05rem', fontWeight: 700 }}>
                                    <Search size={20} /> <span style={{ color: '#fff' }}>통합 검색 결과</span>
                                    <span style={{ background: 'rgba(51,154,240,0.15)', color: '#4dabf7', fontSize: '0.85rem', padding: '2px 10px', borderRadius: '20px' }}>{searchResults.length}건</span>
                                </div>
                                <button className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setSearchResults(null)}>
                                    <X size={14}/> 검색 닫기
                                </button>
                            </div>
                            {searchResults.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#495057', gap: '12px' }}>
                                    <Search size={48} strokeWidth={1}/>
                                    <p>검색 결과가 없습니다.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                    {searchResults.map(doc => renderDocItem({
                                        id: doc.id, name: doc.name, status: doc.status,
                                        category: doc.category, subCategory: doc.sub_category,
                                        createdAt: doc.created_at, clientSubmit: doc.client_submit,
                                        projectName: doc.project_name
                                    }))}
                                </div>
                            )}
                        </>
                    ) : (
                    <>
                    <div className="panel-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px', color: '#4dabf7', fontSize: '1.05rem', fontWeight: 700 }}>
                        <FolderOpen size={20} /> <span>{selectedProj?.name}</span> <ChevronRight size={16} /> <span style={{ color: '#fff' }}>{selectedCategory}</span>

                        {/* 등록 버튼을 경로 옆에 둔다. 이미 고른 프로젝트·분류에 그대로 올라가므로
                            모달에서 그 둘을 다시 고를 필요가 없다. 버튼 이름에 분류를 적어
                            어디에 올라가는지 눌러보기 전에 알 수 있게 한다. */}
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            disabled={!selectedId}
                            title={selectedId ? `${selectedCategory} 에 등록합니다` : '프로젝트를 먼저 선택하십시오'}
                            style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                height: '32px',
                                padding: '0 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: selectedId ? '#1c7ed6' : 'rgba(255,255,255,0.08)',
                                color: selectedId ? '#fff' : '#6d809b',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: selectedId ? 'pointer' : 'not-allowed',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <UploadCloud size={15} /> 이 분류에 문서 등록
                        </button>
                    </div>
                    {selectedSubFolderId ? (
                        currentCategoryNode?.folders?.filter(f => f.id === selectedSubFolderId).map(f => renderFolderSection(f))
                    ) : (
                        currentCategoryNode?.folders?.map(f => renderFolderSection(f))
                    )}
                    </>
                    )}
                </main>

                {selectedDoc && (
                    <aside className="detail-panel card" style={{ width: '360px', borderLeft: '1px solid #1f2228', background: 'rgba(21, 25, 34, 0.95)', backdropFilter: 'blur(10px)', overflowY: 'auto' }}>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 800 }}>문서 상세 정보</h3>
                                <X size={20} style={{ cursor: 'pointer', color: '#495057' }} onClick={() => setSelectedDocId(null)} />
                            </div>

                            {/* 문서 제목 */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#868e96', marginBottom: '6px' }}>문서 제목 / 핵심 키워드</div>
                                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700, wordBreak: 'break-all' }}>{selectedDoc.name}</div>
                            </div>

                            {/* 2열 그리드 메타 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {[
                                    { label: '고객사 (발주처)', value: selectedDoc.metadata?.clientName || '-' },
                                    { label: '프로젝트', value: selectedDoc.projectName || selectedProj?.name || '-' },
                                    { label: '공종 (대분류)', value: selectedDoc.category || '-' },
                                    { label: '하위 공종', value: selectedDoc.subCategory || '-' },
                                    { label: '파일 유형', value: (selectedDoc.name?.split('.').pop() || '-').toUpperCase() },
                                ].map(item => (
                                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#868e96', marginBottom: '4px' }}>{item.label}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#dee2e6', fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>
                                    </div>
                                ))}
                                {/* 문서 유형 — 인라인 편집 */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', border: `1px solid ${editingType ? 'rgba(51,154,240,0.4)' : 'rgba(255,255,255,0.05)'}` }}>
                                    <div style={{ fontSize: '0.7rem', color: '#868e96', marginBottom: '4px' }}>문서 유형</div>
                                    {editingType ? (
                                        <input
                                            autoFocus
                                            value={typeValue}
                                            onChange={e => setTypeValue(e.target.value)}
                                            onBlur={() => { setEditingType(false); if (typeValue.trim()) saveDocMeta(selectedDoc.id, { type: typeValue.trim() }) }}
                                            onKeyDown={e => { if (e.key === 'Enter') { setEditingType(false); if (typeValue.trim()) saveDocMeta(selectedDoc.id, { type: typeValue.trim() }) } if (e.key === 'Escape') setEditingType(false) }}
                                            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600, width: '100%', padding: 0 }}
                                        />
                                    ) : (
                                        <div onClick={() => { setEditingType(true); setTypeValue(selectedDoc.type || '') }} style={{ fontSize: '0.85rem', color: '#dee2e6', fontWeight: 600, cursor: 'text', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {selectedDoc.type || <span style={{ color: '#495057' }}>클릭하여 입력</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 공식 문서명 */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#868e96', marginBottom: '6px' }}>공식 문서명</div>
                                <div style={{ fontSize: '0.9rem', color: selectedDoc.metadata?.officialName ? '#fff' : '#495057' }}>{selectedDoc.metadata?.officialName || '미입력'}</div>
                            </div>

                            {/* 작성년월 / 진행상태 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#868e96', marginBottom: '4px' }}>작성년월</div>
                                    <div style={{ fontSize: '0.85rem', color: '#dee2e6', fontWeight: 600 }}>
                                        {selectedDoc.metadata?.productionDate || (selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' }) : '-')}
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#868e96', marginBottom: '4px' }}>진행 상태</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedDoc.status === 'APPROVED' ? '#40c057' : '#fcc419' }}>
                                        {selectedDoc.status === 'APPROVED' ? '최종제출' : selectedDoc.status === 'PENDING' ? '작성중' : '초안작성'}
                                    </div>
                                </div>
                            </div>

                            {/* 해시태그 — 인라인 편집 */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#868e96', marginBottom: '8px' }}>해시태그</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {parseTags(selectedDoc.metadata?.tags).map((tag: string) => (
                                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(51,154,240,0.15)', color: '#4dabf7', fontSize: '0.78rem', padding: '3px 8px', borderRadius: '20px' }}>
                                            #{tag}
                                            <X size={11} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => {
                                                const next = parseTags(selectedDoc.metadata?.tags).filter((t: string) => t !== tag)
                                                saveDocMeta(selectedDoc.id, { metadata: { tags: next.join(',') } })
                                            }}/>
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                                                e.preventDefault()
                                                const newTag = tagInput.trim().replace(/^#/, '')
                                                const existing = parseTags(selectedDoc.metadata?.tags)
                                                if (!existing.includes(newTag)) {
                                                    saveDocMeta(selectedDoc.id, { metadata: { tags: [...existing, newTag].join(',') } })
                                                }
                                                setTagInput('')
                                            }
                                        }}
                                        placeholder="태그 입력 후 Enter"
                                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', padding: '5px 10px', outline: 'none' }}
                                    />
                                    <button onClick={() => {
                                        if (!tagInput.trim()) return
                                        const newTag = tagInput.trim().replace(/^#/, '')
                                        const existing = parseTags(selectedDoc.metadata?.tags)
                                        if (!existing.includes(newTag)) {
                                            saveDocMeta(selectedDoc.id, { metadata: { tags: [...existing, newTag].join(',') } })
                                        }
                                        setTagInput('')
                                    }} style={{ background: 'rgba(51,154,240,0.2)', border: '1px solid rgba(51,154,240,0.3)', borderRadius: '6px', color: '#4dabf7', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                        + 추가
                                    </button>
                                </div>
                            </div>

                            {/* 발주처 제출용 — 토글 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ fontSize: '0.85rem', color: '#868e96' }}>발주처 제출용</span>
                                <button onClick={() => saveDocMeta(selectedDoc.id, { metadata: { client_submit: !selectedDoc.clientSubmit } })}
                                    style={{ background: selectedDoc.clientSubmit ? 'rgba(32,201,151,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${selectedDoc.clientSubmit ? 'rgba(32,201,151,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: selectedDoc.clientSubmit ? '#20c997' : '#495057', fontWeight: 700, padding: '3px 12px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.15s' }}>
                                    {selectedDoc.clientSubmit ? '✓ 대상' : '비대상'}
                                </button>
                            </div>

                            {/* 버전 / 체크아웃 상태 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px 14px', border: `1px solid ${selectedDoc.lockedBy ? 'rgba(252,196,25,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <GitBranch size={14} color="#868e96"/>
                                    <span style={{ fontSize: '0.85rem', color: '#868e96' }}>현재 버전</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4dabf7' }}>{selectedDoc.currentVersion || 'v1'}</span>
                                </div>
                                {selectedDoc.lockedBy
                                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fcc419', fontSize: '0.8rem', fontWeight: 700 }}><Lock size={13}/> {selectedDoc.lockedByName || selectedDoc.lockedBy}</span>
                                    : <span style={{ color: '#40c057', fontSize: '0.8rem' }}>사용 가능</span>
                                }
                            </div>

                            {/* 버전 히스토리 */}
                            {showHistory && versionHistory.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)', maxHeight: '160px', overflowY: 'auto' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#868e96', marginBottom: '8px', fontWeight: 700 }}>버전 히스토리</div>
                                    {versionHistory.map((v: any) => (
                                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ background: 'rgba(51,154,240,0.15)', color: '#4dabf7', fontSize: '0.75rem', padding: '1px 7px', borderRadius: '4px', fontWeight: 700 }}>{v.version}</span>
                                                <span style={{ fontSize: '0.78rem', color: '#868e96' }}>{v.change_log || '-'}</span>
                                            </div>
                                            <span style={{ fontSize: '0.72rem', color: '#495057', flexShrink: 0, marginLeft: '8px' }}>{v.created_at ? new Date(v.created_at).toLocaleDateString('ko-KR') : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                                {/* Checkout / Checkin */}
                                {selectedDoc.lockedBy ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', height: '44px' }}>
                                        <button style={{ flex: 1, height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #40c057 0%, #2f9e44 100%)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={() => onOpenCheckin(selectedDoc)}>
                                            <LockOpen size={15}/> 체크인
                                        </button>
                                        <button style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'transparent', border: '1px solid #495057', color: '#adb5bd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="잠금 강제 해제" onClick={() => onUnlock(selectedDoc.id)}>
                                            <X size={15}/>
                                        </button>
                                    </div>
                                ) : (
                                    <button style={{ width: '100%', height: '44px', borderRadius: '12px', background: 'transparent', border: '1px solid #495057', color: '#e9ecef', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.88rem', whiteSpace: 'nowrap' }} onClick={() => onCheckout(selectedDoc.id)}>
                                        <Lock size={15}/> 체크아웃 (수정 잠금)
                                    </button>
                                )}
                                <button className="btn-primary" style={{ width: '100%', height: '44px', borderRadius: '12px' }} onClick={() => {
                                    const ext = selectedDoc.name.toLowerCase()?.split('.').pop()
                                    const isOA = ['docx', 'doc', 'xlsx', 'xls'].includes(ext || '')
                                    const url = isOA ? `/api/docview/html/${selectedDoc.id}` : `/api/docview/${selectedDoc.id}/${encodeURIComponent(selectedDoc.name)}`
                                    openPrintWindow(`${window.location.origin}${url}`, selectedDoc.name)
                                }}><ExternalLink size={16}/> 문서 바로보기</button>
                                <button style={{ width: '100%', height: '40px', borderRadius: '12px', background: 'transparent', border: '1px solid #495057', color: '#e9ecef', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => onLoadHistory(selectedDoc.id)}>
                                    <History size={14}/> {showHistory ? '버전 이력 닫기' : '버전 히스토리'}
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            {/* --- Premium Modals --- */}
            <ModalConfirm 
                isOpen={confirmModal.isOpen} 
                title={confirmModal.title} 
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
                confirmLabel={confirmModal.confirmLabel}
                cancelLabel={confirmModal.cancelLabel}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <ModalInput 
                isOpen={inputModal.isOpen} 
                title={inputModal.title} 
                placeholder={inputModal.placeholder} 
                onConfirm={inputModal.onConfirm} 
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))} 
            />

            {ctxMenu && (
                <div className="ctx-menu" style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1000, background: 'rgba(31, 34, 40, 0.98)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                    {ctxMenu.type === 'doc' && (() => {
                        const ctxDoc = safeDocs.find(d => d.id === ctxMenu.id)
                        return (
                            <>
                                {ctxDoc?.lockedBy
                                    ? <div className="ctx-item" style={{ padding: '10px 12px', color: '#40c057', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { onOpenCheckin(ctxDoc); setCtxMenu(null); }}><LockOpen size={14}/> 체크인 (버전 등록)</div>
                                    : <div className="ctx-item" style={{ padding: '10px 12px', color: '#fcc419', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { onCheckout(ctxMenu.id); setCtxMenu(null); }}><Lock size={14}/> 체크아웃 (수정 잠금)</div>
                                }
                                <div className="ctx-item" style={{ padding: '10px 12px', color: '#4dabf7', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { window.location.href = `/api/download/${ctxMenu.id}`; setCtxMenu(null); }}><FileText size={14}/> 참고용 다운로드</div>
                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}/>
                                <div className="ctx-item" style={{ padding: '10px 12px', color: '#dee2e6', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { setClipboard({ docId: ctxMenu.id, action: 'cut' }); setCtxMenu(null); }}><Scissors size={14}/> 잘라내기</div>
                                <div className="ctx-item" style={{ padding: '10px 12px', color: '#dee2e6', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { setClipboard({ docId: ctxMenu.id, action: 'copy' }); setCtxMenu(null); }}><Clipboard size={14}/> 복사</div>
                                <div className="ctx-item danger" style={{ padding: '10px 12px', color: '#fa5252', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { onDeleteDoc(ctxMenu.id); setCtxMenu(null); }}><Trash2 size={14}/> 삭제</div>
                            </>
                        )
                    })()}
                    {ctxMenu.type === 'category' && (
                        <>
                            {clipboard && (
                                <div className="ctx-item" style={{ padding: '10px 12px', color: '#4dabf7', cursor: 'pointer', borderRadius: '6px' }} onClick={async () => {
                                    try {
                                        if (clipboard.action === 'cut') {
                                            await moveDocument({ id: clipboard.docId, category: ctxMenu.id, subCategory: '' })
                                        } else {
                                            await copyDocument({ id: clipboard.docId, category: ctxMenu.id, subCategory: '' })
                                        }
                                        if (clipboard.action === 'cut') setClipboard(null)
                                        refresh()
                                    } catch (err) { console.error(err) }
                                    setCtxMenu(null)
                                }}><Clipboard size={14}/> 여기에 붙여넣기</div>
                            )}
                            <div className="ctx-item" style={{ padding: '10px 12px', color: '#fff', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { onAddSubCategory(ctxMenu.id); setCtxMenu(null); }}>
                                <Plus size={14}/> 하위 공종 폴더 생성
                            </div>
                        </>
                    )}
                    {ctxMenu.type === 'folder' && (() => {
                        const folderInfo = categoryStructure.find(c => c.id === ctxMenu.parentCat)?.folders.find((f: any) => f.id === ctxMenu.id)
                        return (
                            <>
                                {clipboard && (
                                    <div className="ctx-item" style={{ padding: '10px 12px', color: '#4dabf7', cursor: 'pointer', borderRadius: '6px' }} onClick={async () => {
                                        try {
                                            if (clipboard.action === 'cut') {
                                                await moveDocument({ id: clipboard.docId, category: ctxMenu.parentCat || '', subCategory: ctxMenu.id })
                                            } else {
                                                await copyDocument({ id: clipboard.docId, category: ctxMenu.parentCat || '', subCategory: ctxMenu.id })
                                            }
                                            if (clipboard.action === 'cut') setClipboard(null)
                                            refresh()
                                        } catch (err) { console.error(err) }
                                        setCtxMenu(null)
                                    }}><Clipboard size={14}/> 여기에 붙여넣기</div>
                                )}
                                {folderInfo && !(folderInfo as any).isStandard && (
                                    <div className="ctx-item danger" style={{ padding: '10px 12px', color: '#fa5252', cursor: 'pointer', borderRadius: '6px' }} onClick={() => { onDeleteFolder(ctxMenu.id, (folderInfo as any).dbId); setCtxMenu(null); }}>
                                        <Trash2 size={14}/> 폴더 삭제
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </div>
            )}
            {isUploadOpen && <DocumentUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} initialProject={selectedProj?.name || ''} initialCategory={selectedCategory} />}
            <CheckinModal
                isOpen={isCheckinOpen}
                doc={checkinTargetDoc}
                onClose={() => { setIsCheckinOpen(false); setCheckinTargetDoc(null) }}
                onSubmit={async (fd) => { await checkinDocument(fd); refresh() }}
            />
        </div>
    )
}
