import './Page.css'
import './EMS.css'
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { DocumentUploader } from '../components/DocumentUploader'

interface UploadedFile {
    id: string
    name: string
    type: string
    size: number
    uploadDate: string
    category: string
    url?: string
}

function EquipmentDetailPage() {
    // URL에서 장비 ID 가져오기 (예: /equipment/123 -> id = "123")
    // 이 ID로 해당 장비의 모든 정보(기본정보 + 문서)를 로드/저장
    const { id } = useParams<{ id: string }>()
    const { show } = useToast()
    const [activeSection, setActiveSection] = useState(0)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [equipmentName, setEquipmentName] = useState('')

    // 장비 정보 로드 (문서 포함)
    useEffect(() => {
        if (id && id !== 'new') {
            loadEquipmentData()
        }
    }, [id])

    const loadEquipmentData = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/equipment/${id}`)
            if (res.ok) {
                const data = await res.json()
                setEquipmentName(data.name || '')

                // DB에 저장된 문서 목록 로드
                if (data.documents) {
                    const docs = typeof data.documents === 'string' ? JSON.parse(data.documents) : data.documents
                    setUploadedFiles(docs || [])
                }
            }
        } catch (err) {
            console.error(err)
            show('장비 정보를 불러오는데 실패했습니다.', 'error')
        }
    }

    const sections = [
        { id: 0, title: '기본 정보', icon: '📋' },
        { id: 1, title: '구매·계약', icon: '💰' },
        { id: 2, title: '법정 확인', icon: '📜' },
        { id: 3, title: '운영', icon: '⚙️' },
        { id: 4, title: '유지보수', icon: '🔧' },
        { id: 5, title: '운영 데이터', icon: '📊' },
        { id: 6, title: '비용', icon: '💵' },
        { id: 7, title: '전체 문서 보기', icon: '📁' }
    ]

    // 각 섹션별 필수 문서 정의
    const documentCategories: Record<string, string[]> = {
        '구매·계약': ['구매계약서', '납품서', '검수서', '세금계산서'],
        '법정 확인': ['건설기계 등록증', '보험증권', '정기검사 증명서', '자동차세 납부증명서'],
        '유지보수': ['매뉴얼(PDF)', '도면', '부품리스트', '정비 기록서', '점검 체크리스트'],
        '운영 데이터': ['작업 일지', '연료 사용 기록', '고장 보고서', '사고 보고서'],
        '문서 관리': ['장비 사진', '기타 서류', '참고 자료']
    }

    const handleFileUpload = async (files: FileList, category: string) => {
        for (const file of Array.from(files)) {
            // 파일 크기 체크 (10MB)
            if (file.size > 10 * 1024 * 1024) {
                show(`${file.name}은(는) 10MB를 초과합니다.`, 'error')
                continue
            }

            try {
                // FormData 생성
                const formData = new FormData()
                formData.append('file', file)
                formData.append('category', category)

                // 서버에 파일 업로드
                const res = await fetch(`http://localhost:3000/api/equipment/${id}/upload`, {
                    method: 'POST',
                    body: formData
                })

                if (res.ok) {
                    const newFile = await res.json()
                    // 서버에서 반환된 파일 정보를 state에 추가
                    setUploadedFiles(prev => [...prev, newFile])
                    show(`${file.name}이(가) 업로드되었습니다.`, 'success')
                } else {
                    const error = await res.json()
                    show(`${file.name} 업로드 실패: ${error.error}`, 'error')
                }
            } catch (err) {
                console.error(err)
                show(`${file.name} 업로드 중 오류가 발생했습니다.`, 'error')
            }
        }
    }

    const handleFileDelete = async (fileId: string) => {
        const file = uploadedFiles.find(f => f.id === fileId)
        if (!file) return

        if (!window.confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return

        try {
            const res = await fetch(`http://localhost:3000/api/equipment/${id}/documents/${fileId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
                show('파일이 삭제되었습니다.', 'info')
            } else {
                const error = await res.json()
                show(`삭제 실패: ${error.error}`, 'error')
            }
        } catch (err) {
            console.error(err)
            show('파일 삭제 중 오류가 발생했습니다.', 'error')
        }
    }

    const handleFileView = (file: UploadedFile) => {
        if (file.url) {
            // 서버의 정적 파일 URL로 열기
            const fileUrl = `http://localhost:3000${file.url}`
            window.open(fileUrl, '_blank')
        }
    }

    // 장비 정보 저장 (문서는 별도 API로 관리)
    const handleSave = async () => {
        try {
            const payload = {
                name: equipmentName || '장비명 미입력'
                // documents는 별도 업로드 API로 관리되므로 제외
            }

            const url = id === 'new'
                ? 'http://localhost:3000/api/equipment'
                : `http://localhost:3000/api/equipment/${id}`

            const method = id === 'new' ? 'POST' : 'PUT'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                show('장비 정보가 저장되었습니다.', 'success')
            } else {
                show('저장에 실패했습니다.', 'error')
            }
        } catch (err) {
            console.error(err)
            show('저장 중 오류가 발생했습니다.', 'error')
        }
    }

    return (
        <div className="page">
            <header className="section-header">
                <div>
                    <p className="eyebrow">Equipment ID: {id || 'NEW'}</p>
                    <h2>{equipmentName || '장비 상세 정보'}</h2>
                    <p className="muted">이 장비의 모든 정보와 문서를 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" onClick={handleSave} style={{ height: '42px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        💾 저장
                    </button>
                </div>
            </header>

            {/* PMS-Style Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '0',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #1e293b'
            }}>
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        style={{
                            padding: '0.875rem 1.5rem',
                            background: 'transparent',
                            color: activeSection === section.id ? '#3b82f6' : '#94a3b8',
                            border: 'none',
                            borderBottom: activeSection === section.id ? '2px solid #3b82f6' : '2px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.9375rem',
                            fontWeight: activeSection === section.id ? 600 : 400,
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            marginBottom: '-2px'
                        }}
                    >
                        {section.icon} {section.title}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="card">
                {activeSection === 0 && (
                    <>
                        <div style={{ marginBottom: '2rem' }}>
                            <p className="card-label">기본 장비 정보</p>
                            <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                장비의 기본 식별 정보를 입력합니다.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: '#e2e8f0' }}>
                                    📌 식별 정보
                                </h4>
                                <div className="form-grid">
                                    <label>
                                        <span>장비 ID</span>
                                        <input className="input-std" placeholder="예: EQ-2024-001" />
                                    </label>
                                    <label>
                                        <span>장비명</span>
                                        <input className="input-std" placeholder="예: 굴삭기 20톤" />
                                    </label>
                                    <label>
                                        <span>일련번호 (S/N)</span>
                                        <input className="input-std" placeholder="제조사 시리얼번호" />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: '#e2e8f0' }}>
                                    🔧 장비 사양
                                </h4>
                                <div className="form-grid">
                                    <label>
                                        <span>장비 종류</span>
                                        <input className="input-std" placeholder="예: 굴삭기, 지게차" />
                                    </label>
                                    <label>
                                        <span>제조사</span>
                                        <input className="input-std" placeholder="예: 두산, 현대, CAT" />
                                    </label>
                                    <label>
                                        <span>모델명</span>
                                        <input className="input-std" placeholder="예: DX225LC" />
                                    </label>
                                    <label>
                                        <span>제조연도</span>
                                        <input className="input-std" type="number" placeholder="예: 2024" />
                                    </label>
                                    <label>
                                        <span>규격/톤수</span>
                                        <input className="input-std" placeholder="예: 20톤, 3.5톤" />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: '#e2e8f0' }}>
                                    📅 도입 정보
                                </h4>
                                <div className="form-grid">
                                    <label>
                                        <span>도입일자</span>
                                        <input className="input-std" type="date" />
                                    </label>
                                    <label>
                                        <span>장비 상태</span>
                                        <select className="input-std">
                                            <option>신품</option>
                                            <option>중고</option>
                                            <option>리빌트</option>
                                            <option>정비중</option>
                                            <option>폐기</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeSection === 1 && (
                    <>
                        <p className="card-label">구매·계약 정보</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>구매 방식</span>
                                <select className="input-std">
                                    <option>구매</option>
                                    <option>리스</option>
                                    <option>렌탈</option>
                                </select>
                            </label>
                            <label>
                                <span>계약금액 (원)</span>
                                <input className="input-std" type="number" placeholder="공급가 + 부가세" />
                            </label>
                            <label>
                                <span>공급업체</span>
                                <input className="input-std" />
                            </label>
                            <label>
                                <span>계약 시작일</span>
                                <input className="input-std" type="date" />
                            </label>
                            <label>
                                <span>계약 종료일</span>
                                <input className="input-std" type="date" />
                            </label>
                        </div>

                        <DocumentUploader
                            category="구매·계약"
                            documents={documentCategories['구매·계약']}
                            uploadedFiles={uploadedFiles}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleFileDelete}
                            onFileView={handleFileView}
                        />
                    </>
                )}

                {activeSection === 2 && (
                    <>
                        <p className="card-label">등록 및 법정 확인사항</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>장비 등록번호</span>
                                <input className="input-std" placeholder="건설기계등록증 번호" />
                            </label>
                            <label>
                                <span>검사 주기</span>
                                <input className="input-std" placeholder="예: 6개월, 1년" />
                            </label>
                            <label>
                                <span>최근 검사일</span>
                                <input className="input-std" type="date" />
                            </label>
                            <label>
                                <span>다음 검사일</span>
                                <input className="input-std" type="date" />
                            </label>
                        </div>

                        <DocumentUploader
                            category="법정 확인"
                            documents={documentCategories['법정 확인']}
                            uploadedFiles={uploadedFiles}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleFileDelete}
                            onFileView={handleFileView}
                        />
                    </>
                )}

                {activeSection === 3 && (
                    <>
                        <p className="card-label">운영 정보</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>배치 현장</span>
                                <input className="input-std" placeholder="투입 현장명" />
                            </label>
                            <label>
                                <span>담당자/기사</span>
                                <input className="input-std" />
                            </label>
                            <label>
                                <span>주요 용도</span>
                                <input className="input-std" placeholder="예: 굴착, 상차, 운반" />
                            </label>
                            <label>
                                <span>운영 시간대</span>
                                <input className="input-std" placeholder="예: 08:00-18:00" />
                            </label>
                        </div>
                    </>
                )}

                {activeSection === 4 && (
                    <>
                        <p className="card-label">유지보수 설정</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>기본 점검 주기</span>
                                <input className="input-std" placeholder="예: 250hr, 500hr, 1000hr" />
                            </label>
                            <label>
                                <span>소모품 교환 주기</span>
                                <input className="input-std" placeholder="엔진오일, 필터류 등" />
                            </label>
                            <label>
                                <span>정비 업체</span>
                                <input className="input-std" />
                            </label>
                            <label>
                                <span>정비 업체 연락처</span>
                                <input className="input-std" placeholder="010-0000-0000" />
                            </label>
                        </div>

                        <DocumentUploader
                            category="유지보수"
                            documents={documentCategories['유지보수']}
                            uploadedFiles={uploadedFiles}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleFileDelete}
                            onFileView={handleFileView}
                        />
                    </>
                )}

                {activeSection === 5 && (
                    <>
                        <p className="card-label">운영 데이터</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>누적 운행시간 (HR)</span>
                                <input className="input-std" type="number" step="0.01" />
                            </label>
                            <label>
                                <span>유류 사용량 (L)</span>
                                <input className="input-std" type="number" step="0.01" />
                            </label>
                            <label>
                                <span>다운타임 (시간)</span>
                                <input className="input-std" type="number" step="0.01" />
                            </label>
                        </div>

                        <DocumentUploader
                            category="운영 데이터"
                            documents={documentCategories['운영 데이터']}
                            uploadedFiles={uploadedFiles}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleFileDelete}
                            onFileView={handleFileView}
                        />
                    </>
                )}

                {activeSection === 6 && (
                    <>
                        <p className="card-label">비용 관리</p>
                        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                            <label>
                                <span>유류비 (원)</span>
                                <input className="input-std" type="number" />
                            </label>
                            <label>
                                <span>정비비 (원)</span>
                                <input className="input-std" type="number" />
                            </label>
                            <label>
                                <span>보험료 (원)</span>
                                <input className="input-std" type="number" />
                            </label>
                            <label>
                                <span>감가상각비 (원)</span>
                                <input className="input-std" type="number" />
                            </label>
                            <label>
                                <span>리스/렌탈비 (원)</span>
                                <input className="input-std" type="number" />
                            </label>
                            <label>
                                <span>총 보유비용 (TCO)</span>
                                <input className="input-std" type="number" placeholder="자동 계산 또는 수동 입력" />
                            </label>
                        </div>
                        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                            💡 TCO (Total Cost of Ownership) = 유류비 + 정비비 + 보험료 + 감가상각비 + 렌탈비
                        </p>
                    </>
                )}

                {activeSection === 7 && (
                    <>
                        <div style={{ marginBottom: '2rem' }}>
                            <p className="card-label">전체 문서 보기</p>
                            <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                모든 카테고리의 업로드된 문서를 한눈에 확인하고 관리합니다.
                            </p>
                        </div>

                        {/* 문서 통계 */}
                        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <h4 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600, color: '#e2e8f0' }}>
                                📊 카테고리별 문서 현황
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                {Object.keys(documentCategories).map(category => {
                                    const count = uploadedFiles.filter(f => f.category === category).length
                                    return (
                                        <div key={category} style={{ textAlign: 'center' }}>
                                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{count}</p>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>{category}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 전체 문서 테이블 */}
                        {uploadedFiles.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                업로드된 문서가 없습니다.
                            </div>
                        ) : (
                            <div className="table-card" style={{ padding: '1rem' }}>
                                <div className="table-head" style={{ marginBottom: '1rem' }}>
                                    <p className="card-label">전체 문서 목록 ({uploadedFiles.length})</p>
                                </div>
                                <div className="table">
                                    <div className="table-row table-header" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 100px' }}>
                                        <span>파일명</span>
                                        <span>카테고리</span>
                                        <span>파일 크기</span>
                                        <span>업로드 일시</span>
                                        <span style={{ textAlign: 'center' }}>관리</span>
                                    </div>
                                    {uploadedFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            className="table-row"
                                            style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 100px' }}
                                        >
                                            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                                                📄 {file.name}
                                            </span>
                                            <span>
                                                <span className="badge badge-tag">{file.category}</span>
                                            </span>
                                            <span style={{ color: '#94a3b8' }}>
                                                {(file.size / 1024).toFixed(1)} KB
                                            </span>
                                            <span style={{ color: '#94a3b8' }}>
                                                {new Date(file.uploadDate).toLocaleDateString('ko-KR')}
                                            </span>
                                            <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleFileView(file)}
                                                    style={{
                                                        padding: '0.4rem 0.6rem',
                                                        background: 'transparent',
                                                        border: '1px solid #334155',
                                                        borderRadius: '6px',
                                                        color: '#3b82f6',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                    title="보기"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    onClick={() => handleFileDelete(file.id)}
                                                    style={{
                                                        padding: '0.4rem 0.6rem',
                                                        background: 'transparent',
                                                        border: '1px solid #334155',
                                                        borderRadius: '6px',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                    title="삭제"
                                                >
                                                    🗑️
                                                </button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default EquipmentDetailPage
