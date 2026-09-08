-- SMS Risk Assessment Tables

-- 1. 위험성 평가 메인 (Risk Assessments)
CREATE TABLE IF NOT EXISTS sms_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, -- projects.id와 연동 (Optional constraint for now to avoid errors if project doesn't exist)
    process_name VARCHAR(255) NOT NULL, -- 공정명 (예: 철골 조립)
    assessor_name VARCHAR(100), -- 평가자
    approver_name VARCHAR(100), -- 승인자
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, REVIEW, APPROVED
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 위험성 평가 상세 항목 (Risk Items)
CREATE TABLE IF NOT EXISTS sms_risk_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES sms_risk_assessments(id) ON DELETE CASCADE,
    risk_factor TEXT NOT NULL, -- 위험 요인
    risk_type VARCHAR(100), -- 재해 형태 (추락, 협착 등)
    frequency INTEGER DEFAULT 1, -- 빈도 (1-5)
    severity INTEGER DEFAULT 1, -- 강도 (1-5)
    risk_level INTEGER GENERATED ALWAYS AS (frequency * severity) STORED, -- 위험성 (계산됨)
    mitigation_measure TEXT, -- 감소 대책
    action_manager VARCHAR(100), -- 조치 담당자
    action_deadline DATE, -- 조치 기한
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 일일 위험예지 (DRI / TBM)
CREATE TABLE IF NOT EXISTS sms_dris (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    date DATE DEFAULT CURRENT_DATE,
    location VARCHAR(255),
    work_content TEXT, -- 금일 작업 내용
    risk_points TEXT, -- 중점 위험 포인트
    attendees_count INTEGER DEFAULT 0,
    photo_url TEXT, -- TBM 사진
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
