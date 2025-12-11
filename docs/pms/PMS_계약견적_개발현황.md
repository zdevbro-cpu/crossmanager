# PMS 계약/견적 개발현황 (1차 완료, 상세)

## 1. 요구사항 정의
- 목적/범위: 견적(EST) → 계약(CONTRACT) → 변경(CHANGE) 흐름, SoW 금액 산정, 고객 규정 체크리스트 관리.
- 필수 입력: 프로젝트, 계약명, 유형(EST/CONTRACT/CHANGE), 카테고리(NEW/ADD/CHANGE/REDUCE), 금액(직접/간접/리스크/마진), 상태, 규정/담당자/기간.
- 비즈 규칙:
  - 금액 합계: 총액 = 직접비 + 간접비 + 리스크 + 마진.
  - 규정 체크리스트는 프로젝트 규정명으로 템플릿 매칭 후 저장.
  - 상태: DRAFT/REVIEW/SUBMITTED/SIGNED/REJECTED.
  - 계약/견적 코드 자동규칙은 미정(수동 입력) → 과제.
- 적용 규정 템플릿: 삼성, LG, SK, 현대·GS·쌍용, 플랜트/화공 등.

## 2. 데이터/DB
- `contracts`
  - 핵심 필드: `project_id`, `code`(uniq), `type`(EST/CONTRACT/CHANGE), `category`(NEW/ADD/CHANGE/REDUCE),
    `name`, `total_amount`, `cost_direct`, `cost_indirect`, `risk_fee`, `margin`,
    `regulation_config`(JSONB), `client_manager`, `our_manager`,
    `contract_date`, `start_date`, `end_date`, `terms_payment`, `terms_penalty`, `status`(DRAFT/REVIEW/SUBMITTED/SIGNED/REJECTED).
- `contract_items`
  - `group_name`, `name`, `spec`, `quantity`, `unit`, `unit_price`, `amount`, `note`.
- 금액 5분할: 직접비 + 간접비 + 리스크 + 마진 = 총액.

## 3. 규정 템플릿/고객 요구사항
- 소스: `pms/src/pages/Contracts.tsx` `REGULATION_TEMPLATES`.
- 예시(일부):
  - 삼성: 안전 서약서, 보안각서, ISO45001 인증, 작업허가서(PTW), 위험성평가, MSDS 관리.
  - LG: 공사 중 안전사고 보고체계, 비밀유지서약, 안전관리 계획서, 교육/점검 절차.
  - SK: SHEQ 준수 서약, 위험물 취급/산업보건, 비상대응 매뉴얼, 안전교육 이력.
- 저장 방식: 프로젝트 규정명과 매칭 후 체크리스트를 `regulation_config.requirements[]`로 저장.

## 4. 백엔드/검증
- 훅: `useContracts`로 프로젝트별 CRUD. 금액/체크리스트는 JSON 통째로 직렬화.
- 금액 검증: 직접비 합산 → 간접비/리스크/마진은 프런트 계산 후 전달(서버 재계산/검증 미구현).
- 상태/유형: 문자열 그대로 저장(대문자). 코드 자동 생성 규칙은 프로젝트와 별도로 수동 입력(규칙 동기화 과제).

## 5. 프런트 구현 (`pms/src/pages/Contracts.tsx`)
- 규정 체크리스트: 프로젝트 규정명 자동 매칭 → 템플릿 생성, 수기 항목 추가/체크 가능.
- 금액 계산: % 변경 시 간접비/리스크/마진 금액 재계산, 총액 실시간 갱신.
- SoW 편집: 인라인 행 추가/삭제, 수량/단가 입력 → 금액 자동 합산.
- 타입/상태 전환: EST/CONTRACT/CHANGE, 카테고리 NEW/ADD/CHANGE/REDUCE, 상태(DRAFT~SIGNED) 선택.
- 첨부: Blob 변환 헬퍼만 존재, 실제 파일 업로드/서명 연동은 미구현.

## 6. 테스트/검증 포인트
- 규정 템플릿: 프로젝트 규정이 '삼성' 포함 시 체크리스트 자동 생성 여부.
- 금액: 수량/단가/간접비율/리스크율/마진율 변경 시 총액 일관성.
- 상태: SIGNED 상태로 저장 시 편집 제한(현재 미적용) 필요 여부 확인.
- 코드: 프로젝트 코드와 계약 코드 규칙이 불일치 → 수동 입력 시 중복 여부 확인.
- SoW: 행 100개 이상 입력 시 렌더 성능 점검.

## 7. 남은 과제
- 계약/견적 코드 자동생성 규칙 확정 및 프로젝트 코드와 동기화.
- 전자결재(승인선), 출력 템플릿(PDF/HTML) 연동, 세금/통화 옵션.
- 변경이력(diff) 비교 및 규정 템플릿 중앙 관리(서버 캐싱).***
