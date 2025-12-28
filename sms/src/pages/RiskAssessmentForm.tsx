import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
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

    const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RiskAssessmentForm>({
        defaultValues: {
            projectId: '',
            processName: '',
            assessorName: '',
            items: [
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
    }, [])

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
                <button className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
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
                    <div className="section-header">
                        <h3>위험요소 및 대책</h3>
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
