
export interface RiskAssessment {
    id: string
    project_id: string | null
    process_name: string
    assessor_name: string | null
    approver_name: string | null
    status: 'DRAFT' | 'REVIEW' | 'APPROVED'
    date: string
    created_at: string
    updated_at: string
    item_count?: number
}

export interface RiskItem {
    id: string
    assessment_id: string
    risk_factor: string
    risk_type: string
    frequency: number
    severity: number
    risk_level?: number // client-side calculated or from view
    mitigation_measure: string
    action_manager: string
    action_deadline: string | null
    created_at: string
}

export interface Dri {
    id: string
    project_id: string | null
    date: string
    location: string
    work_content: string
    risk_points: string
    attendees_count: number
    photo_url: string | null
    status: string
    created_by: string
    created_at: string
}
