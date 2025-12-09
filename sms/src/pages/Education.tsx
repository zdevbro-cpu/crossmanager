
import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Users, Calendar, MapPin, Camera, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { useToast } from '../components/ToastProvider'
import { useProject } from '../contexts/ProjectContext'
import { apiClient } from '../lib/api'
import './Page.css'

interface Education {
    id: string
    project_id: string
    title: string
    type: string
    instructor: string
    date: string
    place: string
    attendee_count: number
}

export default function EducationPage() {
    const { show: showToast } = useToast()
    const { selectedProjectId } = useProject()

    const [educations, setEducations] = useState<Education[]>([])
    const [selectedEducation, setSelectedEducation] = useState<Education | null>(null)
    const [projects, setProjects] = useState<any[]>([])
    const [isEduModalOpen, setIsEduModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    const { register: registerEdu, handleSubmit: handleSubmitEdu, reset: resetEdu } = useForm()

    useEffect(() => {
        fetchProjects()
        fetchEducations()
    }, [])

    const fetchProjects = async () => apiClient.get('/projects').then(res => setProjects(res.data))
    const fetchEducations = async () => apiClient.get('/sms/educations').then(res => {
        setEducations(res.data)
        setLoading(false)
    })

    const filteredEducations = useMemo(() => {
        if (selectedProjectId === 'ALL') return educations
        return educations.filter(edu => edu.project_id === selectedProjectId)
    }, [educations, selectedProjectId])

    const onEduSubmit = async (data: any) => {
        try {
            await apiClient.post('/sms/educations', data)
            showToast('교육이 등록되었습니다.', 'success')
            setIsEduModalOpen(false)
            resetEdu()
            fetchEducations()
        } catch { showToast('등록 실패', 'error') }
    }

    const getTypeBadge = (type: string) => {
        const colors: any = {
            '신규채용': 'badge',
            '정기': 'badge-primary',
            '특별': 'badge-error',
            'TBM': 'badge-live'
        }
        return <span className={`badge ${colors[type] || 'badge-tag'}`}>{type}</span>
    }

    return (
        <div className="page" style={{ paddingBottom: '80px' }}>
            <header className="page-header">
                <div>
                    <p className="eyebrow">SMS Module</p>
                    <h1>안전 교육 (Education)</h1>
                    <p className="muted">법정 안전 교육 계획 및 실시 이력을 관리합니다. (근로자 관리는 PMS 직원 관리 메뉴 이용)</p>
                </div>
                <button className="btn-primary" onClick={() => setIsEduModalOpen(true)}>
                    <Plus size={18} /> 교육 등록
                </button>
            </header>

            <div className="grid three">
                {filteredEducations.map(edu => (
                    <div
                        key={edu.id}
                        className="card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedEducation(edu)}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            {getTypeBadge(edu.type)}
                            <span className="milestone-meta"><Users size={14} /> {edu.attendee_count}명</span>
                        </div>
                        <h3 style={{ margin: '0.8rem 0' }}>{edu.title}</h3>
                        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            <Calendar size={14} style={{ marginRight: 4 }} /> {new Date(edu.date).toLocaleDateString()}
                        </p>
                        <p className="muted" style={{ fontSize: '0.9rem' }}>
                            <MapPin size={14} style={{ marginRight: 4 }} /> {edu.place}
                        </p>
                    </div>
                ))}
            </div>

            {filteredEducations.length === 0 && !loading && (
                <section className="empty-state">
                    <Users size={48} className="empty-icon" />
                    <h3>등록된 안전 교육이 없습니다.</h3>
                    <p>신규 채용자 교육, 정기 교육 등을 등록하고 참석 서명을 받으세요.</p>
                </section>
            )}

            {isEduModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <header className="modal-header"><h2>교육 등록</h2><button className="btn-text" onClick={() => setIsEduModalOpen(false)}><X size={24} /></button></header>
                        <form onSubmit={handleSubmitEdu(onEduSubmit)} className="modal-body">
                            <div className="form-group">
                                <label>프로젝트</label>
                                <select className="input" {...registerEdu('projectId')}><option value={projects[0]?.id}>{projects[0]?.name}</option></select>
                            </div>
                            <div className="form-grid">
                                <div className="form-group"><label>구분</label><select className="input" {...registerEdu('type')}><option>정기</option><option>특별</option><option>신규채용</option></select></div>
                                <div className="form-group"><label>일자</label><input type="date" className="input" {...registerEdu('date', { required: true })} /></div>
                            </div>
                            <div className="form-group"><label>교육명</label><input className="input" {...registerEdu('title', { required: true })} /></div>
                            <div className="form-group"><label>강사</label><input className="input" {...registerEdu('instructor', { required: true })} /></div>
                            <div className="form-group"><label>장소</label><input className="input" {...registerEdu('place')} /></div>
                            <div className="form-group"><label>내용</label><textarea className="input" {...registerEdu('content')} /></div>
                            <div className="form-actions"><button className="btn-primary">등록</button></div>
                        </form>
                    </div>
                </div>
            )}

            {selectedEducation && (
                <AttendanceModal
                    educationId={selectedEducation.id}
                    title={selectedEducation.title}
                    onClose={() => { setSelectedEducation(null); fetchEducations(); }}
                />
            )}
        </div>
    )
}

function AttendanceModal({ educationId, title, onClose }: any) {
    const { show: showToast } = useToast()
    const [attendees, setAttendees] = useState<any[]>([])
    const [scanning, setScanning] = useState(false)
    const [newAttendee, setNewAttendee] = useState({ name: '', birth: '', agency: '' })

    const scannerRef = useRef<Html5QrcodeScanner | null>(null)

    useEffect(() => {
        fetchAttendees()
        return () => { if (scannerRef.current) scannerRef.current.clear() }
    }, [])

    const fetchAttendees = async () => {
        try {
            const { data } = await apiClient.get(`/sms/educations/${educationId}`)
            setAttendees(data.attendees || [])
        } catch (e) { console.error(e) }
    }

    const handleScan = async (decodedText: string) => {
        try {
            if (scannerRef.current) scannerRef.current.pause(true)

            const data = JSON.parse(decodedText)
            const worker = { name: data.n, birth: data.b, agency: data.a || '미지정', signature: 'QR Checked' }

            await apiClient.post(`/sms/educations/${educationId}/attend`, { attendees: [worker] })
            showToast(`${worker.name}님 출석 확인`, 'success')
            await fetchAttendees()

        } catch (err) {
            console.error(err)
            showToast('QR 인식 실패', 'error')
        } finally {
            setTimeout(() => { if (scannerRef.current) scannerRef.current.resume() }, 1500)
        }
    }

    const startScan = () => {
        setScanning(true)
        setTimeout(() => {
            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render(handleScan, (err) => console.log(err));
            scannerRef.current = scanner
        }, 100)
    }

    const stopScan = () => {
        if (scannerRef.current) {
            scannerRef.current.clear()
            scannerRef.current = null
        }
        setScanning(false)
    }

    const manualAdd = async () => {
        if (!newAttendee.name) {
            showToast('이름을 입력하세요.', 'error')
            return
        }
        try {
            await apiClient.post(`/sms/educations/${educationId}/attend`, { attendees: [{ ...newAttendee, signature: 'Manual' }] })
            showToast('등록되었습니다.', 'success')
            fetchAttendees()
            setNewAttendee({ name: '', birth: '', agency: '' })
        } catch (e) { showToast('오류 발생', 'error') }
    }

    const slots = Array.from({ length: 20 }, (_, i) => attendees[i] || null)

    const isLate = (attendedAt: string) => {
        const attendTime = new Date(attendedAt)
        const educationStartTime = new Date(attendTime)
        educationStartTime.setHours(9, 0, 0, 0)
        const diffMinutes = (attendTime.getTime() - educationStartTime.getTime()) / (1000 * 60)
        return diffMinutes > 10
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <header className="modal-header">
                    <div>
                        <p className="eyebrow" style={{ marginBottom: 0 }}>출석 체크</p>
                        <h2 style={{ margin: 0 }}>{title}</h2>
                    </div>
                    <button className="btn-text" onClick={onClose}><X size={24} /></button>
                </header>

                <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
                    {!scanning ? (
                        <div className="panel action-card" onClick={startScan} style={{ cursor: 'pointer', border: '2px dashed var(--primary)', padding: '1.5rem', textAlign: 'center' }}>
                            <Camera size={40} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                            <h3 style={{ margin: '0.5rem 0' }}>QR 스캔 모드 (카메라)</h3>
                            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>※ 근로자 QR 코드는 PMS 직원 관리에서 발급받으세요.</p>
                        </div>
                    ) : (
                        <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                            <div id="reader" style={{ width: '100%' }}></div>
                            <button className="btn-secondary" onClick={stopScan} style={{ width: '100%', padding: '1rem', background: '#333', color: '#fff', border: 'none' }}>
                                스캔 종료
                            </button>
                        </div>
                    )}

                    <div className="panel" style={{ background: 'var(--bg-surface-hover)', padding: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0' }}>수동 입력</h4>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>이름</label>
                                <input className="input" placeholder="홍길동" value={newAttendee.name} onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>생년월일</label>
                                <input className="input" placeholder="800101" value={newAttendee.birth} onChange={e => setNewAttendee({ ...newAttendee, birth: e.target.value })} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>소속</label>
                                <input className="input" placeholder="OO건설" value={newAttendee.agency} onChange={e => setNewAttendee({ ...newAttendee, agency: e.target.value })} />
                            </div>
                            <button className="btn-primary" onClick={manualAdd} style={{ height: '42px' }}>등록</button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ margin: '0 0 1rem 0' }}>참석자 명단 ({attendees.length}/20명)</h4>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '1rem',
                            flex: 1,
                            overflow: 'hidden'
                        }}>
                            {slots.map((attendee, idx) => (
                                <div
                                    key={idx}
                                    className="card"
                                    style={{
                                        minHeight: '100px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        textAlign: 'center',
                                        background: attendee ? 'var(--bg-surface)' : 'var(--bg-surface-hover)',
                                        border: attendee ? '1px solid var(--primary)' : '1px dashed var(--border)',
                                        padding: '0.75rem'
                                    }}
                                >
                                    {attendee ? (
                                        <>
                                            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem 0', fontWeight: 500 }}>
                                                소속: {attendee.worker_agency || '미지정'}
                                            </p>
                                            <strong style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{attendee.worker_name}</strong>
                                            <p style={{
                                                fontSize: '0.75rem',
                                                margin: 0,
                                                color: isLate(attendee.attended_at) ? '#ff6b6b' : 'var(--text-secondary)',
                                                fontWeight: isLate(attendee.attended_at) ? 600 : 400
                                            }}>
                                                {new Date(attendee.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {isLate(attendee.attended_at) && ' (지각)'}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>대기 중</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
