export type RiskLevel = '상' | '중' | '하';

export interface RiskItem {
    id: string;
    step: string;
    risk_factor: string;
    risk_factor_detail?: string; // Additional column 1
    risk_level: '상' | '중' | '하';
    measure: string;
    measure_detail?: string; // Additional column 2
    residual_risk: '상' | '중' | '하';
    action_officer: string;
    checker: string;
}

export interface RiskAssessmentProject {
    id: string;
    title: string; // e.g. "GH FAB 마감공사"
    construction_type: string; // e.g. "시스템 비계"
    created_at: string;
    updated_at: string;
    items: RiskItem[];
}
