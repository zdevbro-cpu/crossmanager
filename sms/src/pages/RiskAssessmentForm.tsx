import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { ArrowLeft, Plus, Trash2, Save, Layers, AlertCircle } from 'lucide-react'
import './Page.css'
import { apiClient } from '../lib/api'
import { useToast } from '../components/ToastProvider'

interface RiskItemForm {
    riskFactor: string
    riskType: string
    frequency: number
    severity: number
    mitigationMeasure: string
    actionManager: string
    actionDeadline: string
    hazardId?: number          // 라이브러리에서 가져온 항목의 출처
    hazardClass?: string
    legalBasis?: string
    currentControl?: string
    residualFrequency?: number // 개선 후 위험성 — 현장 양식의 필수 항목이다
    residualSeverity?: number
}

// 위험요인 라이브러리에서 고른 항목을 평가서 라인으로 바꾼다.
// 문서를 통째로 복사하지 않고 항목 단위로만 가져온다(설계 개요서 3.2).
function fromLibrary(): RiskItemForm[] | null {
    try {
        const raw = sessionStorage.getItem('ra_picked_hazards')
        if (!raw) return null
        const list = JSON.parse(raw)
        if (!Array.isArray(list) || list.length === 0) return null
        sessionStorage.removeItem('ra_picked_hazards')
        return list.map((h: any) => ({
            riskFactor: h.hazard_desc || '',
            riskType: h.accident_type_code || '기타',
            frequency: h.frequency || 1,
            severity: h.severity || 1,
            mitigationMeasure: h.reduction_measure || '',
            actionManager: '',
            actionDeadline: '',
            hazardId: h.id,
            hazardClass: h.hazard_class || '',
            legalBasis: h.legal_basis || '',
            currentControl: h.current_control || '',
            residualFrequency: h.residual_frequency || undefined,
            residualSeverity: h.residual_severity || undefined,
        }))
    } catch (e) {
        return null
    }
}

interface RiskAssessmentForm {
    projectId: string
    processName: string
    assessorName: string
    items: RiskItemForm[]
}

export default function RiskAssessmentFormPage() {
    const navigate = useNavigate()
    const { show: showToast } = useToast()
    const [projects, setProjects] = useState<any[]>([])

    // 공종을 고르면 그 공종의 위험요인이 세트로 들어온다.
    // 항목을 하나씩 담는 것보다 현장에서 쓰기 편하다 — 대부분 공종별로 비슷한 항목이 반복된다.
    const [workTypes, setWorkTypes] = useState<any[]>([])
    const [pickedWorkType, setPickedWorkType] = useState('')
    const [loadingSet, setLoadingSet] = useState(false)

    const { register, control, handleSubmit, watch, getValues, formState: { errors, isSubmitting } } = useForm<RiskAssessmentForm>({
        defaultValues: {
            projectId: '',
            processName: '',
            assessorName: '',
            items: fromLibrary() || [
                { riskFactor: '', riskType: '기타', frequency: 1, severity: 1, mitigationMeasure: '', actionManager: '', actionDeadline: '' }
            ]
        }
    })

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items'
    })

    // Load projects from PMS
    useEffect(() => {
        apiClient.get('/projects').then(res => setProjects(res.data)).catch(console.error)
        apiClient.get('/master/work-types').then(res => setWorkTypes(res.data)).catch(console.error)
    }, [])

    // 공종 세트 불러오기 — 기존 라인은 두고 뒤에 붙인다.
    const loadWorkTypeSet = async () => {
        if (!pickedWorkType) return showToast('공종을 먼저 고르세요.', 'error')
        setLoadingSet(true)
        try {
            const { data } = await apiClient.get('/master/hazard-items', {
                params: { workType: pickedWorkType, limit: '50' }
            })
            if (!data.length) {
                showToast('이 공종에는 검수를 통과한 위험요인이 아직 없습니다.', 'error')
                return
            }
            // 첫 줄이 비어 있으면 치우고 채운다.
            const cur = getValues('items')
            if (cur.length === 1 && !cur[0].riskFactor) remove(0)

            data.forEach((h: any) => append({
                riskFactor: h.hazard_desc || '',
                riskType: h.accident_type_code || '기타',
                frequency: h.frequency || 1,
                severity: h.severity || 1,
                mitigationMeasure: h.reduction_measure || '',
                actionManager: '',
                actionDeadline: '',
                hazardId: h.id,
                hazardClass: h.hazard_class || '',
                legalBasis: h.legal_basis || '',
                currentControl: h.current_control || '',
                residualFrequency: h.residual_frequency || undefined,
                residualSeverity: h.residual_severity || undefined,
            }))
            showToast(`${data.length}건을 불러왔습니다. 당일 작업에 맞게 고치고 지우십시오.`, 'success')
        } catch (err) {
            showToast('불러오기 실패', 'error')
        } finally {
            setLoadingSet(false)
        }
    }

    const onSubmit = async (data: RiskAssessmentForm) => {
        try {
            await apiClient.post('/sms/risk-assessments', data)
            showToast('위험성 평가가 성공적으로 저장되었습니다.', 'success')
            navigate('/sms/ra')
        } catch (err: any) {
            console.error(err)
            showToast('저장 중 오류가 발생했습니다.', 'error')
        }
    }

    // 위험성 등급 — 빈도x강도 점수를 내고 등급으로 치환한다.
    // 경계는 현장 RA 파일 142행을 역산해 확정했다(6/8/9=D, 10/12=C, 15/16=B, 20=A).
    const gradeOf = (f?: number, s?: number) => {
        if (!f || !s) return null
        const v = f * s
        return v >= 20 ? 'A' : v >= 15 ? 'B' : v >= 10 ? 'C' : v >= 5 ? 'D' : 'E'
    }

    // Calculate risk level helper
    const getRiskLevel = (freq: number, sev: number) => freq * sev
    const getRiskColor = (level: number) => {
        if (level >= 9) return 'badge-live' // High
        if (level >= 4) return 'badge-tag'  // Medium
        return 'badge'                      // Low
    }

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <button className="btn-text" onClick={() => navigate('/sms/ra')}>
                        <ArrowLeft size={16} /> 목록으로 돌아가기
                    </button>
                    <h1 style={{ marginTop: '0.5rem' }}>위험성 평가 작성</h1>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleSubmit(onSubmit, () => {
                        // 필수값이 비면 아무 반응이 없어 왜 안 되는지 알 수 없었다. 이유를 알려준다.
                        showToast('현장·공정명·작성자와 각 항목의 위험요인·감소대책을 채워야 저장됩니다.', 'error')
                    })}
                    disabled={isSubmitting}
                >
                    <Save size={18} />
                    {isSubmitting ? '저장 중...' : '저장하기'}
                </button>
            </header>

            <form className="form-layout">
                <section className="panel">
                    <h3>기본 정보</h3>
                    <div className="grid two">
                        <div className="form-group">
                            <label>현장 선택</label>
                            <select {...register('projectId', { required: true })} className="input">
                                <option value="">선택해주세요</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {errors.projectId && <span className="error-text">현장을 선택해주세요.</span>}
                        </div>
                        <div className="form-group">
                            <label>공정명</label>
                            <input
                                {...register('processName', { required: true })}
                                className="input"
                                placeholder="예: 지붕 패널 설치 작업"
                            />
                            {errors.processName && <span className="error-text">공정명을 입력해주세요.</span>}
                        </div>
                        <div className="form-group">
                            <label>작성자</label>
                            <input
                                {...register('assessorName', { required: true })}
                                className="input"
                                placeholder="작성자 성명"
                            />
                        </div>
                    </div>
                </section>

                <section className="panel">
                    {/*
                        공종을 고르면 그 공종의 위험요인이 한 번에 들어온다.
                        현장은 매번 비슷한 항목을 다루므로 하나씩 담는 것보다 빠르다.
                        불러온 뒤 당일 작업에 맞지 않는 줄을 지우고 값을 고치면 된다.
                    */}
                    <div className="card" style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <Layers size={18} />
                        <span className="muted" style={{ fontSize: '0.9rem' }}>공종 세트 불러오기</span>
                        <select
                            className="input"
                            value={pickedWorkType}
                            onChange={e => setPickedWorkType(e.target.value)}
                            style={{ width: 'auto', minWidth: 170 }}
                        >
                            <option value="">공종 선택</option>
                            {workTypes.map(w => (
                                <option key={w.work_type_code} value={w.work_type_code}>{w.name}</option>
                            ))}
                        </select>
                        <button type="button" className="btn-secondary" onClick={loadWorkTypeSet} disabled={loadingSet}>
                            {loadingSet ? '불러오는 중...' : '불러오기'}
                        </button>
                        <span className="muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertCircle size={13} />
                            검수를 통과한 항목만 들어옵니다. 불러온 뒤 지우거나 고칠 수 있습니다.
                        </span>
                    </div>

                    <div className="section-header">
                        <h3>위험요소 및 대책 ({fields.length}건)</h3>
                        <button type="button" className="btn-secondary" onClick={() => append({
                            riskFactor: '', riskType: '기타', frequency: 1, severity: 1,
                            mitigationMeasure: '', actionManager: '', actionDeadline: ''
                        })}>
                            <Plus size={16} /> 항목 추가
                        </button>
                    </div>

                    <div className="risk-items-container">
                        {fields.map((field, index) => {
                            const freq = watch(`items.${index}.frequency`)
                            const sev = watch(`items.${index}.severity`)
                            const riskLevel = getRiskLevel(freq, sev)

                            return (
                                <div key={field.id} className="risk-item-card">
                                    <div className="risk-item-header">
                                        <h4>#{index + 1} 위험요소</h4>
                                        <div className="risk-actions">
                                            <span className={`badge ${getRiskColor(riskLevel)}`}>
                                                위험도 {riskLevel} ({riskLevel >= 9 ? '상' : riskLevel >= 4 ? '중' : '하'})
                                            </span>
                                            <button type="button" className="icon-btn-danger" onClick={() => remove(index)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid two">
                                        <div className="form-group full">
                                            <label>위험 요인</label>
                                            <input
                                                {...register(`items.${index}.riskFactor` as const, { required: true })}
                                                className="input"
                                                placeholder="작업 중 발생 가능한 위험 상황 (예: 고소작업 중 추락)"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>재해 형태</label>
                                            <select {...register(`items.${index}.riskType` as const)} className="input">
                                                <option value="추락">추락</option>
                                                <option value="낙하">낙하</option>
                                                <option value="협착">협착</option>
                                                <option value="전도">전도</option>
                                                <option value="화재">화재</option>
                                                <option value="기타">기타</option>
                                            </select>
                                        </div>

                                        <div className="risk-score-group">
                                            <div className="form-group">
                                                <label>빈도 (1~5)</label>
                                                <input
                                                    type="number" min="1" max="5"
                                                    {...register(`items.${index}.frequency` as const, { valueAsNumber: true })}
                                                    className="input"
                                                />
                                            </div>
                                            <span className="x-mark">×</span>
                                            <div className="form-group">
                                                <label>강도 (1~5)</label>
                                                <input
                                                    type="number" min="1" max="5"
                                                    {...register(`items.${index}.severity` as const, { valueAsNumber: true })}
                                                    className="input"
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group full">
                                            <label>감소 대책</label>
                                            <textarea
                                                {...register(`items.${index}.mitigationMeasure` as const, { required: true })}
                                                className="input"
                                                rows={2}
                                                placeholder="구체적인 안전 조치 내용"
                                            />
                                        </div>

                                        {/*
                                            개선 후 위험성 — 현장 양식의 필수 항목이다.
                                            감소대책을 적용한 뒤 남는 위험을 다시 평가해 적는다.
                                        */}
                                        <div className="form-group full">
                                            <label>개선 후 위험성 (감소대책 적용 후)</label>
                                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span className="muted" style={{ fontSize: '0.85rem' }}>가능성</span>
                                                <select {...register(`items.${index}.residualFrequency` as const, { valueAsNumber: true })}
                                                    className="input" style={{ width: 72 }}>
                                                    <option value="">-</option>
                                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                                <span className="muted" style={{ fontSize: '0.85rem' }}>중대성</span>
                                                <select {...register(`items.${index}.residualSeverity` as const, { valueAsNumber: true })}
                                                    className="input" style={{ width: 72 }}>
                                                    <option value="">-</option>
                                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                                {(() => {
                                                    const rf = watch(`items.${index}.residualFrequency`)
                                                    const rs = watch(`items.${index}.residualSeverity`)
                                                    const g = gradeOf(rf, rs)
                                                    return g
                                                        ? <span className="badge badge-tag">{g} ({rf}×{rs}={(rf as number) * (rs as number)})</span>
                                                        : <span className="muted" style={{ fontSize: '0.8rem' }}>미입력</span>
                                                })()}
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>조치 담당자</label>
                                            <input
                                                {...register(`items.${index}.actionManager` as const)}
                                                className="input"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>조치 기한</label>
                                            <input
                                                type="date"
                                                {...register(`items.${index}.actionDeadline` as const)}
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            </form>
        </div>
    )
}
