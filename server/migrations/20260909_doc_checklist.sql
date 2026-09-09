-- 프로젝트 문서 체크리스트 준비
--
-- 왜 필요한가
--   프로젝트마다 내야 할 서류 목록(client_required_doc)에 양식을 붙이려면
--   행마다 문서유형(doc_type_code)이 있어야 한다. template 이 doc_type_code 로
--   걸리기 때문이다. 24건 중 12건이 라벨만 있고 문서유형이 비어 있어
--   양식을 걸 자리가 없었다.
--
--   발주처 프로파일이 없는 신규 발주처는 체크리스트가 통째로 비므로,
--   그때 쓸 크로스 기본 프로파일을 둔다.

-- 1) 없는 문서유형을 먼저 만든다 --------------------------------------
-- 라벨만 있던 12건을 억지로 기존 유형에 밀어 넣으면 서류 성격이 뒤섞인다.
-- 실제로 다른 서류인 것은 유형을 새로 만든다.
INSERT INTO doc_type (doc_type_code, name, category_code, sort_order, is_personal_data, require_approval, is_active) VALUES
    ('PRIVACY_CONSENT', '개인정보 동의서',        '00_공무_행정', 20, TRUE,  FALSE, TRUE),
    ('PLEDGE',          '서약서',                '00_공무_행정', 21, FALSE, FALSE, TRUE),
    ('CHEM_REPORT',     '화관법 도급신고',        '00_공무_행정', 22, FALSE, TRUE,  TRUE),
    ('SUBCON_ROSTER',   '관계수급인 인원정보',     '00_공무_행정', 23, TRUE,  FALSE, TRUE),
    ('HEALTH_DECL',     '건강상태 확인서',        '01_안전_보건', 20, TRUE,  FALSE, TRUE),
    ('SAFE_WORK_PLAN',  '안전작업계획서',         '02_공사_작업', 20, FALSE, TRUE,  TRUE),
    ('LIFT_SIGNAGE',    '중량물 안내표식',        '02_공사_작업', 21, FALSE, FALSE, TRUE),
    ('DOC_PACKAGE',     '필수서류 묶음',          '00_공무_행정', 24, FALSE, FALSE, TRUE),
    ('SAFETY_INFO_CHK', '안전정보 제공 체크리스트', '01_안전_보건', 21, FALSE, FALSE, TRUE)
ON CONFLICT (doc_type_code) DO NOTHING;

-- 2) 비어 있던 12건에 문서유형을 붙인다 --------------------------------
-- 안전작업계획서 1~3단계는 같은 서류의 단계 구분이라 한 유형으로 묶는다.
-- 라벨(doc_label)에 단계가 남아 있어 화면에서는 그대로 구분된다.
UPDATE client_required_doc SET doc_type_code = 'PRIVACY_CONSENT' WHERE doc_type_code IS NULL AND doc_label = '개인정보 동의서';
UPDATE client_required_doc SET doc_type_code = 'CHEM_REPORT'     WHERE doc_type_code IS NULL AND doc_label = '화관법 도급신고';
UPDATE client_required_doc SET doc_type_code = 'PLEDGE'          WHERE doc_type_code IS NULL AND doc_label = '서약서';
UPDATE client_required_doc SET doc_type_code = 'HEALTH_DECL'     WHERE doc_type_code IS NULL AND doc_label = '건강상태 확인서';
UPDATE client_required_doc SET doc_type_code = 'SAFE_WORK_PLAN'  WHERE doc_type_code IS NULL AND doc_label LIKE '안전작업계획서%';
UPDATE client_required_doc SET doc_type_code = 'LIFT_SIGNAGE'    WHERE doc_type_code IS NULL AND doc_label = '중량물 안내표식';
UPDATE client_required_doc SET doc_type_code = 'SUBCON_ROSTER'   WHERE doc_type_code IS NULL AND doc_label = '관계수급인 인원정보';
UPDATE client_required_doc SET doc_type_code = 'DOC_PACKAGE'     WHERE doc_type_code IS NULL AND doc_label LIKE '%필수서류';
UPDATE client_required_doc SET doc_type_code = 'SAFETY_INFO_CHK' WHERE doc_type_code IS NULL AND doc_label LIKE '안전정보 제공%';

-- 3) 크로스 기본 프로파일 ---------------------------------------------
-- 발주처가 정해지지 않았거나 프로파일이 없는 발주처(코오롱·동우화인켐)의
-- 현장은 체크리스트가 비어 버린다. 그때 이 목록을 쓴다.
-- client_id 가 NULL 인 프로파일이 '기본'이다.
ALTER TABLE client_profile ALTER COLUMN client_id DROP NOT NULL;

INSERT INTO client_profile (client_id, profile_name, version, is_active, memo)
SELECT NULL, '크로스 기본 프로파일', '1.0', TRUE,
       '발주처 미지정 또는 발주처 프로파일이 없을 때 쓰는 기본 체크리스트'
 WHERE NOT EXISTS (SELECT 1 FROM client_profile WHERE client_id IS NULL);

-- 기본 체크리스트 항목. 발주처를 가리지 않고 현장이면 대개 내는 서류다.
INSERT INTO client_required_doc (profile_id, scope, doc_type_code, doc_label, is_required, sort_order)
SELECT p.id, v.scope, v.code, v.label, v.req, v.ord
  FROM client_profile p
  CROSS JOIN (VALUES
    ('SITE', 'BIZ_LICENSE',    '사업자등록증',        TRUE,  1),
    ('SITE', 'INSURANCE_CERT', '산재보험 가입증명원',  TRUE,  2),
    ('SITE', 'APPOINTMENT',    '선임계',             TRUE,  3),
    ('SITE', 'ORG_CHART',      '조직도·비상연락망',    TRUE,  4),
    ('SITE', 'WORKER_LIST',    '근로자 명부·투입명단',  TRUE,  5),
    ('SITE', 'HEALTH_EXAM',    '건강검진 결과서',      TRUE,  6),
    ('SITE', 'SAFETY_EDU',     '안전교육 일지',       TRUE,  7),
    ('SITE', 'PPE_ISSUE',      '보호구 지급대장',      TRUE,  8),
    ('WORK', 'RA',             '위험성평가서',        TRUE,  9),
    ('WORK', 'TBM',            'TBM 일지',           TRUE, 10),
    ('WORK', 'WORK_PLAN',      '작업계획서',          TRUE, 11),
    ('WORK', 'WORK_PERMIT',    '작업허가서',          FALSE, 12),
    ('WORK', 'INSPECT_PATROL', '순회 점검일지',       TRUE, 13),
    ('WORK', 'EQUIP_DOC',      '장비 서류',           FALSE, 14),
    ('WORK', 'PHOTO_SHEET',    '사진대지',            FALSE, 15)
  ) AS v(scope, code, label, req, ord)
 WHERE p.client_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM client_required_doc r WHERE r.profile_id = p.id);

-- 4) 양식 저장 방식 ----------------------------------------------------
-- 문서 29종 전부에 열 매핑을 요구하면 쓸 수 없다. 두 갈래로 나눈다.
--   XLSX_CELL  RA·TBM 처럼 데이터를 채워 출력하는 양식(열 매핑 필요)
--   FILE       나머지. 빈 양식을 받아 두고 내려받아 손으로 작성한다
-- engine 컬럼이 이미 있어 값만 구분해 쓴다. 스키마 변경은 없다.
COMMENT ON COLUMN template.engine IS 'XLSX_CELL(데이터 렌더링) | FILE(서식 보관)';

CREATE INDEX IF NOT EXISTS idx_template_doctype ON template (doc_type_code);
CREATE INDEX IF NOT EXISTS idx_req_doc_profile  ON client_required_doc (profile_id);
