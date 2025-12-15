PMS 자원관리 설계
------------------

개요
- 목표: 기존 pms/시스템관리/자원관리 모듈을 대체하는 단일 인력·자격 원장 + 공종별 투입 가능 여부(Eligibility) 엔진 중심 모듈.
- 범위: 배정·근태·급여는 외부 모듈에 두고, 배정 가능 여부와 자격·교육 관리에 집중.
- 근거: `PMS_인력관리_요구사항정의.md`의 PIM 기능 + `PMS_공종별 투입가능 판정_참고.md`의 Eligibility 모델 통합.

서브도메인·서비스
- People Registry: 인적 기본, 직무/직책, 근로형태, 고용상태, 마스킹/비식별 최소 정보.
- Qualification Service: 자격(CERT)·교육(TRN) 등록, 만료/경고, 검증 워크플로우.
- Work Type Catalog: Trade Group/Work Type 코드, required_certs_all/any, trainings_all/any, min_role_counts, 조건(capacity/equipment/site flags).
- Eligibility Engine: 배정 시 규칙 평가(BLOCK/WARN), trace, override(Project/Site/Permit).
- Assignment API: 배정 요청 시 Eligibility 평가 결과와 누락 항목 반환.
- Audit & Security: 민감 정보 역할 기반 접근(HR_SEC_ADMIN 등), 감사 로그, 검증 워크플로우.
- Notification: 만료 D-30/60/90, 검증 지연, BLOCK 실패 알림.

역할/권한 (요약)
- TENANT_ADMIN: 테넌트 전역 설정/권한/코드 관리.
- HR_SEC_ADMIN: 민감정보/증빙 검증, 자격·교육 승인/반려.
- SAFETY_ADMIN: 안전·교육 검증, 안전 관련 rule 관리.
- PROJECT_MANAGER / SITE_MANAGER: 배정 요청, WARN 강행(로그).
- PMS_VIEWER: 최소 조회(마스킹 적용).

데이터 모델(초안)
- person(id, name, birth_yyyyMM, contact, status, role_tags[], project_org_refs, masked_fields…)
- role_tag(id, name, scope)
- employment(id, person_id, hire_type, grade, job_family, job_level, career_years, wage_type, active_flag)
- qualification_cert(id, code, name, validity_months, needs_verification, alert_days[])
- qualification_training(id, code, name, validity_months, alert_days[])
- person_cert(id, person_id, cert_code, issued_at, expires_at, status[pending/verified/rejected], evidence_uri)
- person_training(id, person_id, training_code, taken_at, expires_at, status, evidence_uri)
- trade_group(code, name)
- work_type(code, group_code, name, required_certs_all[], required_certs_any[], required_trainings_all[], required_trainings_any[], min_role_counts[], conditions{equipment, capacity_ton_min, site_flags_any[]}, enforcement{mode, reason_code})
- eligibility_rule_version(rule_id, work_type_code, version, payload_json, effective_from, effective_to)
- override(id, scope[project|site|permit], scope_ref, work_type_code, patch_json, approved_by, approved_at, reason)
- assignment_request(id, project_id, date, work_type_code, assignees[])
- assignment_result(id, assignment_request_id, eligible, assignee_results[], rule_trace, created_at)
- audit_log(id, actor, action, entity, entity_id, diff, ts, ip)

API 설계(예시)
- GET /work-types: 목록/필터(group, text, active)
- POST /work-types: 생성/수정(ADMIN)
- POST /eligibility/check: {project_id, date, work_type_code, assignees[]} → {eligible, assignee_results[{user_id, eligible, missing_certs[], missing_trainings[], expiring_soon[]}], rule_trace{base_rule_version, overrides_applied[]}}
- POST /eligibility/override: scope(Project/Site/Permit) Patch 추가
- POST /people, PATCH /people/{id}: 인력 마스터
- POST /people/{id}/certs | /trainings: 등록 + 증빙 업로드
- POST /verify/cert: 검증 승인/반려(HR_SEC_ADMIN)
- GET /alerts/expirations: 만료 D-30/60/90 리스트
- GET /audit: 감사 로그 조회(필터: actor, entity, 기간)

Eligibility 평가 플로우
1) Work Type 기본 rule 로드 → 2) Override(Project→Site→Permit) merge → 3) assignee별 required_all/any, training_all/any, min_role_counts, conditions 평가 → 4) enforcement(BLOCK/WARN) 결정 → 5) trace 기록.
- 캐싱: work_type + rule_version 캐시, override는 ETag/updated_at 기반.
- 성능: 배정 요청 단위 bulk 평가, DB fetch batching.

Override 규칙 (Patch 기반)
- *_add: 기존 배열에 추가
- *_remove: 기존 배열에서 제거
- *_replace: 배열 전체 교체
- enforcement.mode: 기본 WARN이면 override로 BLOCK 가능
- 실행: override 승인자/사유/타임스탬프 저장, 감사 로그 기록

Work Type/Rule 예시(JSON 스키마)
```json
{
  "rule_id": "UUID",
  "version": 1,
  "work_type_code": "WT_ELEC_LOW_VOLT",
  "name": "저전압 전기 배선 투입 가능 여부",
  "effective": { "from": "2026-01-01", "to": null },
  "required_certs_all": ["CERT_ELEC_WORKER_BASIC"],
  "required_certs_any": ["CERT_ELEC_ENGINEER_MANAGER", "CERT_ELEC_TECH_MANAGER"],
  "required_trainings_all": ["TRN_SAFETY_BASIC", "TRN_ELECTRICAL_SPECIAL"],
  "required_trainings_any": [],
  "min_role_counts": [
    { "role_tag": "RESPONSIBLE_MANAGER", "min": 1, "certs_any": ["CERT_ELEC_ENGINEER_MANAGER"] }
  ],
  "conditions": { "equipment": null, "capacity_ton_min": null, "site_flags_any": [] },
  "enforcement": { "mode": "BLOCK", "reason_code": "ELECTRICAL_MANAGER_REQUIRED" },
  "notes": "전기공사 책임자 1명 이상 배치"
}
```

초기 Trade Group/Work Type 카탈로그(요약)
- TG_EARTHWORK: WT_EARTH_EXCAVATOR_OP, WT_EARTH_LOADER_OP
- TG_STEEL: WT_STEEL_ERECTION, WT_STEEL_BOLT_TIGHTEN
- TG_PIPING: WT_PIPE_FAB, WT_PIPE_INSTALL, WT_PIPE_PRESSURE_TEST
- TG_ELECTRICAL: WT_ELEC_LOW_VOLT, WT_ELEC_PANEL, WT_ELEC_CABLE_TRAY
- TG_INSTRUMENT: WT_INST_LOOP_CHECK, WT_INST_CALIBRATION
- TG_LIFTING: WT_LIFT_MOBILE_CRANE_OP, WT_LIFT_RIGGER, WT_LIFT_SIGNALMAN
- TG_WELDING: WT_WELD_SMAW, WT_WELD_GTAW
- TG_DEMOLITION: WT_DEMO_GENERAL, WT_DEMO_ASBESTOS
- TG_WASTE: WT_WASTE_SORTING, WT_WASTE_TRANSPORT, WT_SCRAP_GRADING

UI/화면 흐름
- 관리자 콘솔: Work Type/Trade 코드 편집, rule JSON 편집·검증, Override 관리, 감사 로그.
- HR/Safety 뷰: 자격·교육 등록/검증, 만료 캘린더, 경고 현황.
- 현장/PM 뷰: 배정 전 Eligibility 체크, 실패 사유·누락 목록, 증빙 업로드, WARN 강행 시 확인 로그.
- 알림 센터: 만료 D-30/60/90, 검증 지연, BLOCK 실패 알림.

보안·감사
- HR_SEC_ADMIN만 민감 필드/증빙 조회·검증, SAFETY_ADMIN은 안전·교육 검증, PM/SM은 조회+배정 요청.
- 조회/등록/변경/검증/강행(WARN override) 모두 audit_log에 남김.
- 민감 필드 마스킹/암호화, 증빙은 presigned URL + 만료시간 제한.

마이그레이션 가이드(기존 자원관리 대체)
- 기존 인력/직무/자격 데이터를 People/Employment/Person_Cert/Person_Training으로 매핑.
- 공종/직무 카탈로그를 Work Type Catalog로 정규화(TG_*/WT_* 코드).
- 배정 로직 호출부를 `POST /eligibility/check`로 교체; 호환 기간 WARN 모드 병행 로그 확보.
- 만료 알림은 Notification 서비스로 이전, D-배치 스케줄러 연동.

운영·배포 고려
- Rule/Override JSON 스키마 lint/validation CI 추가.
- 만료 스캔/알림은 비동기 작업 큐로 분리.
- RBAC는 중앙 Auth(JWT claim→role_tag) 연동.

향후 업데이트 지침
- 새로운 요구사항·코드 추가 시 본 파일에 섹션 단위로 반영하고, 참고 요구사항 파일(`PMS_자원관리_요구사항정의.md`)은 레퍼런스로 유지.

단계별 추진 계획
- 1단계 설계 확정: 본 설계 문서 리뷰/수정, 용어·코드(TG_*/WT_*) 확정.
- 2단계 데이터 모델 구체화: ERD 초안, 컬럼 스펙/제약, 마이그레이션 매핑 표(기존 자원관리 → 새 스키마) 작성.
- 3단계 스키마/밸리데이션: Rule/Override JSON 스키마 정의, lint/CI 검사 추가, 초기 카탈로그(seed) 작성.
- 4단계 서비스/API 설계 상세: `/eligibility/check`, Override, People/Cert/Training CRUD, Audit/Alert API 스펙 문서화.
- 5단계 구현 1차: Work Type Catalog + Eligibility Engine + People/Qualification 저장소, 기본 CRUD, 배정 체크 API.
- 6단계 검증/이행: 단위/통합 테스트, 기존 배정 호출부를 새 API로 교체(WARN 병행), 알림/스케줄러 연동.
- 7단계 운영/보안: RBAC 적용, 감사로그, 증빙 스토리지 정책, 캐시 전략, 모니터링/대시보드 구축.

용어·코드 정책(1단계 산출 초안)
- Trade Group 코드: `TG_<DOMAIN>` 예) TG_EARTHWORK, TG_ELECTRICAL.
- Work Type 코드: `WT_<GROUP>_<ACTION>` 예) WT_EARTH_EXCAVATOR_OP, WT_WELD_SMAW.
- 자격 코드: `CERT_<DOMAIN>_<NAME>` 예) CERT_ELEC_WORKER_BASIC, CERT_WELD_SMAW.
- 교육 코드: `TRN_<DOMAIN>_<NAME>` 예) TRN_SAFETY_BASIC, TRN_LIFTING_SPECIAL.
- 롤 태그: TENANT_ADMIN, HR_SEC_ADMIN, SAFETY_ADMIN, PROJECT_MANAGER, SITE_MANAGER, PMS_VIEWER, RESPONSIBLE_MANAGER(역할 최소 배치용).
- 상태 값: person.status = active/inactive/blocked, cert|training.status = pending/verified/rejected.

데이터 모델 스펙 초안(2단계 시작점)
- person: id(PK), name, birth_yyyyMM, contact, status, role_tags[], masked_fields(jsonb), created_at/updated_at.
- employment: id(PK), person_id(FK), hire_type, grade, job_family, job_level, career_years, wage_type, active_flag, org_ref, created_at/updated_at.
- qualification_cert/training: code(PK), name, validity_months, needs_verification(bool, cert만), alert_days[], active_flag.
- person_cert/person_training: id(PK), person_id(FK), cert_code|training_code(FK), issued_at|taken_at, expires_at, status, evidence_uri, verified_by, verified_at, rejected_reason.
- trade_group: code(PK), name, active_flag, sort_order.
- work_type: code(PK), group_code(FK), name, required_certs_all[], required_certs_any[], required_trainings_all[], required_trainings_any[], min_role_counts(jsonb), conditions(jsonb), enforcement(jsonb), active_flag.
- eligibility_rule_version: rule_id(PK), work_type_code(FK), version, payload_json, effective_from, effective_to, created_by, created_at.
- override: id(PK), scope(project|site|permit), scope_ref, work_type_code(FK), patch_json, approved_by, approved_at, reason, active_flag.
- assignment_request: id(PK), project_id, date, work_type_code(FK), assignees[], requested_by, created_at.
- assignment_result: id(PK), assignment_request_id(FK), eligible, assignee_results(jsonb), rule_trace(jsonb), created_at.
- audit_log: id(PK), actor, action, entity, entity_id, diff(jsonb), ts, ip.

파일럿 접근 원칙
- “완벽 최적화”보다 “표준적이고 단순한 설계”로 1차 파일럿을 구축하고, 고객 피드백 후 개정한다.
- 특이사항·리스크가 아니면 개발을 진행하며, 변경·결정 사항은 본 문서에 바로 기록한다.
- 성능 최적화(캐시·인덱스·배치 튜닝)는 파일럿 검증 후 단계적으로 반영한다.

파일럿 스코프(MVP)
- People/Employment 기본 CRUD, Role Tag 부여(조회/배정 용).
- Qualification: 자격/교육 코드 관리, 개인 자격/교육 등록(증빙 업로드 경로만 보관), 만료일·경고일 계산.
- Work Type Catalog: TG/WT 코드, required_certs_all/any, required_trainings_all/any, enforcement(BLOCK/WARN) 설정.
- Eligibility 체크 API: `/eligibility/check` 단일 엔드포인트로 배정 전 검증, 누락·만료 임박 목록 제공.
- Override: Project 수준 MERGE patch 지원(override 승인/이력 포함), Site/Permit은 후순위.
- Audit Log: 주요 변경/검증/배정 체크 결과 기록(조회는 최소).
- Notification(1차): D-30/60/90 만료 알림용 쿼리/배치만 제공(실알림 채널 연동은 후순위).

초기 API 스펙 초안(파일럿 범위)
- POST `/people`: {name, contact, status, role_tags[]} → {person_id}
- PATCH `/people/{id}`: 상태/역할/연락처 갱신
- POST `/people/{id}/certs`: {cert_code, issued_at, expires_at, evidence_uri, status=pending}
- POST `/people/{id}/trainings`: {training_code, taken_at, expires_at, evidence_uri}
- POST `/work-types`: Work Type 생성/수정(ADMIN)
- GET `/work-types`: 필터(group, active)
- POST `/eligibility/check`:
  - 요청: {project_id, date, work_type_code, assignees[]}
  - 응답: {eligible, assignee_results[{user_id, eligible, missing_certs[], missing_trainings[], expiring_soon[]}], rule_trace{base_rule_version, overrides_applied[]}}
- POST `/eligibility/override`: {scope=project, scope_ref, work_type_code, patch, approved_by, reason}

파일럿 데이터 시드(예정)
- TG/WT: 각 Trade Group별 2~3개 Work Type 최소 시드.
- CERT/TRN: 기본 안전, 전기, 용접, 중장비 등 핵심 자격/교육 시드.
- ENFORCEMENT: 고위험(전기/중장비/용접) WT는 BLOCK, 저위험(일반 철거 등)은 WARN.

파일럿 시드 상세(초안)
- Trade Group
  - TG_EARTHWORK, TG_STEEL, TG_PIPING, TG_ELECTRICAL, TG_INSTRUMENT, TG_LIFTING, TG_WELDING, TG_DEMOLITION, TG_WASTE
- Work Type (예시 2~3개씩)
  - TG_EARTHWORK: WT_EARTH_EXCAVATOR_OP, WT_EARTH_LOADER_OP
  - TG_STEEL: WT_STEEL_ERECTION, WT_STEEL_BOLT_TIGHTEN
  - TG_PIPING: WT_PIPE_FAB, WT_PIPE_INSTALL, WT_PIPE_PRESSURE_TEST
  - TG_ELECTRICAL: WT_ELEC_LOW_VOLT, WT_ELEC_PANEL, WT_ELEC_CABLE_TRAY
  - TG_INSTRUMENT: WT_INST_LOOP_CHECK, WT_INST_CALIBRATION
  - TG_LIFTING: WT_LIFT_MOBILE_CRANE_OP, WT_LIFT_RIGGER, WT_LIFT_SIGNALMAN
  - TG_WELDING: WT_WELD_SMAW, WT_WELD_GTAW
  - TG_DEMOLITION: WT_DEMO_GENERAL, WT_DEMO_ASBESTOS
  - TG_WASTE: WT_WASTE_SORTING, WT_WASTE_TRANSPORT, WT_SCRAP_GRADING
- 자격(CERT) 기본 세트
  - 안전: CERT_SAFETY_GENERAL, CERT_HOT_WORK (용접/화기), CERT_CONFINED_SPACE
  - 전기: CERT_ELEC_WORKER_BASIC, CERT_ELEC_ENGINEER_MANAGER, CERT_ELEC_TECH_MANAGER
  - 중장비: CERT_LIFT_CRANE_MOBILE, CERT_LIFT_SIGNALMAN, CERT_LIFT_RIGGER, CERT_EARTH_EXCAVATOR, CERT_EARTH_LOADER
  - 용접: CERT_WELD_SMAW, CERT_WELD_GTAW
  - 석면/철거: CERT_ASBESTOS_MANAGER, CERT_DEMOLITION_MANAGER
- 교육(TRN) 기본 세트
  - 안전: TRN_SAFETY_BASIC, TRN_SAFETY_HOT_WORK, TRN_SAFETY_CONFINED
  - 전기: TRN_ELECTRICAL_SPECIAL
  - 중장비/하역: TRN_LIFTING_SPECIAL, TRN_LIFTING_SIGNAL
  - 용접: TRN_WELDING_SAFETY
  - 철거/석면: TRN_DEMOLITION_SPECIAL, TRN_ASBESTOS_SPECIAL
- 기본 ENFORCEMENT 가이드
  - BLOCK: 전기, 중장비 운전/신호, 용접, 석면, 고압·고온·밀폐 관련 WT
- WARN: 일반 철거, 폐기물 분류/운반, 경미 작업(추후 현장 피드백에 따라 조정)

데이터 모델 제약·인덱스 초안(파일럿)
- 공통: PK는 bigint 또는 uuid, created_at/updated_at 기본 now(), 파일럿은 soft delete 미도입. 상태/종류는 check 제약으로 시작.
- person: status, role_tags(GIN), created_at 인덱스. 중복 허용(파일럿), 이후 Dedup 도구로 정리.
- employment: FK(person_id) ON DELETE CASCADE, 인덱스(person_id, active_flag, org_ref).
- qualification_cert/training: PK=code, UNIQUE(name), 인덱스(active_flag).
- person_cert/training: FK(person_id) CASCADE, FK(cert_code|training_code) RESTRICT, UNIQUE(person_id, cert_code, expires_at), 인덱스(expires_at, status, person_id).
- trade_group: PK=code, UNIQUE(name), sort_order 기본 0.
- work_type: PK=code, FK(group_code) RESTRICT, 인덱스(group_code, active_flag).
- eligibility_rule_version: PK=rule_id+version 또는 surrogate PK + UNIQUE(rule_id, version), 인덱스(work_type_code, effective_from, effective_to).
- override: scope(project/site/permit), UNIQUE(scope, scope_ref, work_type_code, active_flag), 인덱스(scope_ref, work_type_code, approved_at).
- assignment_request: 인덱스(project_id, date, work_type_code).
- assignment_result: UNIQUE(assignment_request_id), 인덱스(created_at).
- audit_log: 인덱스(entity, entity_id, actor, ts DESC).

마이그레이션 매핑 초안(기존 자원관리 → 새 스키마)
- 인력 기본: 기존 인력 테이블 → person (name, birth_yyyyMM, contact, status=active 기본).
- 직무/직급/직책: 기존 코드 → employment(job_family, job_level, hire_type, org_ref). 중복·히스토리는 파일럿에선 최신만 적용.
- 자격: 기존 자격 코드/번호/만료 → qualification_cert (code), person_cert(issued_at, expires_at, status=verified 기본, evidence_uri 미사용 시 null).
- 교육: 기존 교육 코드/수료일/만료 → qualification_training, person_training.
- 공종/직무 카탈로그: 기존 공종/직무 코드 → trade_group/work_type(TG_*/WT_*로 정규화). 기존 조건/필수 자격은 required_certs_all/any에 매핑.
- 배정 이력: 기존 배정 로그 → assignment_request/result로 일부 마이그레이션(선택). 파일럿에서는 새로운 요청부터 수집.

파일럿 개발 우선순위(체크리스트)
- 스키마 생성: person/employment/qualification_/person_/trade_group/work_type/eligibility_rule_version/override/assignment_/audit_log.
- 시드: TG/WT, CERT/TRN 기본 세트, 고위험 WT BLOCK 지정.
- API 1차: people CRUD, cert/training 등록, work-type 조회/등록, `/eligibility/check`, `/eligibility/override`.
- 검증: 단위 테스트(룰 평가, override merge), 만료일 경고 계산.
- 관측/로그: audit_log 기록, WARN 강행 시 로그 남김.

스키마 DDL 초안(PostgreSQL 예시)
```sql
-- person
CREATE TABLE person (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  birth_yyyymm CHAR(6),
  contact TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','blocked')),
  role_tags TEXT[] NOT NULL DEFAULT '{}',
  masked_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_person_status ON person(status);
CREATE INDEX idx_person_role_tags ON person USING GIN(role_tags);

-- employment
CREATE TABLE employment (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  hire_type TEXT,
  grade TEXT,
  job_family TEXT,
  job_level TEXT,
  career_years NUMERIC(4,1),
  wage_type TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  org_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employment_person ON employment(person_id);
CREATE INDEX idx_employment_active ON employment(active_flag);

-- qualification master
CREATE TABLE qualification_cert (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  validity_months INT,
  needs_verification BOOLEAN NOT NULL DEFAULT true,
  alert_days INT[] NOT NULL DEFAULT ARRAY[90,60,30],
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_cert_active ON qualification_cert(active_flag);

CREATE TABLE qualification_training (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  validity_months INT,
  alert_days INT[] NOT NULL DEFAULT ARRAY[30,14,7],
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_training_active ON qualification_training(active_flag);

-- person cert/training
CREATE TABLE person_cert (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  cert_code TEXT NOT NULL REFERENCES qualification_cert(code),
  issued_at DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  evidence_uri TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, cert_code, expires_at)
);
CREATE INDEX idx_person_cert_expires ON person_cert(expires_at);
CREATE INDEX idx_person_cert_status ON person_cert(status);
CREATE INDEX idx_person_cert_person ON person_cert(person_id);

CREATE TABLE person_training (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  training_code TEXT NOT NULL REFERENCES qualification_training(code),
  taken_at DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  evidence_uri TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, training_code, expires_at)
);
CREATE INDEX idx_person_training_expires ON person_training(expires_at);
CREATE INDEX idx_person_training_status ON person_training(status);
CREATE INDEX idx_person_training_person ON person_training(person_id);

-- trade/work type
CREATE TABLE trade_group (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE work_type (
  code TEXT PRIMARY KEY,
  group_code TEXT NOT NULL REFERENCES trade_group(code),
  name TEXT NOT NULL,
  required_certs_all TEXT[] NOT NULL DEFAULT '{}',
  required_certs_any TEXT[] NOT NULL DEFAULT '{}',
  required_trainings_all TEXT[] NOT NULL DEFAULT '{}',
  required_trainings_any TEXT[] NOT NULL DEFAULT '{}',
  min_role_counts JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  enforcement JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_work_type_group ON work_type(group_code);
CREATE INDEX idx_work_type_active ON work_type(active_flag);

-- rules & overrides
CREATE TABLE eligibility_rule_version (
  id BIGSERIAL PRIMARY KEY,
  rule_id UUID NOT NULL,
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  version INT NOT NULL,
  payload_json JSONB NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, version)
);
CREATE INDEX idx_rule_work_type ON eligibility_rule_version(work_type_code);
CREATE INDEX idx_rule_effective ON eligibility_rule_version(effective_from, effective_to);

CREATE TABLE override (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('project','site','permit')),
  scope_ref TEXT NOT NULL,
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  patch_json JSONB NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  reason TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, scope_ref, work_type_code, active_flag)
);
CREATE INDEX idx_override_scope_ref ON override(scope_ref);
CREATE INDEX idx_override_work_type ON override(work_type_code);
CREATE INDEX idx_override_approved_at ON override(approved_at);

-- assignment
CREATE TABLE assignment_request (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  date DATE NOT NULL,
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  assignees TEXT[] NOT NULL,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ar_project_date ON assignment_request(project_id, date);
CREATE INDEX idx_ar_work_type ON assignment_request(work_type_code);

CREATE TABLE assignment_result (
  id BIGSERIAL PRIMARY KEY,
  assignment_request_id BIGINT NOT NULL REFERENCES assignment_request(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  assignee_results JSONB NOT NULL,
  rule_trace JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_request_id)
);
CREATE INDEX idx_ar_result_created ON assignment_result(created_at);

-- audit
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  diff JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_ts ON audit_log(ts DESC);
```

파일럿 시드 INSERT 초안(예시)
```sql
-- Trade Group
INSERT INTO trade_group(code, name, sort_order) VALUES
('TG_EARTHWORK','토공',10),('TG_STEEL','철골',20),('TG_PIPING','배관',30),
('TG_ELECTRICAL','전기',40),('TG_INSTRUMENT','계장',50),('TG_LIFTING','하역/중장비',60),
('TG_WELDING','용접',70),('TG_DEMOLITION','철거',80),('TG_WASTE','폐기물',90);

-- Work Type (샘플)
INSERT INTO work_type(code, group_code, name, required_certs_all, required_certs_any, required_trainings_all, enforcement) VALUES
('WT_EARTH_EXCAVATOR_OP','TG_EARTHWORK','굴착기 운전',ARRAY['CERT_EARTH_EXCAVATOR'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC'], '{"mode":"BLOCK","reason_code":"EXCAVATOR_LICENSE"}'),
('WT_LIFT_MOBILE_CRANE_OP','TG_LIFTING','이동식 크레인 운전',ARRAY['CERT_LIFT_CRANE_MOBILE'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_LIFTING_SPECIAL'], '{"mode":"BLOCK","reason_code":"CRANE_LICENSE"}'),
('WT_LIFT_SIGNALMAN','TG_LIFTING','신호수',ARRAY[]::text[],ARRAY['CERT_LIFT_SIGNALMAN'],ARRAY['TRN_SAFETY_BASIC','TRN_LIFTING_SIGNAL'], '{"mode":"BLOCK","reason_code":"SIGNALMAN_REQUIRED"}'),
('WT_WELD_SMAW','TG_WELDING','피복아크 용접',ARRAY['CERT_WELD_SMAW'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_WELDING_SAFETY'], '{"mode":"BLOCK","reason_code":"WELD_CERT_REQUIRED"}'),
('WT_ELEC_LOW_VOLT','TG_ELECTRICAL','저전압 전기배선',ARRAY['CERT_ELEC_WORKER_BASIC'],ARRAY['CERT_ELEC_ENGINEER_MANAGER','CERT_ELEC_TECH_MANAGER'],ARRAY['TRN_SAFETY_BASIC','TRN_ELECTRICAL_SPECIAL'], '{"mode":"BLOCK","reason_code":"ELECTRICAL_MANAGER_REQUIRED"}'),
('WT_DEMO_GENERAL','TG_DEMOLITION','일반 철거',ARRAY[]::text[],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_DEMOLITION_SPECIAL'], '{"mode":"WARN","reason_code":"DEMO_TRAINING_RECOMMENDED"}');

-- Certification master
INSERT INTO qualification_cert(code, name, validity_months, needs_verification, alert_days) VALUES
('CERT_SAFETY_GENERAL','기본 안전 자격',24,true,ARRAY[90,60,30]),
('CERT_HOT_WORK','화기 작업 자격',24,true,ARRAY[90,60,30]),
('CERT_CONFINED_SPACE','밀폐공간 작업 자격',24,true,ARRAY[90,60,30]),
('CERT_ELEC_WORKER_BASIC','전기기능사/전기산업기사 등',60,true,ARRAY[90,60,30]),
('CERT_ELEC_ENGINEER_MANAGER','전기기사(감리/책임자)',60,true,ARRAY[90,60,30]),
('CERT_ELEC_TECH_MANAGER','전기산업기사(관리자)',60,true,ARRAY[90,60,30]),
('CERT_LIFT_CRANE_MOBILE','이동식 크레인 면허',60,true,ARRAY[90,60,30]),
('CERT_LIFT_SIGNALMAN','신호수 자격',36,true,ARRAY[90,60,30]),
('CERT_LIFT_RIGGER','시스템비계·리깅 자격',36,true,ARRAY[90,60,30]),
('CERT_EARTH_EXCAVATOR','굴착기 조종사',60,true,ARRAY[90,60,30]),
('CERT_EARTH_LOADER','로더 조종사',60,true,ARRAY[90,60,30]),
('CERT_WELD_SMAW','피복아크 용접 자격',36,true,ARRAY[90,60,30]),
('CERT_WELD_GTAW','티그 용접 자격',36,true,ARRAY[90,60,30]),
('CERT_ASBESTOS_MANAGER','석면관리자',36,true,ARRAY[90,60,30]),
('CERT_DEMOLITION_MANAGER','건설기계 철거 관리자',36,true,ARRAY[90,60,30]);

-- Training master
INSERT INTO qualification_training(code, name, validity_months, alert_days) VALUES
('TRN_SAFETY_BASIC','기본 안전교육',12,ARRAY[30,14,7]),
('TRN_SAFETY_HOT_WORK','화기 작업 안전교육',12,ARRAY[30,14,7]),
('TRN_SAFETY_CONFINED','밀폐공간 안전교육',12,ARRAY[30,14,7]),
('TRN_ELECTRICAL_SPECIAL','전기 특수교육',12,ARRAY[30,14,7]),
('TRN_LIFTING_SPECIAL','하역·중장비 특수교육',12,ARRAY[30,14,7]),
('TRN_LIFTING_SIGNAL','신호수 특수교육',12,ARRAY[30,14,7]),
('TRN_WELDING_SAFETY','용접 안전교육',12,ARRAY[30,14,7]),
('TRN_DEMOLITION_SPECIAL','철거 특수교육',12,ARRAY[30,14,7]),
('TRN_ASBESTOS_SPECIAL','석면 특수교육',12,ARRAY[30,14,7]);
```

Eligibility 엔진 파일럿 구현 가이드
- 입력: work_type_code, assignees[], project_id(override scope), date(만료 비교 기준).
- 단계
  1) Work Type 기본 rule 로드 (required_certs_all/any, trainings_all/any, enforcement).
  2) Override(Project→Site→Permit) 순서로 patch 적용(merge: *_add, *_remove, *_replace, enforcement.mode 교체 허용).
  3) 각 assignee에 대해:
     - 자격/교육 조회: expires_at >= date 인지 확인, status=verified 우선. pending은 누락으로 간주(파일럿).
     - required_certs_all 만족 여부, required_certs_any 중 하나 보유 여부.
     - required_trainings_all/any 확인.
     - 만료 임박: alert_days 기준 D-잔여 계산하여 expiring_soon 리스트 작성.
  4) enforcement:
     - BLOCK: 누락 있으면 eligible=false, WARN은 eligible=true but warning.
     - 팀 eligible = 모든 assignee eligible AND enforcement.mode==WARN일 때도 팀 eligible true(경고만 기록).
  5) rule_trace: base_rule_version, overrides_applied[], missing 목록, expiring_soon 기록.
- 단순화 규칙(파일럿):
  - min_role_counts는 1차 파일럿에서 미적용(추후 확장 시 person.role_tags 기반 계산).
  - equipment/conditions는 null 시 무시, capacity_ton_min 등은 후속 릴리스에 반영.
  - pending 검증은 누락 처리(WARN/BLOCK 동일하게 missing으로 반환).

Override merge 예시(pseudo)
```pseudo
rule = base_rule
for ov in overrides_sorted(Project->Site->Permit):
  rule.required_certs_all += ov.patch.required_certs_all_add - remove + replace
  rule.required_certs_any  += ov.patch.required_certs_any_add  - remove + replace
  ... (trainings 동일)
  if ov.patch.enforcement_mode_replace: rule.enforcement.mode = ov.patch.enforcement_mode_replace
```

파일럿 테스트 시나리오(핵심)
- 성공: WT_ELEC_LOW_VOLT, assignee가 required_certs_all/any + trainings_all 충족 → eligible=true, missing 없음.
- 누락: WT_WELD_SMAW, CERT_WELD_SMAW 미보유 → eligible=false, missing_certs에 반환.
- 만료: WT_LIFT_MOBILE_CRANE_OP, CERT_LIFT_CRANE_MOBILE expires_at < date → eligible=false, missing_certs에 반환.
- 경고(WARN): WT_DEMO_GENERAL, TRAINING 미충족 시 eligible=false? (WARN이지만 missing 있으면 false, 단 경고용 rule_trace 기록).
- Override: Project override로 required_trainings_all_add=[TRN_LIFTING_SPECIAL]; 기본 rule 충족하나 override 추가 미충족 시 eligible=false.
- pending 처리: status=pending 자격은 미충족으로 분류.
- 다중 assignee: 한 명이라도 BLOCK 조건 미충족이면 team eligible=false.
