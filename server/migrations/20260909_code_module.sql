-- 공통코드 모듈 구분
--
-- 왜 필요한가
--   code_group 11개가 한 덩어리로 나온다. SWMS·PMS 코드가 붙으면 뒤섞여
--   모듈 담당자가 자기 코드를 찾을 수 없다.
--
-- 왜 테이블을 쪼개지 않는가
--   company · location · site_company · documents 는 SMS·DMS·PMS 가 함께 쓰는
--   테이블이다. 코드를 모듈별로 물리 분리하면 같은 협력업체가 모듈마다 다른
--   유형으로 보인다. 그래서 저장은 한 곳에 두고 module 로 소유만 나눈다.
--   조회는 '해당 모듈 + COMMON' 을 함께 돌려준다.

ALTER TABLE code_group
    ADD COLUMN IF NOT EXISTS module varchar(10) NOT NULL DEFAULT 'COMMON';

COMMENT ON COLUMN code_group.module IS 'COMMON | SMS | DMS | PMS | EMS | SWMS — 편집 권한이 있는 모듈';

CREATE INDEX IF NOT EXISTS idx_code_group_module ON code_group (module);

-- 기존 11개 분류 --------------------------------------------------------
-- COMMON: 공유 마스터(company/location/site_company)가 참조하므로 모듈 소유가 될 수 없다.
UPDATE code_group SET module = 'COMMON'
 WHERE group_code IN ('COMPANY_TYPE', 'LOCATION_LEVEL', 'SITE_COMPANY_ROLE');

UPDATE code_group SET module = 'SMS'
 WHERE group_code IN ('HAZARD_CLASS', 'ACCIDENT_TYPE', 'PERMIT_TYPE', 'PPE_TYPE', 'QUAL_TYPE');

UPDATE code_group SET module = 'DMS'
 WHERE group_code IN ('DOC_CATEGORY', 'DOC_PATTERN');

UPDATE code_group SET module = 'EMS'
 WHERE group_code IN ('EQUIP_TYPE');

-- 신설 코드군 ------------------------------------------------------------
-- WASTE_TYPE 은 만들지 않는다. swms_material_types 가 분류·단위·단가·심볼까지
-- 이미 관리하고 있어 중복된다.
INSERT INTO code_group (group_code, group_name, description, module, is_system) VALUES
    ('YN',              '예/아니오',        '공통 불리언 표기',                    'COMMON', TRUE),
    ('UNIT',            '단위',            '수량 단위',                          'COMMON', TRUE),
    ('RISK_GRADE',      '위험성 등급',      '빈도×강도 점수를 치환한 등급',          'SMS',    TRUE),
    ('DOC_STATUS',      '문서 상태',        'documents.status',                   'DMS',    TRUE),
    ('RETENTION_CLASS', '보존 등급',        '문서 보존연한 분류',                   'DMS',    FALSE),
    ('PROJECT_STATUS',  '프로젝트 상태',    'projects.status',                    'PMS',    TRUE),
    ('CONTRACT_TYPE',   '계약 유형',        NULL,                                 'PMS',    FALSE),
    ('RESOURCE_TYPE',   '자원 유형',        NULL,                                 'PMS',    FALSE),
    ('MAINT_TYPE',      '정비 유형',        NULL,                                 'EMS',    FALSE),
    ('INSPECT_RESULT',  '검사 결과',        NULL,                                 'EMS',    FALSE),
    ('VEHICLE_TYPE',    '차량 유형',        '계근·운반 차량',                      'SWMS',   FALSE),
    ('SETTLE_STATUS',   '정산 상태',        NULL,                                 'SWMS',   FALSE)
ON CONFLICT (group_code) DO UPDATE SET module = EXCLUDED.module;

-- 값이 확인된 것만 채운다. 나머지는 마스터 화면에서 입력한다.
INSERT INTO code (group_code, code, name, sort_order, attr) VALUES
    ('YN', 'Y', '예',   1, NULL),
    ('YN', 'N', '아니오', 2, NULL),

    ('UNIT', 'EA',   '개',   1, NULL),
    ('UNIT', 'SET',  '식',   2, NULL),
    ('UNIT', 'M',    'm',    3, NULL),
    ('UNIT', 'M2',   '㎡',   4, NULL),
    ('UNIT', 'M3',   '㎥',   5, NULL),
    ('UNIT', 'TON',  '톤',   6, NULL),
    ('UNIT', 'KG',   'kg',   7, NULL),
    ('UNIT', 'HOUR', '시간', 8, NULL),
    ('UNIT', 'DAY',  '일',   9, NULL),

    -- 현장 파일 142행을 역산해 확인한 경계값이다(20~25=A … 1~4=E).
    ('RISK_GRADE', 'A', '매우 높음', 1, '{"min":20,"max":25,"action":"작업중지"}'),
    ('RISK_GRADE', 'B', '높음',     2, '{"min":15,"max":19,"action":"즉시개선"}'),
    ('RISK_GRADE', 'C', '보통',     3, '{"min":10,"max":14,"action":"개선필요"}'),
    ('RISK_GRADE', 'D', '낮음',     4, '{"min":5,"max":9,"action":"현행유지"}'),
    ('RISK_GRADE', 'E', '매우 낮음', 5, '{"min":1,"max":4,"action":"현행유지"}'),

    -- 실제 documents.status 값(DRAFT 10건 / ACTIVE 558건)
    ('DOC_STATUS', 'DRAFT',  '작성중', 1, NULL),
    ('DOC_STATUS', 'ACTIVE', '유효',   2, NULL),

    -- 실제 projects.status 값(ACTIVE 2건 / RUNNING 1건). 두 값이 혼재한다.
    ('PROJECT_STATUS', 'ACTIVE',  '진행',   1, NULL),
    ('PROJECT_STATUS', 'RUNNING', '진행중', 2, NULL)
ON CONFLICT DO NOTHING;
