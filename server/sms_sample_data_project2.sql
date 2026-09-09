-- 프로젝트 2의 기존 SMS 데이터 삭제
DELETE FROM sms_document_comments WHERE document_id IN (SELECT id FROM sms_documents WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002'));
DELETE FROM sms_incident_photos WHERE incident_id IN (SELECT id FROM sms_incidents WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002'));
DELETE FROM sms_education_attendees WHERE education_id IN (SELECT id FROM sms_educations WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002'));
DELETE FROM sms_documents WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_incidents WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_educations WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_personnel WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_patrols WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_checklists WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_risk_items WHERE assessment_id IN (SELECT id FROM sms_risk_assessments WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002'));
DELETE FROM sms_risk_assessments WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');
DELETE FROM sms_dris WHERE project_id = (SELECT id FROM projects WHERE code='PJ-2024-002');

-- 파주 LGD 프로젝트에 명확하게 구분되는 샘플 데이터 추가
-- 특징: 프로젝트 1과 완전히 다른 내용, 더 많은 데이터

-- 1. 체크리스트 (프로젝트 1은 0건, 프로젝트 2는 5건으로 명확한 차이)
INSERT INTO sms_checklists (project_id, template_id, title, status, results, created_by, created_at)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'TPL002',
    '굴착기 작업 안전 점검',
    'COMPLETED',
    '{"0":"Y","1":"Y","2":"Y","3":"Y","4":"Y"}',
    '파주현장 안전팀',
    '2024-12-01 08:00:00'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'TPL004',
    '비계 설치 및 해체 안전 점검',
    'COMPLETED',
    '{"0":"Y","1":"N","2":"Y","3":"Y","4":"Y"}',
    '파주현장 안전팀',
    '2024-12-02 09:30:00'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'TPL005',
    '밀폐구역 작업 전 점검',
    'COMPLETED',
    '{"0":"Y","1":"Y","2":"Y","3":"N","4":"Y"}',
    '파주현장 안전팀',
    '2024-12-03 07:45:00'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'TPL006',
    '철근 배근 작업 점검',
    'COMPLETED',
    '{"0":"Y","1":"Y","2":"Y","3":"Y","4":"Y"}',
    '파주현장 안전팀',
    '2024-12-04 10:15:00'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'TPL008',
    '가설 통로 및 계단 점검',
    'COMPLETED',
    '{"0":"Y","1":"Y","2":"N","3":"Y","4":"Y"}',
    '파주현장 안전팀',
    CURRENT_TIMESTAMP
);

-- 2. DRI (프로젝트 2만의 특색있는 내용)
INSERT INTO sms_dris (project_id, date, location, work_content, risk_points, attendees_count, status, created_by)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '2024-12-01',
    '파주 LGD A동 클린룸',
    'LCD 패널 분리 및 포장 작업',
    '유리 파편 주의! 안전장갑 필수 착용, 작업구역 출입통제 철저',
    12,
    'COMPLETED',
    '이파주'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '2024-12-02',
    '파주 LGD B동 외부',
    '크레인을 이용한 대형 장비 반출',
    '크레인 작업반경 내 접근금지, 신호수 2명 배치, 안전모 착용',
    15,
    'COMPLETED',
    '이파주'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '2024-12-03',
    '파주 LGD C동 지하',
    '지하 배관 철거 작업',
    '밀폐공간 작업! 산소농도 측정 필수, 환기팬 가동, 감시인 배치',
    8,
    'COMPLETED',
    '이파주'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '2024-12-04',
    '파주 LGD 야적장',
    '폐기물 분류 및 적재',
    '중장비 이동 경로 확보, 작업자 안전거리 유지, 분진 마스크 착용',
    10,
    'COMPLETED',
    '이파주'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    CURRENT_DATE,
    '파주 LGD D동 옥상',
    '옥상 냉각탑 해체 작업',
    '고소작업! 안전난간 설치 확인, 안전대 체결, 강풍 시 작업중지',
    6,
    'COMPLETED',
    '이파주'
);

-- 3. 위험성평가
INSERT INTO sms_risk_assessments (project_id, process_name, assessor_name, approver_name, status, date)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'), 
    'LCD 패널 해체 및 분리', 
    '이파주', 
    '김LG', 
    'APPROVED', 
    '2024-11-25'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'), 
    '클린룸 천장 패널 철거', 
    '이파주', 
    '김LG', 
    'APPROVED', 
    '2024-11-28'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'), 
    '지하 배관 및 덕트 철거', 
    '이파주', 
    '김LG', 
    'DRAFT', 
    CURRENT_DATE
);

-- 위험성평가 항목
INSERT INTO sms_risk_items (assessment_id, risk_factor, risk_type, frequency, severity, mitigation_measure, action_manager)
VALUES 
(
    (SELECT id FROM sms_risk_assessments WHERE process_name='LCD 패널 해체 및 분리' AND project_id = (SELECT id FROM projects WHERE code='PJ-2024-002') LIMIT 1),
    'LCD 패널 낙하로 인한 작업자 충격',
    '낙하/비래',
    4,
    5,
    '안전그물 설치, 작업구역 통제선 설치, 안전모 착용 의무화',
    '박파주'
),
(
    (SELECT id FROM sms_risk_assessments WHERE process_name='클린룸 천장 패널 철거' AND project_id = (SELECT id FROM projects WHERE code='PJ-2024-002') LIMIT 1),
    '고소작업 중 추락 위험',
    '추락',
    3,
    5,
    '이동식 비계 사용, 안전대 착용, 작업발판 설치',
    '최파주'
);

-- 4. 순찰 기록
INSERT INTO sms_patrols (project_id, location, issue_type, severity, description, action_required, status, created_by)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '파주 A동 클린룸 입구',
    '출입통제 미흡',
    'HIGH',
    '무단 출입자 발견, 출입증 미착용',
    '출입통제 강화, 경비 인원 추가 배치',
    'RESOLVED',
    '김파주순찰'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '파주 B동 외부 야적장',
    '정리정돈 불량',
    'MEDIUM',
    '폐기물 무단 적재, 통로 확보 안됨',
    '폐기물 분류 및 정리, 통로 확보',
    'OPEN',
    '김파주순찰'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '파주 C동 지하 작업장',
    '환기 불량',
    'HIGH',
    '밀폐공간 환기팬 미가동 상태',
    '즉시 환기팬 가동, 산소농도 측정',
    'RESOLVED',
    '김파주순찰'
);

-- 5. 교육
INSERT INTO sms_educations (project_id, title, type, instructor, date, place, content, status)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    'LG 클린룸 작업 특별교육',
    '특별안전교육',
    '김LG안전',
    '2024-11-20',
    '파주 현장 교육장',
    'LG 클린룸 출입 절차, 정전기 방지, 청정복 착용법, 비상대피 절차',
    'COMPLETED'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '밀폐공간 작업 안전교육',
    '특별안전교육',
    '이파주',
    '2024-12-01',
    '파주 현장 교육장',
    '밀폐공간 정의, 산소농도 측정, 환기 방법, 비상구출 절차',
    'COMPLETED'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '크레인 작업 신호수 교육',
    '정기안전교육',
    '박크레인',
    CURRENT_DATE,
    '파주 현장 교육장',
    '크레인 신호법, 작업반경 통제, 안전거리 확보',
    'PLANNED'
);

-- 6. 사고/아차사고
INSERT INTO sms_incidents (project_id, type, title, date, time, place, description, cause, measure, reporter, status)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '아차사고',
    'LCD 패널 미끄러짐 사고',
    '2024-11-28',
    '14:20',
    '파주 A동 3층',
    'LCD 패널 이동 중 바닥 미끄러짐으로 패널이 기울어짐. 작업자 즉시 대피하여 인명피해 없음',
    '바닥 물기 제거 미흡, 미끄럼 방지 조치 부족',
    '작업 전 바닥 청소 의무화, 미끄럼 방지 매트 설치',
    '이파주',
    'CLOSED'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '아차사고',
    '크레인 와이어 손상 발견',
    '2024-12-02',
    '09:15',
    '파주 B동 외부',
    '크레인 작업 전 점검 중 와이어 로프 소선 끊김 발견',
    '정기 점검 주기 초과, 와이어 교체 시기 경과',
    '즉시 와이어 교체, 크레인 정기점검 강화',
    '박크레인',
    'INVESTIGATING'
);

-- 7. 문서
INSERT INTO sms_documents (project_id, category, title, description, file_name, file_size, uploaded_by, upload_date)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '주간보고',
    '파주 LGD 2024년 12월 1주차 안전보고',
    'LCD 패널 해체 작업 진행 현황 및 안전관리 활동',
    'paju_weekly_1201.pdf',
    1234567,
    '이파주',
    '2024-12-01'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '월간보고',
    '파주 LGD 11월 안전관리비 집행 보고',
    '11월 안전관리비 사용 내역 및 12월 계획',
    'paju_budget_nov.pdf',
    2345678,
    '김LG',
    '2024-11-30'
);

-- 8. 현장 인력
INSERT INTO sms_personnel (project_id, name, birth_date, job_type, blood_type, phone, agency, qr_code_data, status)
VALUES 
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '김파주',
    '1987-05-12',
    '해체공',
    'A',
    '010-2222-3333',
    '(주)LG파트너',
    'QR_KIM_PAJU_001',
    'ACTIVE'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '이클린',
    '1992-08-25',
    '클린룸 작업자',
    'B',
    '010-4444-5555',
    '(주)LG파트너',
    'QR_LEE_CLEAN_002',
    'ACTIVE'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '박크레인',
    '1985-03-18',
    '크레인 기사',
    'O',
    '010-6666-7777',
    '(주)크로스',
    'QR_PARK_CRANE_003',
    'ACTIVE'
),
(
    (SELECT id FROM projects WHERE code='PJ-2024-002'),
    '최안전',
    '1990-11-30',
    '안전관리자',
    'AB',
    '010-8888-9999',
    '(주)크로스',
    'QR_CHOI_SAFETY_004',
    'ACTIVE'
);

COMMIT;
