-- ============================================================
-- 20260908_m0_core_master.sql   M0 — 기반 마스터
-- 근거: 크로스특수 통합관리시스템 상세설계서 v0.2 · 12.2절 M0
--
-- 설계 원칙 (개요서 3.1)
--   "표준화 대상은 서류가 아니라 데이터다. 발주처 양식은 영구히 통일되지 않는다."
--   → 코드도 마찬가지다. 크로스특수 자체 코드를 정본으로 두고,
--     발주처가 쓰는 코드·명칭은 매핑 테이블에 따로 보관한다.
--     현장 문서를 출력할 때만 발주처 표기로 바꿔 내보낸다.
--
-- 포함
--   1. code_group / code            코드 체계 (하드코딩 제거)
--   2. client                       발주처 + 크로스 자체 발주처코드
--   3. company / site_company       협력업체 (협력사 격리의 전제)
--   4. location                     위치·설비 — 크로스 자체 표준코드
--      location_client_code         발주처별 코드·명칭 매핑
--   5. user_account / role / user_role / role_permission
--
-- 전 구문 재실행 가능(idempotent). ON_ERROR_STOP=1 로 적용할 것.
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. 코드 체계
--    코드값이 소스에 하드코딩되어 있던 것을 데이터로 옮긴다(설계서 11.4.4).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_group (
    group_code   VARCHAR(30) PRIMARY KEY,
    group_name   VARCHAR(100) NOT NULL,
    description  TEXT,
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,  -- 업무 로직이 참조하는 그룹. 삭제 금지
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS code (
    id           BIGSERIAL PRIMARY KEY,
    group_code   VARCHAR(30) NOT NULL REFERENCES code_group(group_code) ON DELETE RESTRICT,
    code         VARCHAR(40) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    attr         JSONB,          -- 그룹별 부가 속성 (등급 경계값 등)
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_code, code)
);
CREATE INDEX IF NOT EXISTS idx_code_group ON code (group_code, sort_order) WHERE is_active;

-- ------------------------------------------------------------
-- 2. 발주처
--    projects.regulation_type('SAMSUNG','LG','GENERAL')이 발주처별 분기의
--    원시 형태로 이미 있다(설계서 11.4.4). 이를 마스터로 승격한다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client (
    id           BIGSERIAL PRIMARY KEY,
    client_code  VARCHAR(20) NOT NULL UNIQUE,   -- 크로스 자체 발주처 코드 (예: SMS, LGE)
    name         VARCHAR(100) NOT NULL,
    short_name   VARCHAR(40),
    regulation_type VARCHAR(20),                -- 기존 projects.regulation_type 대응
    memo         TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES client(id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects (client_id) WHERE is_hq = FALSE;

-- ------------------------------------------------------------
-- 3. 협력업체
--    StdFolder 파일 상당수가 협력사 작성분이다(개요서 8.1).
--    협력사 계정·격리가 없으면 문서를 계속 수기로 취합하게 된다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company (
    id            BIGSERIAL PRIMARY KEY,
    company_code  VARCHAR(20) NOT NULL UNIQUE,  -- 크로스 자체 업체 코드
    name          VARCHAR(150) NOT NULL,
    biz_reg_no    VARCHAR(20),                  -- 사업자등록번호
    ceo_name      VARCHAR(50),
    company_type  VARCHAR(20),                  -- CODE(COMPANY_TYPE): 자사/협력사/발주처/임대
    phone         VARCHAR(30),
    address       TEXT,
    contact_name  VARCHAR(50),
    contact_phone VARCHAR(30),
    contact_email VARCHAR(100),
    memo          TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_company_bizno ON company (biz_reg_no);

-- 현장에 투입된 업체. 협력사 계정의 접근 범위가 이 표로 결정된다.
CREATE TABLE IF NOT EXISTS site_company (
    id           BIGSERIAL PRIMARY KEY,
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    company_id   BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
    role_type    VARCHAR(20),      -- CODE(SITE_COMPANY_ROLE): 원청/수급/재하도급
    contract_from DATE,
    contract_to   DATE,
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_site_company_project ON site_company (project_id);

-- ------------------------------------------------------------
-- 4. 위치·설비  ★ 핵심
--    설계서가 "현재 누락된 가장 중요한 마스터"로 지목한 것(11.4.4).
--    RA·작업허가서·작업계획서·사진대지·점검일지가 모두 이 코드를 참조한다.
--
--    코드 정책
--      - code      : 각 단계의 크로스 자체 코드 (예: OC8, 1F, CR01)
--      - full_code : 상위부터 이어붙인 전체 코드 (예: OC8-1F-CR01)
--                    하위 전체 조회를 LIKE 'OC8-1F%' 한 번으로 처리한다(설계서 10.2).
--      - 발주처가 부르는 코드·명칭은 location_client_code 에 따로 둔다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location (
    id           BIGSERIAL PRIMARY KEY,
    project_id   UUID REFERENCES projects(id) ON DELETE RESTRICT,  -- NULL 이면 전사 공통
    parent_id    BIGINT REFERENCES location(id) ON DELETE RESTRICT,
    level_type   VARCHAR(20) NOT NULL,   -- CODE(LOCATION_LEVEL): BUILDING/FLOOR/ZONE/EQUIPMENT
    code         VARCHAR(30) NOT NULL,   -- 크로스 자체 코드 (해당 단계)
    full_code    VARCHAR(200) NOT NULL,  -- 상위 경로를 이어붙인 전체 코드
    name         VARCHAR(150) NOT NULL,  -- 크로스 표준 명칭
    sort_order   INTEGER NOT NULL DEFAULT 0,
    memo         TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_fullcode
    ON location (COALESCE(project_id, '00000000-0000-0000-0000-000000000001'::uuid), full_code)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_location_tree   ON location (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_location_prefix ON location (full_code varchar_pattern_ops);

COMMENT ON COLUMN location.full_code IS
  '크로스 자체 전체 코드. 하위 조회는 full_code LIKE ''상위코드%'' 로 한다.';

-- 발주처별 코드·명칭 매핑
--   같은 장소를 발주처마다 다르게 부른다.
--     LGES   "OC8동 1F 클린룸 및 반입구"
--     코오롱  "SR5"
--   크로스 코드를 정본으로 두고, 제출 서류를 렌더링할 때 이 표로 바꿔 쓴다.
CREATE TABLE IF NOT EXISTS location_client_code (
    id           BIGSERIAL PRIMARY KEY,
    location_id  BIGINT NOT NULL REFERENCES location(id) ON DELETE RESTRICT,
    client_id    BIGINT NOT NULL REFERENCES client(id) ON DELETE RESTRICT,
    client_code  VARCHAR(100),           -- 발주처가 쓰는 코드
    client_name  VARCHAR(200),           -- 발주처가 쓰는 명칭 (서류 출력용)
    memo         TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (location_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_loccode_client ON location_client_code (client_id, client_code);

COMMENT ON TABLE location_client_code IS
  '발주처별 위치 코드·명칭. 크로스 자체 코드가 정본이고 이 표는 출력용 별칭이다.';

-- ------------------------------------------------------------
-- 5. 계정·권한
--    현행은 created_by UUID 에 "추후 Users 연동" 주석만 있다(설계서 11.4.4).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role (
    role_code    VARCHAR(30) PRIMARY KEY,   -- HQ_SAFETY / SITE_MANAGER / PARTNER_MGR ...
    role_name    VARCHAR(100) NOT NULL,
    scope_type   VARCHAR(20) NOT NULL,      -- ALL / SITE / OWN_COMPANY / OWN (설계서 9.3)
    description  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_account (
    id           BIGSERIAL PRIMARY KEY,
    login_id     VARCHAR(60) NOT NULL UNIQUE,
    email        VARCHAR(120),
    name         VARCHAR(50) NOT NULL,
    phone        VARCHAR(30),
    company_id   BIGINT REFERENCES company(id),   -- 협력사 격리의 기준
    firebase_uid VARCHAR(128) UNIQUE,             -- 현행 Firebase Auth 연동
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING/ACTIVE/DISABLED
    last_login_at TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_company ON user_account (company_id) WHERE deleted_at IS NULL;

-- 역할 부여. site_id 가 있으면 그 현장으로 범위가 좁혀진다(설계서 9.3).
CREATE TABLE IF NOT EXISTS user_role (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    role_code    VARCHAR(30) NOT NULL REFERENCES role(role_code) ON DELETE RESTRICT,
    project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, role_code, project_id)
);

CREATE TABLE IF NOT EXISTS role_permission (
    id           BIGSERIAL PRIMARY KEY,
    role_code    VARCHAR(30) NOT NULL REFERENCES role(role_code) ON DELETE CASCADE,
    resource     VARCHAR(50) NOT NULL,   -- document / ra / worker / equipment ...
    can_read     BOOLEAN NOT NULL DEFAULT FALSE,
    can_create   BOOLEAN NOT NULL DEFAULT FALSE,
    can_update   BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (role_code, resource)
);

COMMIT;


-- ============================================================
-- 씨앗 데이터
-- ============================================================
BEGIN;

INSERT INTO code_group (group_code, group_name, description, is_system) VALUES
  ('DOC_CATEGORY',       '문서 대분류',   '개요서 부록 B 분류체계',        TRUE),
  ('DOC_PATTERN',        '문서 생성패턴', '개요서 5장 패턴 A~I',           TRUE),
  ('LOCATION_LEVEL',     '위치 단계',     '동/층/구역/설비',               TRUE),
  ('COMPANY_TYPE',       '업체 구분',     '자사/협력사/발주처/임대',       TRUE),
  ('SITE_COMPANY_ROLE',  '현장 업체 역할','원청/수급/재하도급',            TRUE),
  ('HAZARD_CLASS',       '위험 분류',     '현장 RA 실측 4종',              TRUE),
  ('ACCIDENT_TYPE',      '재해 형태',     '개요서 부록 A.3',               TRUE),
  ('PERMIT_TYPE',        '작업허가 유형', '일반/화기/고소/밀폐/중량물',    TRUE),
  ('QUAL_TYPE',          '자격 유형',     '지게차/굴착기/기초안전보건교육 등', TRUE),
  ('EQUIP_TYPE',         '장비 유형',     '굴착기/지게차/크레인 등',       TRUE),
  ('PPE_TYPE',           '보호구 유형',   '안전모/안전화/안전대 등',       TRUE)
ON CONFLICT (group_code) DO NOTHING;

INSERT INTO code (group_code, code, name, sort_order) VALUES
  ('DOC_CATEGORY','00_공무_행정','공무·행정',1),
  ('DOC_CATEGORY','01_안전_보건','안전·보건',2),
  ('DOC_CATEGORY','02_공사_작업','공사·작업',3),
  ('DOC_CATEGORY','03_장비_공도구','장비·공도구',4),
  ('DOC_CATEGORY','04_기록_자료','기록·자료',5),
  ('DOC_CATEGORY','99_미분류','미분류',99),

  ('DOC_PATTERN','A','마스터 파생형',1),
  ('DOC_PATTERN','B','일일 반복형',2),
  ('DOC_PATTERN','C','이벤트 승인형',3),
  ('DOC_PATTERN','D','증빙 수집형',4),
  ('DOC_PATTERN','E','정기 집계형',5),
  ('DOC_PATTERN','F','참조·수신형',6),
  ('DOC_PATTERN','G','기획 문서형',7),
  ('DOC_PATTERN','H','현장 운영·총무형',8),
  ('DOC_PATTERN','I','게시물·출력물형',9),

  ('LOCATION_LEVEL','BUILDING','동',1),
  ('LOCATION_LEVEL','FLOOR','층',2),
  ('LOCATION_LEVEL','ZONE','구역',3),
  ('LOCATION_LEVEL','EQUIPMENT','설비',4),

  ('COMPANY_TYPE','SELF','자사',1),
  ('COMPANY_TYPE','PARTNER','협력사',2),
  ('COMPANY_TYPE','CLIENT','발주처',3),
  ('COMPANY_TYPE','RENTAL','임대',4),

  ('SITE_COMPANY_ROLE','PRIME','원청',1),
  ('SITE_COMPANY_ROLE','SUB','수급',2),
  ('SITE_COMPANY_ROLE','SUBSUB','재하도급',3),

  ('HAZARD_CLASS','ENV','작업환경',1),
  ('HAZARD_CLASS','CHEM','화학적',2),
  ('HAZARD_CLASS','MECH','기계적',3),
  ('HAZARD_CLASS','TECH','기술적',4),

  ('ACCIDENT_TYPE','FALL_SAME','넘어짐',1),
  ('ACCIDENT_TYPE','OVERTURN','전도',2),
  ('ACCIDENT_TYPE','COLLISION','충돌',3),
  ('ACCIDENT_TYPE','COLLAPSE','붕괴',4),
  ('ACCIDENT_TYPE','FIRE','화재',5),
  ('ACCIDENT_TYPE','EXPLOSION','폭발',6),
  ('ACCIDENT_TYPE','FALL_HIGH','추락',7),
  ('ACCIDENT_TYPE','DROP','낙하',8),
  ('ACCIDENT_TYPE','CAUGHT','협착',9),
  ('ACCIDENT_TYPE','SHOCK','감전',10),
  ('ACCIDENT_TYPE','CUT','베임',11),
  ('ACCIDENT_TYPE','PIERCE','찔림',12),
  ('ACCIDENT_TYPE','STRUCK','부딪힘',13),
  ('ACCIDENT_TYPE','HEALTH','건강장애',14),
  ('ACCIDENT_TYPE','MSD','근골격계',15),

  ('PERMIT_TYPE','GENERAL','일반작업',1),
  ('PERMIT_TYPE','HOT_WORK','화기작업',2),
  ('PERMIT_TYPE','HEIGHT','고소작업',3),
  ('PERMIT_TYPE','CONFINED','밀폐공간',4),
  ('PERMIT_TYPE','LIFTING','중량물',5)
ON CONFLICT (group_code, code) DO NOTHING;

-- 발주처 — 개요서 2.2절에서 관찰된 5개 현장의 발주처
INSERT INTO client (client_code, name, short_name, regulation_type) VALUES
  ('SMS','삼성물산','삼성물산','SAMSUNG'),
  ('LGE','LG에너지솔루션','LGES','LG'),
  ('LGD','LG디스플레이','LGD','LG'),
  ('KOL','코오롱','코오롱','GENERAL'),
  ('DWF','동우화인켐','동우화인켐','GENERAL')
ON CONFLICT (client_code) DO NOTHING;

-- 역할 — 설계서 9.1
INSERT INTO role (role_code, role_name, scope_type, description) VALUES
  ('HQ_ADMIN','본사 관리자','ALL','마스터·사용자·권한·코드 관리'),
  ('HQ_SAFETY','본사 안전관리팀','ALL','전 현장 조회, 회사 표준 RA·라이브러리 관리'),
  ('SITE_MANAGER','현장소장','SITE','담당 현장 전체 조회·승인'),
  ('SITE_SAFETY','현장 안전관리자','SITE','RA·TBM·점검·교육 작성 및 제출 관리'),
  ('SUPERVISOR','관리감독자','SITE','담당 공종 RA 승인, 작업허가 승인, TBM 진행'),
  ('PARTNER_MGR','협력사 담당자','OWN_COMPANY','자사 근로자·장비 등록, 자사 문서 작성·제출'),
  ('AUDITOR','감사·조회 전용','ALL','전 현장 문서 조회. 수정 불가. 민감정보 제외'),
  ('HEALTH_OFFICER','보건 담당','ALL','건강정보 접근 가능한 유일한 역할')
ON CONFLICT (role_code) DO NOTHING;

COMMIT;


-- ============================================================
-- ROLLBACK — 필요 시 수동 실행
--
-- BEGIN;
-- DROP TABLE IF EXISTS role_permission, user_role, user_account, role;
-- DROP TABLE IF EXISTS location_client_code, location;
-- DROP TABLE IF EXISTS site_company, company;
-- ALTER TABLE projects DROP COLUMN IF EXISTS client_id;
-- DROP TABLE IF EXISTS client;
-- DROP TABLE IF EXISTS code, code_group;
-- COMMIT;
-- ============================================================
