
-- 기존 테이블 삭제 (초기 개발 단계에서 스키마 변경 용이성을 위해)
DROP TABLE IF EXISTS scraps CASCADE;
DROP TABLE IF EXISTS safety_checklist_items CASCADE;
DROP TABLE IF EXISTS safety_checklists CASCADE;
DROP TABLE IF EXISTS safety_educations CASCADE;
DROP TABLE IF EXISTS safety_incidents CASCADE;
DROP TABLE IF EXISTS resource_assignments CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;
DROP TABLE IF EXISTS equipments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ==========================================
-- 1. PMS (프로젝트 관리)
-- ==========================================

-- 프로젝트 기본 정보
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    client VARCHAR(100), -- 발주처 (삼성, LG 등)
    address TEXT,
    start_date DATE,
    end_date DATE,
    description TEXT,
    security_level VARCHAR(20) DEFAULT '일반', -- 보안등급
    pm_name VARCHAR(100), -- PM 실명 (추후 Users 테이블 연동 가능)
    regulation_type VARCHAR(20), -- 'SAMSUNG', 'LG', 'GENERAL'
    status VARCHAR(20) DEFAULT 'PREPARING', -- PREPARING, RUNNING, COMPLETED, HOLD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 계약 관리 (견적, 변경계약 포함)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(20), -- EST(견적), CONTRACT(계약), CHANGE(변경)
    name VARCHAR(255),
    amount DECIMAL(15, 2), -- 금액
    contract_date DATE,
    status VARCHAR(20), -- DRAFT, REVIEW, SIGNED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 공정/작업 (WBS)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id), -- 계층 구조 지원
    name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    progress INT DEFAULT 0, -- 진행률 (0~100)
    status VARCHAR(20) DEFAULT 'READY', -- READY, IN_PROGRESS, DONE
    is_milestone BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0, -- 정렬 순서
    predecessors TEXT[], -- 선행 작업 ID 목록
    weight INT DEFAULT 1, -- 가중치
    delay_risk BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. RMS (자원 관리 - 장비/인력)
-- ==========================================

-- 장비 마스터
CREATE TABLE equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- 장비명 (예: 굴삭기 06w)
    code VARCHAR(50) UNIQUE, -- 관리번호
    type VARCHAR(50), -- EXCAVATOR, CRANE, TRUCK...
    spec VARCHAR(100), -- 규격 (0.6W, 10T 등)
    location VARCHAR(100), -- 현재 위치 (본사, 파주, 현장명)
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, IN_USE, MAINTENANCE(정비중)
    maintenance_due_date DATE, -- 다음 정비 예정일
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인력 마스터
CREATE TABLE personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50), -- OPERATOR(기사), WORKER(작업자), MANAGER(관리자)
    qualifications TEXT[], -- 자격증 목록 (Array)
    security_clearance VARCHAR(20), -- 보안 등급
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 자원 배차/투입 (Assignments)
CREATE TABLE resource_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    resource_type VARCHAR(20), -- EQUIPMENT, PERSON
    resource_id UUID NOT NULL, -- equipments.id or personnel.id
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PLANNED', -- PLANNED, ACTIVE, COMPLETED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. SMS (안전 관리)
-- ==========================================

-- 사고/아차사고 기록
CREATE TABLE safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(20), -- ACCIDENT(사고), NEARMISS(아차사고)
    occurred_at TIMESTAMP,
    location VARCHAR(255),
    description TEXT,
    severity VARCHAR(20), -- HIGH, MEDIUM, LOW
    action_taken TEXT, -- 조치사항
    reporter_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 안전 교육 이력
CREATE TABLE safety_educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    education_name VARCHAR(255), -- 교육명
    education_date DATE,
    valid_until DATE, -- 유효기간
    completion_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 안전 점검표 (Checklist Master)
CREATE TABLE safety_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    inspector_name VARCHAR(100),
    type VARCHAR(50), -- DAILY(일일), SPECIAL(특별), PRE_WORK(작업전)
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, COMPLETED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 점검 항목 및 결과
CREATE TABLE safety_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID REFERENCES safety_checklists(id) ON DELETE CASCADE,
    category VARCHAR(50), -- 보호구, 장비, 환경 등
    check_item VARCHAR(255), -- 점검 내용 (예: 안전모 착용 확인)
    result VARCHAR(10), -- OK, NG, NA
    photo_url TEXT, -- 증빙 사진 URL
    comment TEXT, -- 지적사항
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. SWMS (스크랩/폐기물 관리)
-- ==========================================

-- 반출/계근 기록
CREATE TABLE scraps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- 반출일
    item_type VARCHAR(50), -- IRON(고철), COPPER(구리), WASTE(폐기물)
    vehicle_no VARCHAR(20), -- 차량번호
    driver_name VARCHAR(50),
    estimated_weight DECIMAL(10, 2), -- 목측 중량
    actual_weight DECIMAL(10, 2), -- 실측 중량 (계근값)
    unit_price DECIMAL(10, 2), -- 단가 (선택)
    total_price DECIMAL(15, 2), -- 총액 (선택)
    ticket_image_url TEXT, -- 계근표 사진
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 샘플 데이터 입력
-- ==========================================

-- 1. 프로젝트
INSERT INTO projects (code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status)
VALUES 
('PJ-2024-001', '평택 P3 설비 해체 공사', '삼성전자', '경기도 평택시 고덕면', '2024-03-01', '2024-08-31', 'SECRET', '김현장', 'SAMSUNG', 'RUNNING'),
('PJ-2024-002', '파주 LGD 라인 철거', 'LG디스플레이', '경기도 파주시 월롱면', '2024-04-15', '2024-10-15', 'CONFIDENTIAL', '이철거', 'LG', 'PREPARING');

-- 2. 장비
INSERT INTO equipments (name, code, type, spec, location, status)
VALUES 
('볼보 06W', 'EQ-001', 'EXCAVATOR', '0.6W', 'PJ-2024-001', 'IN_USE'),
('현대 10T 덤프', 'EQ-002', 'DUMP', '10T', '본사 주기장', 'AVAILABLE');

-- 3. 인력
INSERT INTO personnel (name, role, qualifications, security_clearance)
VALUES 
('박기사', 'OPERATOR', ARRAY['굴삭기운전기능사', '대형면허'], 'A등급'),
('최반장', 'MANAGER', ARRAY['산업안전기사'], 'S등급');

-- 4. 스크랩 반출 내역
INSERT INTO scraps (project_id, date, item_type, vehicle_no, actual_weight, status)
VALUES 
((SELECT id FROM projects WHERE code='PJ-2024-001'), CURRENT_DATE, 'IRON', '82가1234', 12500.50, 'CONFIRMED');

